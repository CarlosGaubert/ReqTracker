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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Theme state: defaults to dark grayscale
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
  });

  // Apply theme to HTML tag on mount/change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Request notification permissions, start alarm checker, check session
  useEffect(() => {
    // Request OS notification permissions early
    requestNotificationPermission().catch(console.error);

    // Start background alarm checker (runs once, then every 60s)
    startAlarmChecker(60000);

    // Initial session check
    checkSession();

    // Set up Supabase Auth state listener if client is initialized
    let authListenerSubscription: any = null;
    const supabase = db.getSupabaseClient();
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setUserEmail(session.user.email || 'Usuario');
          // Auto sync when state changes
          handleSync();
        } else {
          setUserEmail(null);
        }
        setRefreshTrigger(prev => prev + 1);
      });
      authListenerSubscription = subscription;
    }

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
      if (authListenerSubscription) {
        authListenerSubscription.unsubscribe();
      }
      clearInterval(autoSyncInterval);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const checkSession = async () => {
    const supabase = db.getSupabaseClient();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserEmail(session.user.email || 'Usuario');
      } else {
        setUserEmail(null);
      }
    } else {
      setUserEmail(null);
    }
  };

  const handleSync = async () => {
    const supabase = db.getSupabaseClient();
    if (!supabase) return;

    setIsSyncing(true);
    try {
      // First push any pending offline changes
      await db.syncPendingQueue();
      // Then pull recent data from the cloud
      const res = await db.pullAllData();
      if (res.success) {
        console.log('Sincronización exitosa con Supabase.');
      } else {
        console.warn('Sincronización fallida:', res.error);
      }
    } catch (e) {
      console.error('Error durante la sincronización:', e);
    } finally {
      setIsSyncing(false);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleSessionChange = () => {
    checkSession().then(() => {
      handleSync();
    });
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
        userEmail={userEmail}
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
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
