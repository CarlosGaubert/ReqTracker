import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Lightbulb, Calendar } from 'lucide-react';
import { db, Idea } from '../services/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

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
      const updated: Idea = {
        ...editingIdea,
        title: title.trim() || 'Sin Título',
        content: content.trim(),
      };
      db.saveIdea(updated);
    } else {
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
    db.deleteIdea(id);
    onDataChange();
    loadIdeas();
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-800 dark:text-neutral-50 font-sans">Banco de Ideas</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
            Anota tus pensamientos rápidos, ideas de proyectos o notas importantes aquí.
          </p>
        </div>
        <Button size="sm" className="h-9 gap-1.5" onClick={handleOpenCreateModal}>
          <Plus className="h-4.5 w-4.5" />
          <span>Nueva Idea</span>
        </Button>
      </div>

      <Separator className="bg-neutral-200 dark:bg-neutral-800 my-1" />

      {ideas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
          <div className="p-4 bg-neutral-100 dark:bg-neutral-900 rounded-full text-neutral-400 dark:text-neutral-500">
            <Lightbulb className="h-10 w-10" />
          </div>
          <div className="max-w-[320px] space-y-1.5">
            <h3 className="font-semibold text-base text-neutral-800 dark:text-neutral-200">¿Tienes alguna idea nueva?</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Tu banco de ideas está vacío. Anota algo rápido para que no se te olvide.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pr-1 pb-8">
          {ideas.map(idea => (
            <Card 
              key={idea.id} 
              className="group cursor-pointer transition-all duration-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/10 flex flex-col shadow-none relative h-[180px] select-none"
              onClick={(e) => handleOpenEditModal(idea, e)}
            >
              <CardContent className="p-4 flex flex-col h-full gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm truncate pr-12 text-neutral-800 dark:text-neutral-50">{idea.title}</h3>
                  <div 
                    className="absolute right-2 top-2 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
                      onClick={(e) => handleOpenEditModal(idea, e)}
                      title="Editar idea"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
                      onClick={(e) => handleDeleteIdea(idea.id, e)}
                      title="Eliminar idea"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed overflow-hidden break-words select-text line-clamp-4 flex-1">
                  {idea.content}
                </p>
                
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-neutral-500 font-medium mt-auto select-none">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date(idea.created_at).toLocaleDateString()} {new Date(idea.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal for creating/editing idea */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">
              {editingIdea ? 'Editar Idea' : 'Nueva Idea'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveIdea} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="idea-title" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Título de la Idea
              </Label>
              <Input
                id="idea-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. App de recetas, API en Rust, etc. (Opcional)"
                autoFocus
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idea-content" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Contenido / Notas
              </Label>
              <Textarea
                id="idea-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribe tus ideas detalladamente aquí..."
                rows={6}
                required
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 resize-none"
              />
            </div>
            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingIdea ? 'Guardar Cambios' : 'Guardar Idea'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
