import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Folder, Lightbulb, Settings, ToggleLeft, RefreshCw, Layers, Zap } from 'lucide-react';
import { db } from '../services/db';
import { Badge } from '@/components/ui/badge';
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: 'dashboard' | 'challenge' | 'projects' | 'ideas' | 'settings', projectId?: string | null) => void;
  onTriggerAction: (action: 'new-project' | 'new-idea' | 'toggle-theme' | 'sync') => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Acciones' | 'Proyectos' | 'Ideas';
  icon: React.ReactNode;
  handler: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onTriggerAction,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [items, setItems] = useState<CommandItem[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Load and filter items
  useEffect(() => {
    if (!isOpen) return;

    const query = search.trim().toLowerCase();

    // 1. Static Actions
    const staticActions: CommandItem[] = [
      {
        id: 'nav-dashboard',
        title: 'Ir a Inicio (Dashboard)',
        category: 'Acciones',
        icon: <Layers className="h-4 w-4 text-neutral-450 dark:text-neutral-500" />,
        handler: () => onNavigate('dashboard'),
      },
      {
        id: 'nav-challenge',
        title: 'Ir a Desafío Focus (Pomodoro)',
        category: 'Acciones',
        icon: <Zap className="h-4 w-4 text-emerald-500" />,
        handler: () => onNavigate('challenge'),
      },
      {
        id: 'nav-projects',
        title: 'Ir a Proyectos',
        category: 'Acciones',
        icon: <Folder className="h-4 w-4 text-neutral-450 dark:text-neutral-500" />,
        handler: () => onNavigate('projects'),
      },
      {
        id: 'nav-ideas',
        title: 'Ir a Banco de Ideas',
        category: 'Acciones',
        icon: <Lightbulb className="h-4 w-4 text-neutral-450 dark:text-neutral-500" />,
        handler: () => onNavigate('ideas'),
      },
      {
        id: 'nav-settings',
        title: 'Ir a Ajustes & Sync',
        category: 'Acciones',
        icon: <Settings className="h-4 w-4 text-neutral-450 dark:text-neutral-500" />,
        handler: () => onNavigate('settings'),
      },
      {
        id: 'action-project',
        title: 'Nuevo Proyecto...',
        category: 'Acciones',
        icon: <Sparkles className="h-4 w-4 text-emerald-500" />,
        handler: () => onTriggerAction('new-project'),
      },
      {
        id: 'action-idea',
        title: 'Nueva Idea / Nota...',
        category: 'Acciones',
        icon: <Sparkles className="h-4 w-4 text-violet-500" />,
        handler: () => onTriggerAction('new-idea'),
      },
      {
        id: 'action-theme',
        title: 'Alternar Tema Claro/Oscuro',
        category: 'Acciones',
        icon: <ToggleLeft className="h-4 w-4 text-neutral-450 dark:text-neutral-500" />,
        handler: () => onTriggerAction('toggle-theme'),
      },
      {
        id: 'action-sync',
        title: 'Sincronizar ahora con Supabase',
        category: 'Acciones',
        icon: <RefreshCw className="h-4 w-4 text-neutral-450 dark:text-neutral-500" />,
        handler: () => onTriggerAction('sync'),
      },
    ];

    // Filter actions
    const filteredActions = staticActions.filter(item => 
      item.title.toLowerCase().includes(query)
    );

    // 2. Fetch Projects
    const projects = db.getProjects();
    const filteredProjects: CommandItem[] = projects
      .filter(p => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query)))
      .map(p => ({
        id: `project-${p.id}`,
        title: `Abrir Proyecto: ${p.name}`,
        category: 'Proyectos',
        icon: <Folder className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
        handler: () => onNavigate('projects', p.id),
      }));

    // 3. Fetch Ideas
    const ideas = db.getIdeas();
    const filteredIdeas: CommandItem[] = ideas
      .filter(i => i.title.toLowerCase().includes(query) || i.content.toLowerCase().includes(query))
      .map(i => ({
        id: `idea-${i.id}`,
        title: `Ver Nota: ${i.title}`,
        category: 'Ideas',
        icon: <Lightbulb className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
        handler: () => onNavigate('ideas'),
      }));

    // Merge lists
    const combined = [...filteredActions, ...filteredProjects, ...filteredIdeas];
    setItems(combined);
    
    // Reset selection index
    setSelectedIndex(prev => Math.min(prev, Math.max(0, combined.length - 1)));
  }, [search, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].handler();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex]);

  // Close when clicking outside dialog
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (overlayRef.current === e.target) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Group items by category for rendering
  const categories = Array.from(new Set(items.map(item => item.category)));

  // Global tracker for index highlighting
  let globalItemIndex = 0;

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-[8vh] sm:pt-[15vh] backdrop-blur-[2px] p-2.5 sm:p-4 select-none animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 w-full max-w-[580px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[480px] animate-in zoom-in-95 slide-in-from-top-4 duration-200">
        
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 px-3.5 sm:px-5 border-b border-neutral-200 dark:border-neutral-800 h-12 sm:h-14 flex-shrink-0">
          <Search className="h-4 sm:h-5 w-4 sm:w-5 text-neutral-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca comandos, proyectos o notas..."
            className="w-full bg-transparent border-none text-sm sm:text-base font-medium text-neutral-900 dark:text-neutral-50 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-0 py-2 sm:py-2.5"
          />
          <Badge variant="outline" className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 select-none shadow-none font-semibold h-5 sm:h-6 px-1.5 sm:px-2 rounded-md flex-shrink-0">
            ESC
          </Badge>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-2.5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400 dark:text-neutral-500 gap-2">
              <Search className="h-9 w-9 text-neutral-300 dark:text-neutral-600" />
              <p className="text-sm font-medium">No se encontraron resultados para "{search}"</p>
            </div>
          ) : (
            categories.map(cat => {
              const categoryItems = items.filter(item => item.category === cat);
              return (
                <div key={cat} className="mb-3.5 last:mb-1">
                  {/* Category Title */}
                  <h5 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-3 mb-1.5 select-none">
                    {cat}
                  </h5>

                  {/* Category Items */}
                  <div className="flex flex-col gap-1">
                    {categoryItems.map(item => {
                      const currentGlobalIndex = globalItemIndex++;
                      const isHighlighted = selectedIndex === currentGlobalIndex;

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 px-3.5 py-2.5 text-sm rounded-xl cursor-pointer transition-colors duration-150 ${
                            isHighlighted
                              ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-950 dark:text-neutral-50 font-bold shadow-sm'
                              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900/40'
                          }`}
                          onClick={() => {
                            item.handler();
                            onClose();
                          }}
                        >
                          <div className={`p-1.5 rounded-lg ${
                            isHighlighted 
                              ? 'bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 shadow-sm' 
                              : 'bg-neutral-100/60 dark:bg-neutral-900/40 border border-transparent'
                          }`}>
                            {item.icon}
                          </div>
                          <span className="flex-1 truncate font-semibold">{item.title}</span>
                          {isHighlighted && (
                            <span className="text-xs text-neutral-400 dark:text-neutral-500 font-bold select-none">
                              Enter ↵
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
