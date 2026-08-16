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
  private getSyncQueue(): SyncQueueItem[] {
    const queueStr = localStorage.getItem('sync_queue') || '[]';
    return JSON.parse(queueStr);
  }

  private saveSyncQueue(queue: SyncQueueItem[]) {
    localStorage.setItem('sync_queue', JSON.stringify(queue));
  }

  private queueSync(item: SyncQueueItem) {
    const queue = this.getSyncQueue();
    const filteredQueue = queue.filter(q => !(q.id === item.id && q.type === item.type));
    filteredQueue.push(item);
    this.saveSyncQueue(filteredQueue);

    this.syncPendingQueue();
  }

  public async syncPendingQueue(): Promise<{ success: boolean; error?: string }> {
    if (this.isOffline || !this.supabase) return { success: true };
    
    const queue = this.getSyncQueue();
    if (queue.length === 0) return { success: true };

    const remainingQueue: SyncQueueItem[] = [];
    let lastError: any = null;

    for (const item of queue) {
      try {
        const table = item.type === 'project' ? 'projects' : item.type === 'requirement' ? 'requirements' : 'ideas';
        
        if (item.action === 'delete') {
          const { error } = await this.supabase
            .from(table)
            .delete()
            .eq('id', item.id);

          if (error) throw error;
        } else if (item.action === 'upsert') {
          // Exclude user_id property to avoid DB constraint failures since there is no session
          const { user_id, ...cleanData } = item.data;
          
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

  // --- Pull Data from Cloud (Direct Sync) ---
  public async pullAllData(): Promise<{ success: boolean; error?: string }> {
    if (!this.supabase) return { success: false, error: 'Supabase client not initialized' };

    try {
      // 1. Pull Projects
      const { data: cloudProjects, error: pError } = await this.supabase
        .from('projects')
        .select('*');

      if (pError) throw pError;

      // 2. Pull Requirements
      const { data: cloudReqs, error: rError } = await this.supabase
        .from('requirements')
        .select('*');

      if (rError) throw rError;

      // 3. Pull Ideas
      const { data: cloudIdeas, error: iError } = await this.supabase
        .from('ideas')
        .select('*');

      if (iError) throw iError;

      // Overwrite local storage with cloud tables (Supabase is source of truth after pushing)
      const projects = (cloudProjects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        created_at: p.created_at,
      }));
      localStorage.setItem('projects', JSON.stringify(projects));

      const reqs = (cloudReqs || []).map((r: any) => ({
        id: r.id,
        project_id: r.project_id,
        title: r.title,
        description: r.description,
        status: r.status,
        created_at: r.created_at,
        estimated_date: r.estimated_date,
        alarm_enabled: r.alarm_enabled,
        notified: r.notified,
      }));
      localStorage.setItem('requirements', JSON.stringify(reqs));

      const ideas = (cloudIdeas || []).map((i: any) => ({
        id: i.id,
        title: i.title,
        content: i.content,
        created_at: i.created_at,
      }));
      localStorage.setItem('ideas', JSON.stringify(ideas));

      // Clear sync queue
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
