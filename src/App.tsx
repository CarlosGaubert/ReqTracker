import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ProjectsSection } from './components/ProjectsSection';
import { IdeasSection } from './components/IdeasSection';
import { SettingsSection } from './components/SettingsSection';
import { db } from './services/db';
import { startAlarmChecker, stopAlarmChecker, requestNotificationPermission } from './services/alarms';
import './App.css';

function App() {
  const [activeSection, setActiveSection] = useState<'projects' | 'ideas' | 'settings'>('projects');
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Theme state: defaults to dark grayscale
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
  });

  // Apply theme to HTML tag on mount/change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Request notification permissions, start alarm checker
  useEffect(() => {
    // Request OS notification permissions early
    requestNotificationPermission().catch(console.error);

    // Start background alarm checker (runs once, then every 60s)
    startAlarmChecker(60000);

    // Auto-sync periodically if online
    const autoSyncInterval = setInterval(() => {
      if (navigator.onLine && db.getSupabaseClient()) {
        db.syncPendingQueue().then(() => {
          setRefreshTrigger(prev => prev + 1);
        });
      }
    }, 300000); // Every 5 minutes

    return () => {
      stopAlarmChecker();
      clearInterval(autoSyncInterval);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSync = async () => {
    const supabase = db.getSupabaseClient();
    if (!supabase) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      // First push any pending offline changes
      const pushRes = await db.syncPendingQueue();
      if (!pushRes.success) {
        setSyncError(pushRes.error || 'Error al guardar los datos locales en Supabase.');
        return;
      }
      // Then pull recent data from the cloud
      const pullRes = await db.pullAllData();
      if (!pullRes.success) {
        setSyncError(pullRes.error || 'Error al descargar los datos desde Supabase.');
      }
    } catch (e: any) {
      console.error('Error durante la sincronización:', e);
      setSyncError(e.message || 'Error de red durante la sincronización.');
    } finally {
      setIsSyncing(false);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleSessionChange = () => {
    handleSync();
  };

  const handleDataChange = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'projects':
        return 'Gestión de Proyectos & Requerimientos';
      case 'ideas':
        return 'Banco de Ideas';
      case 'settings':
        return 'Ajustes & Sincronización';
      default:
        return 'ReqTracker';
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        onSync={handleSync}
        isSyncing={isSyncing}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main className="main-content">
        <header className="content-header">
          <h2 className="content-title">{getSectionTitle()}</h2>
          {isSyncing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)', fontSize: '0.85rem' }}>
              <span className="spin-animation" style={{ display: 'inline-block' }}>↻</span>
              <span>Sincronizando...</span>
            </div>
          )}
        </header>

        <section className="content-body">
          {activeSection === 'projects' && (
            <ProjectsSection
              onDataChange={handleDataChange}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeSection === 'ideas' && (
            <IdeasSection
              onDataChange={handleDataChange}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsSection
              onSync={handleSync}
              isSyncing={isSyncing}
              onSessionChange={handleSessionChange}
              syncError={syncError}
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
