import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  user_id?: string;
}

export interface Requirement {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  created_at: string;
  estimated_date: string; // ISO format: YYYY-MM-DD
  alarm_enabled: boolean;
  notified: boolean;
  alarm_days_before?: number; // Custom advance days (e.g. 0, 1, 2, 3, 7)
  last_notified_date?: string; // 'YYYY-MM-DD' to prevent duplicate notifications on the same day while allowing multi-tier alerts
  snoozed_until?: string; // ISO string until when alarms are silenced
  user_id?: string;
}

export interface AlarmSettings {
  advanceDays: number;
  notifyOnDueDate: boolean;
  notifyOverdue: boolean;
  desktopNotifications: boolean;
  soundEnabled: boolean;
}

export const DEFAULT_ALARM_SETTINGS: AlarmSettings = {
  advanceDays: 3,
  notifyOnDueDate: true,
  notifyOverdue: true,
  desktopNotifications: true,
  soundEnabled: true,
};

export interface Idea {
  id: string;
  title: string;
  content: string;
  created_at: string;
  user_id?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'project' | 'requirement' | 'idea';
  action: 'upsert' | 'delete';
  data?: any;
  timestamp: number;
}

export interface SyncResult {
  success: boolean;
  changed: boolean;
  error?: string;
}

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private config: SupabaseConfig | null = null;
  private isOffline: boolean = !navigator.onLine;

  // Concurrency lock & sequential queue
  private isSyncInProgress: boolean = false;
  private pendingSyncQueued: boolean = false;

  // Realtime subscription
  private realtimeChannel: RealtimeChannel | null = null;
  private debounceRealtimeTimeout: any = null;
  private remoteChangeListeners: ((changed: boolean) => void)[] = [];

  constructor() {
    this.loadConfig();
    this.setupListeners();
    if (this.supabase) {
      this.setupRealtime();
    }
  }

  private setupListeners() {
    window.addEventListener('online', () => {
      this.isOffline = false;
      this.safeSynchronize({ silent: true });
    });
    window.addEventListener('offline', () => {
      this.isOffline = true;
    });
  }

  // --- Realtime Subscriptions ---
  private setupRealtime() {
    if (!this.supabase) return;
    this.teardownRealtime();

    try {
      this.realtimeChannel = this.supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects' },
          () => this.handleRealtimeChange()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'requirements' },
          () => this.handleRealtimeChange()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ideas' },
          () => this.handleRealtimeChange()
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription not supported or failed:', err);
    }
  }

  private teardownRealtime() {
    if (this.realtimeChannel && this.supabase) {
      try {
        this.supabase.removeChannel(this.realtimeChannel);
      } catch (err) {
        console.warn('Error tearing down realtime channel', err);
      }
      this.realtimeChannel = null;
    }
    if (this.debounceRealtimeTimeout) {
      clearTimeout(this.debounceRealtimeTimeout);
      this.debounceRealtimeTimeout = null;
    }
  }

  private handleRealtimeChange() {
    if (this.debounceRealtimeTimeout) {
      clearTimeout(this.debounceRealtimeTimeout);
    }
    // Debounce 600ms to allow multi-row DB transactions to settle
    this.debounceRealtimeTimeout = setTimeout(() => {
      this.safeSynchronize({ silent: true });
    }, 600);
  }

  public onRemoteChange(callback: (changed: boolean) => void): () => void {
    this.remoteChangeListeners.push(callback);
    return () => {
      this.remoteChangeListeners = this.remoteChangeListeners.filter(cb => cb !== callback);
    };
  }

  private notifyRemoteChange(changed: boolean) {
    for (const listener of this.remoteChangeListeners) {
      try {
        listener(changed);
      } catch (e) {
        console.error('Error in onRemoteChange listener', e);
      }
    }
  }

  // --- Interval & Last Synced Preference ---
  public getSyncInterval(): number {
    const saved = localStorage.getItem('sync_interval_seconds');
    if (saved === null) return 30; // Default: 30 seconds
    const parsed = parseInt(saved, 10);
    return isNaN(parsed) ? 30 : parsed;
  }

  public setSyncInterval(seconds: number) {
    localStorage.setItem('sync_interval_seconds', seconds.toString());
  }

  public getLastSyncedAt(): number | null {
    const saved = localStorage.getItem('last_synced_at');
    if (!saved) return null;
    const parsed = parseInt(saved, 10);
    return isNaN(parsed) ? null : parsed;
  }

  // --- Alarm Preferences ---
  public getAlarmSettings(): AlarmSettings {
    const saved = localStorage.getItem('alarm_settings');
    if (!saved) return { ...DEFAULT_ALARM_SETTINGS };
    try {
      return { ...DEFAULT_ALARM_SETTINGS, ...JSON.parse(saved) };
    } catch {
      return { ...DEFAULT_ALARM_SETTINGS };
    }
  }

  public saveAlarmSettings(settings: AlarmSettings) {
    localStorage.setItem('alarm_settings', JSON.stringify(settings));
  }

  // --- Connection Test ---
  public async testConnection(url: string, anonKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      const testClient = createClient(url, anonKey);
      // Simply check if we can connect to the Supabase endpoint (e.g. auth endpoint)
      // getUser() performs a real fetch to verify if the anonKey and url are valid.
      const { error } = await testClient.auth.getUser();
      if (error) {
        if (error.message.includes('Invalid API key') || error.message.includes('invalid') || error.status === 401 || error.status === 403) {
          return { success: false, error: 'La clave Anon Key no es válida para este proyecto.' };
        }
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Error de conexión. Verifica que la URL sea correcta y que tengas internet.' };
    }
  }

  // --- Configuration ---
  public loadConfig(): SupabaseConfig | null {
    const configStr = localStorage.getItem('supabase_config');
    if (configStr) {
      try {
        this.config = JSON.parse(configStr);
        if (this.config && this.config.url && this.config.anonKey) {
          this.supabase = createClient(this.config.url, this.config.anonKey);
        }
      } catch (e) {
        console.error('Error parsing Supabase config', e);
      }
    }
    return this.config;
  }

  public saveConfig(config: SupabaseConfig | null) {
    this.teardownRealtime();
    if (config) {
      localStorage.setItem('supabase_config', JSON.stringify(config));
      this.config = config;
      this.supabase = createClient(config.url, config.anonKey);
      this.setupRealtime();
    } else {
      localStorage.removeItem('supabase_config');
      this.config = null;
      this.supabase = null;
    }
  }

  public getSupabaseClient(): SupabaseClient | null {
    return this.supabase;
  }

  // --- Projects ---
  public getProjects(): Project[] {
    const projectsStr = localStorage.getItem('projects') || '[]';
    return JSON.parse(projectsStr);
  }

  public saveProject(project: Project) {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = project;
    } else {
      projects.push(project);
    }
    localStorage.setItem('projects', JSON.stringify(projects));

    this.queueSync({
      id: project.id,
      type: 'project',
      action: 'upsert',
      data: project,
      timestamp: Date.now(),
    });
  }

  public deleteProject(id: string) {
    // Delete associated requirements
    const requirements = this.getRequirements().filter(r => r.project_id === id);
    requirements.forEach(r => this.deleteRequirement(r.id));

    const projects = this.getProjects().filter(p => p.id !== id);
    localStorage.setItem('projects', JSON.stringify(projects));

    this.queueSync({
      id: id,
      type: 'project',
      action: 'delete',
      timestamp: Date.now(),
    });
  }

  // --- Requirements ---
  public getRequirements(): Requirement[] {
    const reqsStr = localStorage.getItem('requirements') || '[]';
    return JSON.parse(reqsStr);
  }

  public getRequirementsByProject(projectId: string): Requirement[] {
    return this.getRequirements().filter(r => r.project_id === projectId);
  }

  public saveRequirement(requirement: Requirement) {
    const reqs = this.getRequirements();
    const index = reqs.findIndex(r => r.id === requirement.id);
    if (index >= 0) {
      reqs[index] = requirement;
    } else {
      reqs.push(requirement);
    }
    localStorage.setItem('requirements', JSON.stringify(reqs));

    this.queueSync({
      id: requirement.id,
      type: 'requirement',
      action: 'upsert',
      data: requirement,
      timestamp: Date.now(),
    });
  }

  public deleteRequirement(id: string) {
    const reqs = this.getRequirements().filter(r => r.id !== id);
    localStorage.setItem('requirements', JSON.stringify(reqs));

    this.queueSync({
      id: id,
      type: 'requirement',
      action: 'delete',
      timestamp: Date.now(),
    });
  }

  // --- Ideas ---
  public getIdeas(): Idea[] {
    const ideasStr = localStorage.getItem('ideas') || '[]';
    return JSON.parse(ideasStr);
  }

  public saveIdea(idea: Idea) {
    const ideas = this.getIdeas();
    const index = ideas.findIndex(i => i.id === idea.id);
    if (index >= 0) {
      ideas[index] = idea;
    } else {
      ideas.push(idea);
    }
    localStorage.setItem('ideas', JSON.stringify(ideas));

    this.queueSync({
      id: idea.id,
      type: 'idea',
      action: 'upsert',
      data: idea,
      timestamp: Date.now(),
    });
  }

  public deleteIdea(id: string) {
    const ideas = this.getIdeas().filter(i => i.id !== id);
    localStorage.setItem('ideas', JSON.stringify(ideas));

    this.queueSync({
      id: id,
      type: 'idea',
      action: 'delete',
      timestamp: Date.now(),
    });
  }

  // --- Sync Queue Logic ---
  public getSyncQueue(): SyncQueueItem[] {
    const queueStr = localStorage.getItem('sync_queue') || '[]';
    try {
      return JSON.parse(queueStr);
    } catch {
      return [];
    }
  }

  private saveSyncQueue(queue: SyncQueueItem[]) {
    localStorage.setItem('sync_queue', JSON.stringify(queue));
  }

  private queueSync(item: SyncQueueItem) {
    const queue = this.getSyncQueue();
    const filteredQueue = queue.filter(q => !(q.id === item.id && q.type === item.type));
    filteredQueue.push(item);
    this.saveSyncQueue(filteredQueue);

    this.safeSynchronize({ silent: true });
  }

  // --- Ordered, Safe Queue Push ---
  public async syncPendingQueue(): Promise<{ success: boolean; error?: string }> {
    if (this.isOffline || !this.supabase) return { success: true };

    const queue = this.getSyncQueue();
    if (queue.length === 0) return { success: true };

    // Respect Foreign Keys:
    // When deleting: delete requirements first, then projects, then ideas
    // When upserting: upsert projects first, then requirements, then ideas
    const sortedQueue = [...queue].sort((a, b) => {
      if (a.action === 'delete' && b.action !== 'delete') return -1;
      if (a.action !== 'delete' && b.action === 'delete') return 1;

      // Both deletes: requirements before projects
      if (a.action === 'delete' && b.action === 'delete') {
        const order = { requirement: 1, idea: 2, project: 3 };
        return (order[a.type] || 2) - (order[b.type] || 2);
      }

      // Both upserts: projects before requirements
      const order = { project: 1, requirement: 2, idea: 3 };
      return (order[a.type] || 2) - (order[b.type] || 2);
    });

    const remainingQueue: SyncQueueItem[] = [];
    let lastError: any = null;

    for (const item of sortedQueue) {
      try {
        const table = item.type === 'project' ? 'projects' : item.type === 'requirement' ? 'requirements' : 'ideas';

        if (item.action === 'delete') {
          const { error } = await this.supabase
            .from(table)
            .delete()
            .eq('id', item.id);

          if (error) throw error;
        } else if (item.action === 'upsert') {
          // Exclude user_id and local alarm fields from Supabase upsert to guarantee schema compatibility
          const { user_id, alarm_days_before, last_notified_date, snoozed_until, ...cleanData } = item.data;

          const { error } = await this.supabase
            .from(table)
            .upsert(cleanData);

          if (error) throw error;
        }
      } catch (e: any) {
        console.error(`Failed to sync item ${item.id} of type ${item.type}`, e);
        remainingQueue.push(item);
        lastError = e;
      }
    }

    this.saveSyncQueue(remainingQueue);

    if (remainingQueue.length > 0) {
      return { success: false, error: lastError?.message || lastError || 'Error al guardar algunos datos locales en Supabase.' };
    }
    return { success: true };
  }

  // --- Robust Two-Way Continuous Safe Synchronize ---
  public async safeSynchronize(options: { silent?: boolean } = {}): Promise<SyncResult> {
    if (this.isOffline || !this.supabase) {
      return { success: false, changed: false, error: 'Sin conexión a internet o base de datos no configurada.' };
    }

    // Mutex lock to prevent concurrency collisions
    if (this.isSyncInProgress) {
      this.pendingSyncQueued = true;
      return { success: true, changed: false };
    }

    this.isSyncInProgress = true;

    try {
      // 1. Push pending local changes first
      const pushRes = await this.syncPendingQueue();
      if (!pushRes.success && !options.silent) {
        return { success: false, changed: false, error: pushRes.error };
      }

      // 2. Fetch fresh tables from Supabase
      const [projectsRes, reqsRes, ideasRes] = await Promise.all([
        this.supabase.from('projects').select('*'),
        this.supabase.from('requirements').select('*'),
        this.supabase.from('ideas').select('*'),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (reqsRes.error) throw reqsRes.error;
      if (ideasRes.error) throw ideasRes.error;

      // 3. Safe Merge: Protect unpushed local modifications
      const activeQueue = this.getSyncQueue();

      // Merge Projects
      let mergedProjects: Project[] = (projectsRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        created_at: p.created_at,
      }));

      // Apply pending queue modifications on top of cloud data
      for (const q of activeQueue) {
        if (q.type === 'project') {
          if (q.action === 'delete') {
            mergedProjects = mergedProjects.filter(p => p.id !== q.id);
          } else if (q.action === 'upsert' && q.data) {
            const idx = mergedProjects.findIndex(p => p.id === q.id);
            if (idx >= 0) {
              mergedProjects[idx] = q.data;
            } else {
              mergedProjects.push(q.data);
            }
          }
        }
      }

      // Merge Requirements
      const currentReqs = this.getRequirements();
      const currentReqsMap = new Map<string, Requirement>(currentReqs.map(r => [r.id, r]));

      let mergedReqs: Requirement[] = (reqsRes.data || []).map((r: any) => {
        const local = currentReqsMap.get(r.id);
        return {
          id: r.id,
          project_id: r.project_id,
          title: r.title,
          description: r.description || '',
          status: r.status,
          created_at: r.created_at,
          estimated_date: r.estimated_date,
          alarm_enabled: r.alarm_enabled ?? true,
          notified: r.notified ?? false,
          alarm_days_before: r.alarm_days_before ?? local?.alarm_days_before,
          last_notified_date: r.last_notified_date ?? local?.last_notified_date,
          snoozed_until: r.snoozed_until ?? local?.snoozed_until,
        };
      });

      for (const q of activeQueue) {
        if (q.type === 'requirement') {
          if (q.action === 'delete') {
            mergedReqs = mergedReqs.filter(r => r.id !== q.id);
          } else if (q.action === 'upsert' && q.data) {
            const idx = mergedReqs.findIndex(r => r.id === q.id);
            if (idx >= 0) {
              mergedReqs[idx] = q.data;
            } else {
              mergedReqs.push(q.data);
            }
          }
        }
      }

      // Merge Ideas
      let mergedIdeas: Idea[] = (ideasRes.data || []).map((i: any) => ({
        id: i.id,
        title: i.title,
        content: i.content || '',
        created_at: i.created_at,
      }));

      for (const q of activeQueue) {
        if (q.type === 'idea') {
          if (q.action === 'delete') {
            mergedIdeas = mergedIdeas.filter(i => i.id !== q.id);
          } else if (q.action === 'upsert' && q.data) {
            const idx = mergedIdeas.findIndex(i => i.id === q.id);
            if (idx >= 0) {
              mergedIdeas[idx] = q.data;
            } else {
              mergedIdeas.push(q.data);
            }
          }
        }
      }

      // 4. Zero-Flicker Change Detection
      const currentProjectsStr = localStorage.getItem('projects') || '[]';
      const currentReqsStr = localStorage.getItem('requirements') || '[]';
      const currentIdeasStr = localStorage.getItem('ideas') || '[]';

      const newProjectsStr = JSON.stringify(mergedProjects);
      const newReqsStr = JSON.stringify(mergedReqs);
      const newIdeasStr = JSON.stringify(mergedIdeas);

      const hasChanged =
        currentProjectsStr !== newProjectsStr ||
        currentReqsStr !== newReqsStr ||
        currentIdeasStr !== newIdeasStr;

      if (hasChanged) {
        localStorage.setItem('projects', newProjectsStr);
        localStorage.setItem('requirements', newReqsStr);
        localStorage.setItem('ideas', newIdeasStr);
      }

      // Record last sync timestamp
      const now = Date.now();
      localStorage.setItem('last_synced_at', now.toString());

      if (hasChanged) {
        this.notifyRemoteChange(true);
      }

      return { success: true, changed: hasChanged };
    } catch (e: any) {
      if (!options.silent) {
        console.error('Error during safeSynchronize:', e);
      }
      return { success: false, changed: false, error: e.message || 'Error en la sincronización con Supabase.' };
    } finally {
      this.isSyncInProgress = false;

      // If another sync was requested while this one was running, execute it now
      if (this.pendingSyncQueued) {
        this.pendingSyncQueued = false;
        setTimeout(() => {
          this.safeSynchronize({ silent: true });
        }, 100);
      }
    }
  }

  // --- Backwards-compatible pullAllData ---
  public async pullAllData(): Promise<{ success: boolean; error?: string }> {
    const res = await this.safeSynchronize({ silent: false });
    return { success: res.success, error: res.error };
  }

  // --- Backwards-compatible pushAllData ---
  public async pushAllData(): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) return { success: false, error: 'Supabase client not initialized' };

    try {
      const projects = this.getProjects();
      const reqs = this.getRequirements();
      const ideas = this.getIdeas();

      // Push projects
      if (projects.length > 0) {
        // Exclude user_id
        const cleanProjects = projects.map(({ user_id, ...p }) => p);
        const { error } = await this.supabase
          .from('projects')
          .upsert(cleanProjects);
        if (error) throw error;
      }

      // Push requirements
      if (reqs.length > 0) {
        const cleanReqs = reqs.map(({ user_id, ...r }) => r);
        const { error } = await this.supabase
          .from('requirements')
          .upsert(cleanReqs);
        if (error) throw error;
      }

      // Push ideas
      if (ideas.length > 0) {
        const cleanIdeas = ideas.map(({ user_id, ...i }) => i);
        const { error } = await this.supabase
          .from('ideas')
          .upsert(cleanIdeas);
        if (error) throw error;
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error pushing data', e);
      return { success: false, error: e.message || 'Unknown error' };
    }
  }
}

export const db = new DatabaseService();
