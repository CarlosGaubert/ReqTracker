import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Folder, Calendar } from 'lucide-react';
import { db, Project } from '../services/db';
import { RequirementsSection } from './RequirementsSection';

interface ProjectsSectionProps {
  onDataChange: () => void;
  refreshTrigger: number;
}

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ onDataChange, refreshTrigger }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form states
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  const loadProjects = () => {
    const list = db.getProjects();
    setProjects(list);
    // If no project is selected but we have projects, select the first one by default
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
      name: projectName,
      description: projectDesc,
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
    if (confirm('¿Estás seguro de que quieres eliminar este proyecto? Esto borrará todos sus requerimientos asociados.')) {
      db.deleteProject(id);
      if (selectedProjectId === id) {
        setSelectedProjectId(null);
      }
      onDataChange();
      loadProjects();
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="projects-layout">
      {/* Left panel: List of projects */}
      <div className="projects-list-pane">
        <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Tus Proyectos</h3>
          <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem' }} onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            <span>Nuevo</span>
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <Folder className="empty-state-icon" size={32} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>No tienes proyectos registrados.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {projects.map(project => (
              <div
                key={project.id}
                className={`card project-card ${selectedProjectId === project.id ? 'active' : ''}`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <div className="project-card-header">
                  <h4 className="project-name">{project.name}</h4>
                  <button
                    className="btn-icon"
                    style={{ padding: '0.2rem' }}
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    title="Eliminar proyecto"
                  >
                    <Trash2 size={14} style={{ color: 'var(--accent-red)' }} />
                  </button>
                </div>
                {project.description && <p className="project-desc">{project.description}</p>}
                <div className="flex-row text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  <Calendar size={12} />
                  <span>{new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: Project Requirements */}
      <div className="project-details-pane">
        {selectedProject ? (
          <RequirementsSection
            project={selectedProject}
            onDataChange={onDataChange}
            refreshTrigger={refreshTrigger}
          />
        ) : (
          <div className="empty-state" style={{ height: '70%', justifyContent: 'center' }}>
            <Folder className="empty-state-icon" size={48} />
            <h2>Selecciona un Proyecto</h2>
            <p>Selecciona un proyecto del panel izquierdo o crea uno nuevo para ver y gestionar sus requerimientos.</p>
          </div>
        )}
      </div>

      {/* Modal for creating project */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nuevo Proyecto</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="p-name">Nombre del Proyecto</label>
                  <input
                    type="text"
                    id="p-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Ej. Rediseño de Web, Migración de Base de Datos"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="p-desc">Descripción (Opcional)</label>
                  <textarea
                    id="p-desc"
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    placeholder="Añade un breve resumen de los objetivos de este proyecto..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
