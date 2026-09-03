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
const parseInlineMarkdown = (text: string): React.ReactNode => {
  const regex = /(\*\*.*?\*\*)|(`.*?`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  const parts: React.ReactNode[] = [];

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const [, bold, code] = match;
    if (bold) {
      parts.push(<strong key={key++} className="font-bold text-neutral-850 dark:text-neutral-100">{bold.slice(2, -2)}</strong>);
    } else if (code) {
      parts.push(<code key={key++} className="bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded text-[10px] font-mono text-emerald-600 dark:text-emerald-450">{code.slice(1, -1)}</code>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
};

const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    
    // Checkboxes
    if (trimmed.startsWith('[x] ') || trimmed.startsWith('[ ] ')) {
      const checked = trimmed.startsWith('[x] ');
      return (
        <div key={idx} className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
          <input 
            type="checkbox" 
            checked={checked} 
            readOnly 
            className="h-3 w-3 rounded border-neutral-300 dark:border-neutral-700 pointer-events-none accent-emerald-500 opacity-80" 
          />
          <span className={checked ? 'line-through opacity-60' : ''}>
            {parseInlineMarkdown(trimmed.substring(4))}
          </span>
        </div>
      );
    }

    // Bullets
    if (trimmed.startsWith('- ')) {
      return (
        <li key={idx} className="list-disc list-inside text-neutral-500 dark:text-neutral-400 pl-1">
          {parseInlineMarkdown(trimmed.substring(2))}
        </li>
      );
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      return <h1 key={idx} className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mt-1 mb-0.5">{parseInlineMarkdown(trimmed.substring(2))}</h1>;
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={idx} className="text-xs font-bold text-neutral-800 dark:text-neutral-200 mt-1 mb-0.5">{parseInlineMarkdown(trimmed.substring(3))}</h2>;
    }

    return (
      <div key={idx} className="min-h-[1rem] text-neutral-500 dark:text-neutral-400">
        {parseInlineMarkdown(line)}
      </div>
    );
  });
};
interface IdeasSectionProps {
  onDataChange: () => void;
  refreshTrigger: number;
  forceOpenNewIdea: boolean;
  setForceOpenNewIdea: (open: boolean) => void;
}

export const IdeasSection: React.FC<IdeasSectionProps> = ({ 
  onDataChange, 
  refreshTrigger,
  forceOpenNewIdea,
  setForceOpenNewIdea
}) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (forceOpenNewIdea) {
      setTitle('');
      setContent('');
      setEditingIdea(null);
      setIsModalOpen(true);
      setForceOpenNewIdea(false);
    }
  }, [forceOpenNewIdea]);

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
    <div className="flex flex-col gap-4.5 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 font-sans">Banco de Ideas</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
            Anota tus pensamientos rápidos, ideas de proyectos o notas importantes aquí.
          </p>
        </div>
        <Button size="sm" className="h-9.5 px-4 text-sm font-semibold gap-2 rounded-xl shadow-sm" onClick={handleOpenCreateModal}>
          <Plus className="h-4.5 w-4.5" />
          <span>Nueva Idea</span>
        </Button>
      </div>

      <Separator className="bg-neutral-200 dark:bg-neutral-800 my-1" />

      {ideas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
          <div className="p-4.5 bg-neutral-100 dark:bg-neutral-900 rounded-full text-neutral-400 dark:text-neutral-500">
            <Lightbulb className="h-12 w-12 text-violet-500/70" />
          </div>
          <div className="max-w-[340px] space-y-1.5">
            <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">¿Tienes alguna idea nueva?</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Tu banco de ideas está vacío. Anota algo rápido para que no se te olvide.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 overflow-y-auto pr-1 pb-8">
          {ideas.map(idea => (
            <Card 
              key={idea.id} 
              className="group cursor-pointer transition-all duration-200 hover:bg-neutral-100/60 dark:hover:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/30 flex flex-col shadow-sm relative min-h-[200px] select-none rounded-2xl"
              onClick={(e) => handleOpenEditModal(idea, e)}
            >
              <CardContent className="p-4.5 flex flex-col h-full gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base truncate pr-12 text-neutral-900 dark:text-neutral-50">{idea.title}</h3>
                  <div 
                    className="absolute right-3 top-3 flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60"
                      onClick={(e) => handleOpenEditModal(idea, e)}
                      title="Editar idea"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                      onClick={(e) => handleDeleteIdea(idea.id, e)}
                      title="Eliminar idea"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-sm leading-relaxed overflow-hidden break-words select-text line-clamp-4 flex-1 space-y-1 text-neutral-700 dark:text-neutral-300">
                  {renderMarkdown(idea.content)}
                </div>
                
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 font-medium mt-auto select-none">
                  <Calendar className="h-3.5 w-3.5 text-neutral-400" />
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
        <DialogContent className="sm:max-w-[540px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {editingIdea ? 'Editar Idea' : 'Nueva Idea'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveIdea} className="space-y-4.5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="idea-title" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Título de la Idea
              </Label>
              <Input
                id="idea-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. App de recetas, API en Rust, etc. (Opcional)"
                autoFocus
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 text-sm h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idea-content" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
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
