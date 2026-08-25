import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Folder, Calendar } from 'lucide-react';
import { db, Project } from '../services/db';
import { RequirementsSection } from './RequirementsSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    if (list.length > 0 && !selectedProjectId) {
      setSelectedProjectId(list[0].id);
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
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    db.deleteProject(id);
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
    }
    onDataChange();
    loadProjects();
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="flex h-full w-full overflow-hidden gap-4">
      {/* Left panel: List of projects */}
      <div className="w-[320px] flex-shrink-0 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-950/20 p-4 rounded-xl flex flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Proyectos</h3>
          <Button 
            size="sm" 
            className="h-8 gap-1"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo</span>
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg text-center gap-3">
            <Folder className="h-8 w-8 text-neutral-400 dark:text-neutral-500" />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">No tienes proyectos registrados.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {projects.map(project => (
              <Card
                key={project.id}
                className={`group cursor-pointer transition-all duration-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40 border shadow-none select-none relative ${
                  selectedProjectId === project.id 
                    ? 'border-emerald-500/50 bg-emerald-50/5 dark:bg-emerald-950/5' 
                    : 'border-neutral-200 dark:border-neutral-800 bg-transparent'
                }`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <CardContent className="p-3.5 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`font-semibold text-sm truncate pr-4 ${
                      selectedProjectId === project.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-800 dark:text-neutral-250'
                    }`}>
                      {project.name}
                    </h4>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-6 w-6 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      title="Eliminar proyecto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {project.description && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: Project Details */}
      <div className="flex-1 flex flex-col overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-950/20 p-4 rounded-xl">
        {selectedProject ? (
          <RequirementsSection
            project={selectedProject}
            onDataChange={onDataChange}
            refreshTrigger={refreshTrigger}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="p-4 bg-neutral-100 dark:bg-neutral-900 rounded-full text-neutral-400 dark:text-neutral-500">
              <Folder className="h-10 w-10" />
            </div>
            <div className="max-w-[420px] space-y-1.5">
              <h3 className="font-semibold text-lg text-neutral-800 dark:text-neutral-200">Selecciona un Proyecto</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Selecciona un proyecto de la lista izquierda o crea uno nuevo para empezar a gestionar sus requerimientos y tareas.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal for creating project */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Nuevo Proyecto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-name" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Nombre del Proyecto
              </Label>
              <Input
                id="p-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ej. Rediseño de Web, Migración de Base de Datos"
                required
                autoFocus
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Descripción (Opcional)
              </Label>
              <Textarea
                id="p-desc"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="Añade un breve resumen de los objetivos de este proyecto..."
                rows={3}
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 resize-none"
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Crear Proyecto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
