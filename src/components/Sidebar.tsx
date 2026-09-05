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
  lastSyncedAt?: number | null;
  syncInterval?: number;
}

const formatSidebarTime = (timestamp?: number | null) => {
  if (!timestamp) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 10) return 'hace instantes';
  if (diffSec < 60) return `hace ${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `hace ${mins}m`;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  setActiveSection,
  onSync,
  isSyncing,
  theme,
  toggleTheme,
  onOpenSearch,
  urgentCount,
  lastSyncedAt,
  syncInterval = 30,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [, setTick] = useState(0);
  const isDbConnected = !!db.getSupabaseClient();

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

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
    <aside className="w-[270px] border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex flex-col h-full transition-colors duration-200 select-none">
      {/* App Header with Logo */}
      <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
        <img src="/app-icon.png" alt="ReqTracker Logo" className="h-8 w-8 rounded-lg shadow-sm object-contain flex-shrink-0" />
        <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xl tracking-tight leading-none">
          ReqTracker
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex flex-col gap-1.5 p-3.5 flex-1">
        
        {/* Search Command Input Button */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 px-3.5 py-2.5 text-sm font-semibold transition-colors text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/40 rounded-xl mt-0.5 mb-2.5 shadow-none"
          onClick={onOpenSearch}
        >
          <Search className="h-4 w-4 text-neutral-500" />
          <span className="flex-1 text-left text-neutral-500 dark:text-neutral-400">Buscar comando...</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1.5 font-mono text-xs font-semibold text-neutral-500 dark:text-neutral-400 shadow-none">
            {navigator.userAgent.indexOf('Mac') !== -1 ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </Button>

        {/* Dashboard Link */}
        <Button
          variant={activeSection === 'dashboard' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3.5 py-2.5 text-[0.95rem] font-semibold transition-colors rounded-xl relative ${
            activeSection === 'dashboard' 
              ? 'bg-neutral-200/70 dark:bg-neutral-800/70 text-neutral-950 dark:text-neutral-50 shadow-sm' 
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-900'
          }`}
          onClick={() => setActiveSection('dashboard')}
        >
          <Layers className="h-4.5 w-4.5" />
          <span>Inicio</span>
          {urgentCount > 0 && (
            <span className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
          )}
        </Button>

        {/* Challenge Link */}
        <Button
          variant={activeSection === 'challenge' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3.5 py-2.5 text-[0.95rem] font-semibold transition-colors rounded-xl ${
            activeSection === 'challenge' 
              ? 'bg-neutral-200/70 dark:bg-neutral-800/70 text-neutral-950 dark:text-neutral-50 shadow-sm' 
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-900'
          }`}
          onClick={() => setActiveSection('challenge')}
        >
          <Zap className="h-4.5 w-4.5 text-amber-500 dark:text-amber-400" />
          <span>Desafío Focus</span>
        </Button>

        {/* Projects Link */}
        <Button
          variant={activeSection === 'projects' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3.5 py-2.5 text-[0.95rem] font-semibold transition-colors rounded-xl ${
            activeSection === 'projects' 
              ? 'bg-neutral-200/70 dark:bg-neutral-800/70 text-neutral-950 dark:text-neutral-50 shadow-sm' 
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-900'
          }`}
          onClick={() => setActiveSection('projects')}
        >
          <FolderKanban className="h-4.5 w-4.5" />
          <span>Proyectos</span>
        </Button>

        {/* Ideas Link */}
        <Button
          variant={activeSection === 'ideas' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3.5 py-2.5 text-[0.95rem] font-semibold transition-colors rounded-xl ${
            activeSection === 'ideas' 
              ? 'bg-neutral-200/70 dark:bg-neutral-800/70 text-neutral-950 dark:text-neutral-50 shadow-sm' 
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-900'
          }`}
          onClick={() => setActiveSection('ideas')}
        >
          <Lightbulb className="h-4.5 w-4.5" />
          <span>Ideas</span>
        </Button>

        {/* Settings Link */}
        <Button
          variant={activeSection === 'settings' ? 'secondary' : 'ghost'}
          className={`w-full justify-start gap-3 px-3.5 py-2.5 text-[0.95rem] font-semibold transition-colors rounded-xl ${
            activeSection === 'settings' 
              ? 'bg-neutral-200/70 dark:bg-neutral-800/70 text-neutral-950 dark:text-neutral-50 shadow-sm' 
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-900'
          }`}
          onClick={() => setActiveSection('settings')}
        >
          <Settings className="h-4.5 w-4.5" />
          <span>Ajustes & Sync</span>
        </Button>
      </nav>

      {/* Sidebar Footer (Theme, Sync & Connection status) */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
            {theme === 'dark' ? 'Tema Oscuro' : 'Tema Claro'}
          </span>
          <Button 
            variant="ghost"
            size="icon"
            className="h-8.5 w-8.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-neutral-50"
            onClick={toggleTheme} 
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </Button>
        </div>

        <Card className="border border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-900/40 p-3.5 shadow-none select-none rounded-xl">
          <CardContent className="p-0 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400 font-semibold font-sans">Conexión</span>
              <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 font-semibold">
                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
              </div>
            </div>
            
            <Separator className="bg-neutral-200 dark:bg-neutral-800" />
            
            {isDbConnected ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Nube Conectada</span>
                  </div>
                  {syncInterval !== undefined && syncInterval > 0 ? (
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {syncInterval}s
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-neutral-400">
                      Manual
                    </span>
                  )}
                </div>

                {lastSyncedAt && (
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Sincronizado:</span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {formatSidebarTime(lastSyncedAt)}
                    </span>
                  </div>
                )}

                <Button 
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs font-semibold justify-center gap-1.5 mt-0.5 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 rounded-lg shadow-sm"
                  onClick={onSync}
                  disabled={isSyncing || !isOnline}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando' : 'Sincronizar'}</span>
                </Button>
              </div>
            ) : (
              <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                Modo Local (Sin sincronizar)
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </aside>
  );
};
