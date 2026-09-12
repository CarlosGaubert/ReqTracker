import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  CheckCircle2, 
  AlertCircle, 
  Lightbulb, 
  Calendar, 
  ArrowRight, 
  PlusCircle, 
  Sparkles,
  Bell
} from 'lucide-react';
import { db, Requirement, Idea } from '../services/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface DashboardSectionProps {
  onNavigateToSection: (section: 'projects' | 'ideas' | 'settings', projectId?: string | null) => void;
  onOpenCreateProject: () => void;
  onOpenCreateIdea: () => void;
  refreshTrigger: number;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  onNavigateToSection,
  onOpenCreateProject,
  onOpenCreateIdea,
  refreshTrigger,
}) => {
  const [stats, setStats] = useState({
    projectsCount: 0,
    pendingTasks: 0,
    completedTasks: 0,
    ideasCount: 0,
  });
  const [urgentTasks, setUrgentTasks] = useState<(Requirement & { projectName: string; daysDiff: number })[]>([]);
  const [recentIdeas, setRecentIdeas] = useState<Idea[]>([]);

  useEffect(() => {
    // 1. Fetch data
    const projects = db.getProjects();
    const requirements = db.getRequirements();
    const ideas = db.getIdeas();

    // 2. Calculate stats
    const pending = requirements.filter(r => r.status !== 'done');
    const completed = requirements.filter(r => r.status === 'done');

    setStats({
      projectsCount: projects.length,
      pendingTasks: pending.length,
      completedTasks: completed.length,
      ideasCount: ideas.length,
    });

    // 3. Filter urgent tasks (due within 3 days or overdue, sorted by urgency)
    const now = new Date();
    const urgent = requirements
      .filter(r => r.status !== 'done' && r.estimated_date)
      .map(r => {
        const dueDate = new Date(`${r.estimated_date}T23:59:59`);
        const timeDiff = dueDate.getTime() - now.getTime();
        const daysDiff = timeDiff / (1000 * 3600 * 24);
        const proj = projects.find(p => p.id === r.project_id);
        return {
          ...r,
          daysDiff,
          projectName: proj ? proj.name : 'Proyecto Desconocido',
        };
      })
      // Filter for overdue (daysDiff < 0) or due within 3 days (daysDiff <= 3)
      .filter(r => r.daysDiff <= 3)
      // Sort by daysDiff ascending (overdue first, then soonest)
      .sort((a, b) => a.daysDiff - b.daysDiff)
      .slice(0, 6); // Allow up to 6 on taller vertical screens

    setUrgentTasks(urgent);

    // 4. Get most recent ideas
    const sortedIdeas = [...ideas]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);
    setRecentIdeas(sortedIdeas);

  }, [refreshTrigger]);

  // Formatter for Spanish dates
  const todayStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Simple Inline Markdown parser for recent ideas cards
  const renderIdeaPreview = (text: string) => {
    const lines = text.split('\n').slice(0, 3); // Preview first 3 lines
    return lines.map((line, idx) => {
      // Bullets
      if (line.trim().startsWith('- ')) {
        return (
          <li key={idx} className="list-disc list-inside text-neutral-500 dark:text-neutral-400 text-xs">
            {line.substring(2)}
          </li>
        );
      }
      // Checkboxes
      if (line.trim().startsWith('[x] ') || line.trim().startsWith('[ ] ')) {
        const checked = line.trim().startsWith('[x] ');
        return (
          <div key={idx} className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <input type="checkbox" checked={checked} readOnly className="h-3 w-3 rounded pointer-events-none opacity-60" />
            <span className={checked ? 'line-through opacity-60' : ''}>{line.substring(4)}</span>
          </div>
        );
      }
      return (
        <p key={idx} className="text-xs text-neutral-500 dark:text-neutral-400 truncate leading-relaxed">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-1 pb-8">
      {/* 1. Header Greeting */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-800 dark:text-neutral-50 flex items-center gap-2">
            <span>¡Hola de nuevo!</span>
            <Sparkles className="h-5 w-5 text-emerald-500 animate-pulse" />
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 capitalize">
            {todayStr}
          </p>
        </div>
        
        {/* Quick actions panel */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8.5 sm:h-9 text-xs sm:text-sm font-semibold gap-1.5 sm:gap-2 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-xl px-3 sm:px-3.5 flex-1 sm:flex-initial"
            onClick={onOpenCreateIdea}
          >
            <PlusCircle className="h-4 w-4 text-neutral-500" />
            <span>Anotar Idea</span>
          </Button>
          <Button 
            size="sm" 
            className="h-8.5 sm:h-9 text-xs sm:text-sm font-semibold gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-3.5 shadow-sm flex-1 sm:flex-initial"
            onClick={onOpenCreateProject}
          >
            <PlusCircle className="h-4 w-4" />
            <span>Nuevo Proyecto</span>
          </Button>
        </div>
      </div>

      <Separator className="bg-neutral-200 dark:bg-neutral-800 my-0.5" />

      {/* 2. Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4.5">
        <Card className="border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/30 shadow-sm rounded-2xl">
          <CardContent className="p-4 sm:p-4.5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Proyectos</p>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">{stats.projectsCount}</h3>
            </div>
            <div className="p-2.5 sm:p-3 bg-neutral-100/90 dark:bg-neutral-800/60 rounded-2xl text-neutral-600 dark:text-neutral-300">
              <Folder className="h-5 sm:h-6 w-5 sm:w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/30 shadow-sm rounded-2xl">
          <CardContent className="p-4 sm:p-4.5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Por Hacer</p>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">{stats.pendingTasks}</h3>
            </div>
            <div className="p-2.5 sm:p-3 bg-amber-500/10 dark:bg-amber-500/10 rounded-2xl text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 sm:h-6 w-5 sm:w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/30 shadow-sm rounded-2xl">
          <CardContent className="p-4 sm:p-4.5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Completadas</p>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">{stats.completedTasks}</h3>
            </div>
            <div className="p-2.5 sm:p-3 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 sm:h-6 w-5 sm:w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/30 shadow-sm rounded-2xl">
          <CardContent className="p-4 sm:p-4.5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Banco de Ideas</p>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-50">{stats.ideasCount}</h3>
            </div>
            <div className="p-2.5 sm:p-3 bg-violet-500/10 dark:bg-violet-500/10 rounded-2xl text-violet-600 dark:text-violet-400">
              <Lightbulb className="h-5 sm:h-6 w-5 sm:w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Main Split Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-5 landscape:lg:grid-cols-5 gap-6">
        {/* Left Column: Urgent tasks (3 columns wide) */}
        <div className="xl:col-span-3 landscape:lg:col-span-3 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Bell className="h-5 w-5 text-neutral-500" />
              <span>Tareas Pendientes Críticas</span>
            </h4>
            {stats.pendingTasks > urgentTasks.length && (
              <Button 
                variant="link" 
                size="sm" 
                className="text-sm font-semibold text-neutral-500 hover:text-emerald-500 p-0 h-auto"
                onClick={() => onNavigateToSection('projects')}
              >
                <span>Ver todos</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>

          {urgentTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 border border-neutral-200 dark:border-neutral-800 bg-white/30 dark:bg-neutral-900/20 rounded-2xl text-center gap-3 h-[260px]">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-850 dark:text-neutral-100">¡Al día con tus pendientes!</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">No tienes tareas vencidas ni próximas a vencer.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {urgentTasks.map(task => {
                const isOverdue = task.daysDiff < 0;
                return (
                  <Card 
                    key={task.id}
                    className="border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/20 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/30 transition-colors shadow-sm cursor-pointer rounded-xl"
                    onClick={() => onNavigateToSection('projects', task.project_id)}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide truncate">
                          {task.projectName}
                        </span>
                        <h5 className="font-bold text-sm text-neutral-900 dark:text-neutral-50 truncate pr-2">
                          {task.title}
                        </h5>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <Badge 
                          variant="outline" 
                          className={`text-xs font-bold py-1 px-2.5 select-none shadow-none uppercase rounded-md ${
                            isOverdue
                              ? 'border-red-200 dark:border-red-950 bg-red-500/10 text-red-600 dark:text-red-400'
                              : 'border-amber-250 dark:border-amber-950 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isOverdue ? 'Vencido' : 'Vence pronto'}
                        </Badge>
                        <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-neutral-400" />
                          <span>{new Date(`${task.estimated_date}T00:00:00`).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Recent ideas (2 columns wide) */}
        <div className="xl:col-span-2 landscape:lg:col-span-2 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-neutral-500" />
              <span>Ideas Recientes</span>
            </h4>
            {stats.ideasCount > 3 && (
              <Button 
                variant="link" 
                size="sm" 
                className="text-sm font-semibold text-neutral-500 hover:text-emerald-500 p-0 h-auto"
                onClick={() => onNavigateToSection('ideas')}
              >
                <span>Ver todas</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>

          {recentIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 border border-neutral-200 dark:border-neutral-800 bg-white/30 dark:bg-neutral-900/20 rounded-2xl text-center gap-3 h-[260px]">
              <Lightbulb className="h-9 w-9 text-neutral-400 dark:text-neutral-500" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-850 dark:text-neutral-100">Banco de ideas vacío</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">¿Tienes un pensamiento rápido? Anótalo.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentIdeas.map(idea => (
                <Card 
                  key={idea.id}
                  className="border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/20 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/30 transition-colors shadow-sm cursor-pointer select-none rounded-xl"
                  onClick={() => onNavigateToSection('ideas')}
                >
                  <CardContent className="p-4 flex flex-col gap-2">
                    <h5 className="font-bold text-sm text-neutral-900 dark:text-neutral-50 truncate">
                      {idea.title}
                    </h5>
                    <div className="space-y-1 overflow-hidden pr-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                      {renderIdeaPreview(idea.content)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
