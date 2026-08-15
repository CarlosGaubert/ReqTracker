import React, { useEffect, useState } from 'react';
import { FolderKanban, Lightbulb, Settings, RefreshCw, Sun, Moon } from 'lucide-react';

interface SidebarProps {
  activeSection: 'projects' | 'ideas' | 'settings';
  setActiveSection: (section: 'projects' | 'ideas' | 'settings') => void;
  userEmail: string | null;
  onSync: () => void;
  isSyncing: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  setActiveSection,
  userEmail,
  onSync,
  isSyncing,
  theme,
  toggleTheme,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <FolderKanban size={24} />
          <span>ReqTracker</span>
        </div>
      </div>

      <nav className="sidebar-menu">
        <button
          className={`menu-item ${activeSection === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveSection('projects')}
        >
          <FolderKanban size={18} />
          <span>Proyectos</span>
        </button>

        <button
          className={`menu-item ${activeSection === 'ideas' ? 'active' : ''}`}
          onClick={() => setActiveSection('ideas')}
        >
          <Lightbulb size={18} />
          <span>Ideas</span>
        </button>

        <button
          className={`menu-item ${activeSection === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveSection('settings')}
        >
          <Settings size={18} />
          <span>Ajustes & Sync</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="theme-toggle-row">
          <span className="theme-toggle-label">
            {theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}
          </span>
          <button 
            className="btn-icon" 
            onClick={toggleTheme} 
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="sync-status-card">
          <div className="sync-status-header">
            <span>Conexión</span>
            <div className="status-indicator">
              <span className={`status-dot ${isOnline ? 'online' : ''}`}></span>
              <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
            </div>
          </div>
          {userEmail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div className="sync-user" title={userEmail}>
                {userEmail}
              </div>
              <button 
                className="btn" 
                style={{ padding: '0.4rem', fontSize: '0.75rem', marginTop: '0.25rem', width: '100%', justifyContent: 'center' }}
                onClick={onSync}
                disabled={isSyncing || !isOnline}
              >
                <RefreshCw size={12} className={isSyncing ? 'spin-animation' : ''} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
            </div>
          ) : (
            <div className="text-muted" style={{ fontSize: '0.8rem' }}>
              Modo Local (Sin sincronizar)
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
