import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Folder, Calendar, PanelLeftClose } from 'lucide-react';
import { db, Project } from '../services/db';
import { RequirementsSection } from './RequirementsSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface ProjectsSectionProps {
  onDataChange: () => void;
  refreshTrigger: number;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  forceOpenNewProject: boolean;
  setForceOpenNewProject: (open: boolean) => void;
}

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ 
  onDataChange, 
  refreshTrigger,
  selectedProjectId,
  setSelectedProjectId,
  forceOpenNewProject,
  setForceOpenNewProject
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'details'>('details');
  const [isListPaneCollapsed, setIsListPaneCollapsed] = useState(false);

  useEffect(() => {
    if (forceOpenNewProject) {
      setIsModalOpen(true);
      setForceOpenNewProject(false);
    }
  }, [forceOpenNewProject]);
  
  // Form states
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  const loadProjects = () => {
    const list = db.getProjects();
    setProjects(list);
    if (list.length > 0) {
      if (!selectedProjectId || !list.some(p => p.id === selectedProjectId)) {
        setSelectedProjectId(list[0].id);
      }
    } else {
      setSelectedProjectId(null);
      setMobileView('list');
    }
  };

  useEffect(() => {
    loadProjects();
  }, [refreshTrigger]);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: projectName.trim(),
      description: projectDesc.trim(),
      created_at: new Date().toISOString(),
    };

    db.saveProject(newProject);
    setProjectName('');
    setProjectDesc('');
    setIsModalOpen(false);
    onDataChange();
    loadProjects();
    setSelectedProjectId(newProject.id);
    setMobileView('details');
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    db.deleteProject(id);
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
      setMobileView('list');
    }
    onDataChange();
    loadProjects();
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="flex h-full w-full overflow-hidden gap-4 lg:gap-5">
      {/* Left panel: List of projects (Master) */}
      <div className={`${
        isListPaneCollapsed
          ? 'hidden'
          : (mobileView === 'list' || !selectedProject ? 'flex w-full' : 'hidden lg:flex')
      } lg:w-72 xl:w-80 flex-shrink-0 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-3.5 sm:p-4.5 rounded-2xl flex-col gap-3.5 sm:gap-4 overflow-y-auto`}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Proyectos</h3>
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              className="h-8 sm:h-8.5 px-3 text-xs font-semibold gap-1.5 rounded-lg shadow-sm"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex h-8 w-8 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              onClick={() => setIsListPaneCollapsed(true)}
              title="Ocultar lista para maximizar espacio"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl text-center gap-3">
            <Folder className="h-9 w-9 text-neutral-400 dark:text-neutral-500" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">No tienes proyectos registrados.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 sm:gap-3">
            {projects.map(project => (
              <Card
                key={project.id}
                className={`group cursor-pointer transition-all duration-200 hover:bg-neutral-100/60 dark:hover:bg-neutral-900/50 border shadow-sm select-none relative rounded-xl ${
                  selectedProjectId === project.id 
                    ? 'border-emerald-500 bg-emerald-50/10 dark:bg-emerald-950/20' 
                    : 'border-neutral-200 dark:border-neutral-800 bg-white/40 dark:bg-transparent'
                }`}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setMobileView('details');
                }}
              >
                <CardContent className="p-3.5 sm:p-4 flex flex-col gap-1.5 sm:gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`font-bold text-sm truncate pr-5 ${
                      selectedProjectId === project.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-neutral-100'
                    }`}>
                      {project.name}
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2.5 top-2.5 h-6.5 w-6.5 rounded-md text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      title="Eliminar proyecto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {project.description && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                    <span>{formatDateDDMMYYYY(project.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: Project Details (Detail) */}
      <div className={`${
        mobileView === 'details' && selectedProject ? 'flex' : 'hidden lg:flex'
      } flex-1 flex-col overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-3.5 sm:p-5 rounded-2xl`}>
        {selectedProject ? (
          <RequirementsSection
            project={selectedProject}
            onDataChange={onDataChange}
            refreshTrigger={refreshTrigger}
            onBackToProjects={() => setMobileView('list')}
            onToggleListPane={() => setIsListPaneCollapsed(false)}
            isListPaneCollapsed={isListPaneCollapsed}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="p-4.5 bg-neutral-100 dark:bg-neutral-900 rounded-full text-neutral-400 dark:text-neutral-500">
              <Folder className="h-12 w-12 text-emerald-500/70" />
            </div>
            <div className="max-w-[420px] space-y-2">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">Selecciona un Proyecto</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Selecciona un proyecto de la lista izquierda o crea uno nuevo para empezar a gestionar sus requerimientos y tareas.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal for creating project */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px] max-w-[calc(100vw-2rem)] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Nuevo Proyecto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4.5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="p-name" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Nombre del Proyecto
              </Label>
              <Input
                id="p-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ej. Rediseño de Web, Migración de Base de Datos"
                required
                autoFocus
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 text-sm h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Descripción (Opcional)
              </Label>
              <Textarea
                id="p-desc"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="Añade un breve resumen de los objetivos de este proyecto..."
                rows={3}
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 resize-none text-sm rounded-xl"
              />
            </div>
            <DialogFooter className="pt-2 gap-2.5">
              <Button type="button" variant="outline" className="rounded-xl h-10 px-4 font-semibold" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl h-10 px-4 font-semibold shadow-sm">
                Crear Proyecto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
