import React, { useEffect, useState } from 'react';
import { FolderKanban, Lightbulb, Settings, RefreshCw, Sun, Moon, Layers, Search, Zap } from 'lucide-react';
import { db } from '../services/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface SidebarProps {
  activeSection: 'dashboard' | 'challenge' | 'projects' | 'ideas' | 'settings';
  setActiveSection: (section: 'dashboard' | 'challenge' | 'projects' | 'ideas' | 'settings') => void;
  onSync: () => void;
  isSyncing: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onOpenSearch: () => void;
  urgentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  setActiveSection,
  onSync,
  isSyncing,
  theme,
  toggleTheme,
  onOpenSearch,
  urgentCount,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const isDbConnected = !!db.getSupabaseClient();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <aside className="w-[260px] border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex flex-col h-full transition-colors duration-200">
      {/* App Header */}
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
        <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-bold text-xl tracking-tight">
          <FolderKanban className="h-6 w-6" />
          <span>ReqTracker</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex flex-col gap-1.5 p-4 flex-1">
        
        {/* Search Command Input Button */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3 py-2 text-xs font-semibold transition-colors text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-850 bg-neutral-100/50 dark:bg-neutral-900/10 rounded-lg mt-0.5 mb-2.5 shadow-none"
          onClick={onOpenSearch}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left text-neutral-400 dark:text-neutral-500">Buscar comando...</span>
          <kbd className="pointer-events-none inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1 font-mono text-[9px] font-medium text-neutral-450 dark:text-neutral-500 shadow-none">
            {navigator.userAgent.indexOf('Mac') !== -1 ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </Button>

        {/* Dashboard Link */}
        <Button
          variant={activeSection === 'dashboard' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium transition-colors relative ${
            activeSection === 'dashboard' 
              ? 'bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-50' 
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50'
          }`}
          onClick={() => setActiveSection('dashboard')}
        >
          <Layers className="h-4 w-4" />
          <span>Inicio</span>
          {urgentCount > 0 && (
            <span className="absolute right-3.5 top-3.5 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          )}
        </Button>

        {/* Challenge Link */}
        <Button
          variant={activeSection === 'challenge' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium transition-colors ${
            activeSection === 'challenge' 
              ? 'bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-50' 
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50'
          }`}
          onClick={() => setActiveSection('challenge')}
        >
          <Zap className="h-4 w-4" />
          <span>Desafío Focus</span>
        </Button>

        {/* Projects Link */}
        <Button
          variant={activeSection === 'projects' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium transition-colors ${
            activeSection === 'projects' 
              ? 'bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-50' 
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50'
          }`}
          onClick={() => setActiveSection('projects')}
        >
          <FolderKanban className="h-4 w-4" />
          <span>Proyectos</span>
        </Button>

        {/* Ideas Link */}
        <Button
          variant={activeSection === 'ideas' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium transition-colors ${
            activeSection === 'ideas' 
              ? 'bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-50' 
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50'
          }`}
          onClick={() => setActiveSection('ideas')}
        >
          <Lightbulb className="h-4 w-4" />
          <span>Ideas</span>
        </Button>

        {/* Settings Link */}
        <Button
          variant={activeSection === 'settings' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium transition-colors ${
            activeSection === 'settings' 
              ? 'bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-50' 
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50'
          }`}
          onClick={() => setActiveSection('settings')}
        >
          <Settings className="h-4 w-4" />
          <span>Ajustes & Sync</span>
        </Button>
      </nav>

      {/* Sidebar Footer (Theme, Sync & Connection status) */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {theme === 'dark' ? 'Tema Oscuro' : 'Tema Claro'}
          </span>
          <Button 
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
            onClick={toggleTheme} 
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <Card className="border border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 p-3 shadow-none select-none">
          <CardContent className="p-0 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400 font-medium font-sans">Conexión</span>
              <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 font-medium">
                <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
              </div>
            </div>
            
            <Separator className="bg-neutral-200 dark:bg-neutral-850" />
            
            {isDbConnected ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Nube Conectada</span>
                </div>
                <Button 
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs justify-center gap-1.5 mt-1 border-neutral-350 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
                  onClick={onSync}
                  disabled={isSyncing || !isOnline}
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando' : 'Sincronizar'}</span>
                </Button>
              </div>
            ) : (
              <div className="text-xs text-neutral-400 dark:text-neutral-550 font-medium">
                Modo Local (Sin sincronizar)
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </aside>
  );
};
