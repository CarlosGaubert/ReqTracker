import React, { useEffect, useState } from 'react';
import { 
  FolderKanban, 
  Lightbulb, 
  Settings, 
  RefreshCw, 
  Sun, 
  Moon, 
  Layers, 
  Search, 
  Zap, 
  X, 
  PanelLeftClose, 
  PanelLeftOpen 
} from 'lucide-react';
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
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
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

  const handleNavClick = (section: 'dashboard' | 'challenge' | 'projects' | 'ideas' | 'settings') => {
    setActiveSection(section);
    if (onClose) {
      onClose();
    }
  };

  const menuItems = [
    {
      id: 'dashboard' as const,
      label: 'Inicio',
      icon: Layers,
      badge: urgentCount > 0,
    },
    {
      id: 'challenge' as const,
      label: 'Desafío Focus',
      icon: Zap,
      iconClass: 'text-amber-500 dark:text-amber-400',
    },
    {
      id: 'projects' as const,
      label: 'Proyectos',
      icon: FolderKanban,
    },
    {
      id: 'ideas' as const,
      label: 'Ideas',
      icon: Lightbulb,
    },
    {
      id: 'settings' as const,
      label: 'Ajustes & Sync',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 transition-all duration-300 ease-in-out select-none ${
          isOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full md:translate-x-0'
        } ${
          isCollapsed ? 'md:w-[72px]' : 'w-[270px]'
        }`}
      >
        {/* App Header with Logo & Toggles */}
        <div className={`p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <img src="/app-icon.png" alt="ReqTracker Logo" className="h-8 w-8 rounded-lg shadow-sm object-contain flex-shrink-0" />
            {!isCollapsed && (
              <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xl tracking-tight leading-none truncate">
                ReqTracker
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Toggle */}
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex h-8 w-8 text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50"
                onClick={onToggleCollapse}
                title={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
              >
                {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            )}

            {/* Mobile Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-50"
              onClick={onClose}
              title="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex flex-col gap-1.5 p-3 flex-1 overflow-y-auto">
          {/* Search Command Input Button */}
          <Button
            variant="ghost"
            className={`w-full text-sm font-semibold transition-colors text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-neutral-50 border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/40 rounded-xl mb-2 shadow-none ${
              isCollapsed ? 'justify-center px-0 py-2.5 h-10' : 'justify-start gap-3 px-3 py-2.5'
            }`}
            onClick={() => {
              onOpenSearch();
              if (onClose) onClose();
            }}
            title="Buscar comando (⌘K / Ctrl+K)"
          >
            <Search className="h-4 w-4 text-neutral-500 flex-shrink-0" />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left text-neutral-500 dark:text-neutral-400 truncate">Buscar comando...</span>
                <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1.5 font-mono text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 shadow-none">
                  {navigator.userAgent.indexOf('Mac') !== -1 ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </>
            )}
          </Button>

          {/* Nav Items */}
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <Button
                key={item.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className={`w-full font-semibold transition-colors rounded-xl relative ${
                  isCollapsed ? 'justify-center px-0 py-2.5 h-10' : 'justify-start gap-3 px-3.5 py-2.5 text-[0.95rem]'
                } ${
                  isActive
                    ? 'bg-neutral-200/70 dark:bg-neutral-800/70 text-neutral-950 dark:text-neutral-50 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                }`}
                onClick={() => handleNavClick(item.id)}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${item.iconClass || ''}`} />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {item.badge && (
                  <span className={`rounded-full bg-amber-500 animate-pulse ${
                    isCollapsed ? 'absolute top-2 right-2 h-2 w-2' : 'absolute right-3.5 top-3.5 h-2 w-2'
                  }`}></span>
                )}
              </Button>
            );
          })}
        </nav>

        {/* Sidebar Footer (Theme, Sync & Connection status) */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-3">
          {/* Theme Switcher */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
            {!isCollapsed && (
              <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                {theme === 'dark' ? 'Tema Oscuro' : 'Tema Claro'}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-neutral-50"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          {/* Sync & Connection Status */}
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <div
                className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-neutral-400'}`}
                title={isOnline ? 'En línea' : 'Sin conexión'}
              />
              {isDbConnected && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-neutral-600 dark:text-neutral-300 hover:text-emerald-500"
                  onClick={onSync}
                  disabled={isSyncing || !isOnline}
                  title="Sincronizar ahora"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-emerald-500' : ''}`} />
                </Button>
              )}
            </div>
          ) : (
            <Card className="border border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-900/40 p-3 shadow-none select-none rounded-xl">
              <CardContent className="p-0 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 font-semibold font-sans">Conexión</span>
                  <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200 font-semibold">
                    <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                    <span className="text-[11px]">{isOnline ? 'En línea' : 'Sin conexión'}</span>
                  </div>
                </div>

                <Separator className="bg-neutral-200 dark:bg-neutral-800" />

                {isDbConnected ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Nube Conectada</span>
                      </div>
                      {syncInterval !== undefined && syncInterval > 0 ? (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1 py-0.2 rounded">
                          {syncInterval}s
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-neutral-400">Manual</span>
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
                      className="w-full h-7.5 text-xs font-semibold justify-center gap-1.5 mt-0.5 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 rounded-lg shadow-sm"
                      onClick={onSync}
                      disabled={isSyncing || !isOnline}
                    >
                      <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Sincronizando' : 'Sincronizar'}</span>
                    </Button>
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                    Modo Local (Sin sincronizar)
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </aside>
    </>
  );
};
