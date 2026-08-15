import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  user_id?: string;
}

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

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private config: SupabaseConfig | null = null;
  private isOffline: boolean = !navigator.onLine;

  constructor() {
    this.loadConfig();
    this.setupListeners();
  }

  private setupListeners() {
    window.addEventListener('online', () => {
      this.isOffline = false;
      this.syncPendingQueue();
    });
    window.addEventListener('offline', () => {
      this.isOffline = true;
    });
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
    if (config) {
      localStorage.setItem('supabase_config', JSON.stringify(config));
      this.config = config;
      this.supabase = createClient(config.url, config.anonKey);
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
    // Also delete associated requirements
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
  private getSyncQueue(): SyncQueueItem[] {
    const queueStr = localStorage.getItem('sync_queue') || '[]';
    return JSON.parse(queueStr);
  }

  private saveSyncQueue(queue: SyncQueueItem[]) {
    localStorage.setItem('sync_queue', JSON.stringify(queue));
  }

  private queueSync(item: SyncQueueItem) {
    const queue = this.getSyncQueue();
    // Remove previous actions for this item to avoid redundant ops
    const filteredQueue = queue.filter(q => !(q.id === item.id && q.type === item.type));
    filteredQueue.push(item);
    this.saveSyncQueue(filteredQueue);

    this.syncPendingQueue();
  }

  public async syncPendingQueue() {
    if (this.isOffline || !this.supabase) return;
    
    // Check if user is logged in
    const { data: { session } } = await this.supabase.auth.getSession();
    if (!session) return;

    const user_id = session.user.id;
    const queue = this.getSyncQueue();
    if (queue.length === 0) return;

    const remainingQueue: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        const table = item.type === 'project' ? 'projects' : item.type === 'requirement' ? 'requirements' : 'ideas';
        
        if (item.action === 'delete') {
          const { error } = await this.supabase
            .from(table)
            .delete()
            .eq('id', item.id)
            .eq('user_id', user_id);

          if (error) throw error;
        } else if (item.action === 'upsert') {
          const dataWithUser = { ...item.data, user_id };
          const { error } = await this.supabase
            .from(table)
            .upsert(dataWithUser);

          if (error) throw error;
        }
      } catch (e) {
        console.error(`Failed to sync item ${item.id} of type ${item.type}`, e);
        remainingQueue.push(item); // Keep in queue to retry later
      }
    }

    this.saveSyncQueue(remainingQueue);
  }

  // --- Pull Data from Cloud (after Login) ---
  public async pullAllData(): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) return { success: false, error: 'Supabase client not initialized' };

    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) return { success: false, error: 'No active session' };

      const user_id = session.user.id;

      // 1. Pull Projects
      const { data: cloudProjects, error: pError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('user_id', user_id);

      if (pError) throw pError;

      // 2. Pull Requirements
      const { data: cloudReqs, error: rError } = await this.supabase
        .from('requirements')
        .select('*')
        .eq('user_id', user_id);

      if (rError) throw rError;

      // 3. Pull Ideas
      const { data: cloudIdeas, error: iError } = await this.supabase
        .from('ideas')
        .select('*')
        .eq('user_id', user_id);

      if (iError) throw iError;

      // Merge data (cloud takes precedence, but we merge unique local ones if they aren't synced yet)
      const localProjects = this.getProjects();
      const localReqs = this.getRequirements();
      const localIdeas = this.getIdeas();

      // Simple merge logic: Use Map keyed by ID
      const projectsMap = new Map<string, Project>();
      localProjects.forEach(p => projectsMap.set(p.id, p));
      (cloudProjects || []).forEach((p: any) => projectsMap.set(p.id, {
        id: p.id,
        name: p.name,
        description: p.description,
        created_at: p.created_at,
        user_id: p.user_id,
      }));
      localStorage.setItem('projects', JSON.stringify(Array.from(projectsMap.values())));

      const reqsMap = new Map<string, Requirement>();
      localReqs.forEach(r => reqsMap.set(r.id, r));
      (cloudReqs || []).forEach((r: any) => reqsMap.set(r.id, {
        id: r.id,
        project_id: r.project_id,
        title: r.title,
        description: r.description,
        status: r.status,
        created_at: r.created_at,
        estimated_date: r.estimated_date,
        alarm_enabled: r.alarm_enabled,
        notified: r.notified,
        user_id: r.user_id,
      }));
      localStorage.setItem('requirements', JSON.stringify(Array.from(reqsMap.values())));

      const ideasMap = new Map<string, Idea>();
      localIdeas.forEach(i => ideasMap.set(i.id, i));
      (cloudIdeas || []).forEach((i: any) => ideasMap.set(i.id, {
        id: i.id,
        title: i.title,
        content: i.content,
        created_at: i.created_at,
        user_id: i.user_id,
      }));
      localStorage.setItem('ideas', JSON.stringify(Array.from(ideasMap.values())));

      // Clear sync queue since everything is clean now
      this.saveSyncQueue([]);

      return { success: true };
    } catch (e: any) {
      console.error('Error pulling cloud data', e);
      return { success: false, error: e.message || 'Unknown error' };
    }
  }

  // --- Push All Local Data to Cloud ---
  public async pushAllData(): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) return { success: false, error: 'Supabase client not initialized' };

    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (!session) return { success: false, error: 'No active session' };

      const user_id = session.user.id;

      const projects = this.getProjects();
      const reqs = this.getRequirements();
      const ideas = this.getIdeas();

      // Push projects
      if (projects.length > 0) {
        const { error } = await this.supabase
          .from('projects')
          .upsert(projects.map(p => ({ ...p, user_id })));
        if (error) throw error;
      }

      // Push requirements
      if (reqs.length > 0) {
        const { error } = await this.supabase
          .from('requirements')
          .upsert(reqs.map(r => ({ ...r, user_id })));
        if (error) throw error;
      }

      // Push ideas
      if (ideas.length > 0) {
        const { error } = await this.supabase
          .from('ideas')
          .upsert(ideas.map(i => ({ ...i, user_id })));
        if (error) throw error;
      }

      // Clear sync queue
      this.saveSyncQueue([]);

      return { success: true };
    } catch (e: any) {
      console.error('Error pushing data', e);
      return { success: false, error: e.message || 'Unknown error' };
    }
  }
}

export const db = new DatabaseService();
