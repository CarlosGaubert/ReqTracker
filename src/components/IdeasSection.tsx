import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Lightbulb, Calendar } from 'lucide-react';
import { db, Idea } from '../services/db';

interface IdeasSectionProps {
  onDataChange: () => void;
  refreshTrigger: number;
}

export const IdeasSection: React.FC<IdeasSectionProps> = ({ onDataChange, refreshTrigger }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const loadIdeas = () => {
    const list = db.getIdeas();
    // Sort: newest first
    const sorted = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setIdeas(sorted);
  };

  useEffect(() => {
    loadIdeas();
  }, [refreshTrigger]);

  const handleOpenCreateModal = () => {
    setEditingIdea(null);
    setTitle('');
    setContent('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (idea: Idea, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIdea(idea);
    setTitle(idea.title);
    setContent(idea.content);
    setIsModalOpen(true);
  };

  const handleSaveIdea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;

    if (editingIdea) {
      // Editing
      const updated: Idea = {
        ...editingIdea,
        title: title.trim() || 'Sin Título',
        content: content.trim(),
      };
      db.saveIdea(updated);
    } else {
      // Creating
      const newIdea: Idea = {
        id: crypto.randomUUID(),
        title: title.trim() || 'Sin Título',
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      db.saveIdea(newIdea);
    }

    setTitle('');
    setContent('');
    setIsModalOpen(false);
    setEditingIdea(null);
    onDataChange();
    loadIdeas();
  };

  const handleDeleteIdea = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que quieres eliminar esta idea?')) {
      db.deleteIdea(id);
      onDataChange();
      loadIdeas();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div className="flex-between">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Banco de Ideas</h2>
          <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Anota tus pensamientos rápidos, ideas de proyectos o notas importantes aquí.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          <Plus size={18} />
          <span>Nueva Idea</span>
        </button>
      </div>

      <div style={{ borderBottom: '1px solid var(--border-color)', margin: '0.25rem 0' }}></div>

      {ideas.length === 0 ? (
        <div className="empty-state" style={{ flex: 1, justifyContent: 'center' }}>
          <Lightbulb className="empty-state-icon" size={48} />
          <h3>¿Tienes alguna idea nueva?</h3>
          <p>Tu banco de ideas está vacío. Anota algo rápido para que no se te olvide.</p>
        </div>
      ) : (
        <div className="ideas-grid" style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem', paddingBottom: '2rem' }}>
          {ideas.map(idea => (
            <div key={idea.id} className="card idea-card" onClick={(e) => handleOpenEditModal(idea, e)} style={{ cursor: 'pointer' }}>
              <div className="idea-card-header">
                <h3 className="idea-title">{idea.title}</h3>
                <div style={{ display: 'flex', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    style={{ padding: '0.25rem' }}
                    onClick={(e) => handleOpenEditModal(idea, e)}
                    title="Editar idea"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    className="btn-icon"
                    style={{ padding: '0.25rem' }}
                    onClick={(e) => handleDeleteIdea(idea.id, e)}
                    title="Eliminar idea"
                  >
                    <Trash2 size={14} style={{ color: 'var(--accent-red)' }} />
                  </button>
                </div>
              </div>
              <p className="idea-content">{idea.content}</p>
              <div className="flex-row text-muted" style={{ fontSize: '0.7rem', marginTop: 'auto' }}>
                <Calendar size={12} />
                <span>{new Date(idea.created_at).toLocaleDateString()} {new Date(idea.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for creating/editing idea */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingIdea ? 'Editar Idea' : 'Nueva Idea'}</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveIdea}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="idea-title">Título de la Idea</label>
                  <input
                    type="text"
                    id="idea-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. App de recetas, API en Rust, etc. (Opcional)"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="idea-content">Contenido / Notas</label>
                  <textarea
                    id="idea-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Escribe tus ideas detalladamente aquí..."
                    rows={8}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingIdea ? 'Guardar Cambios' : 'Guardar Idea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
