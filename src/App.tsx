import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardSection } from './components/DashboardSection';
import { ProjectsSection } from './components/ProjectsSection';
import { IdeasSection } from './components/IdeasSection';
import { SettingsSection } from './components/SettingsSection';
import { CommandPalette } from './components/CommandPalette';
import { ChallengeSection } from './components/ChallengeSection';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ArrowUpCircle } from 'lucide-react';
import { db } from './services/db';
import { startAlarmChecker, stopAlarmChecker, requestNotificationPermission } from './services/alarms';
import './App.css';

function App() {
  const [activeSection, setActiveSection] = useState<'dashboard' | 'challenge' | 'projects' | 'ideas' | 'settings'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Custom navigation and command palette states
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [forceOpenNewProject, setForceOpenNewProject] = useState(false);
  const [forceOpenNewIdea, setForceOpenNewIdea] = useState(false);
  const [urgentCount, setUrgentCount] = useState(0);

  // Software update states
  const [availableUpdate, setAvailableUpdate] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Check for updates on mount
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update) {
          setAvailableUpdate(update);
        }
      } catch (e) {
        console.error('Error checking for updates:', e);
      }
    };
    checkForUpdates();
  }, []);

  const handleApplyUpdate = async () => {
    if (!availableUpdate) return;
    setIsUpdating(true);
    try {
      await availableUpdate.downloadAndInstall();
      await relaunch();
    } catch (e) {
      console.error('Error applying update:', e);
      setIsUpdating(false);
    }
  };

  // Focus burst / Challenge states
  interface ActiveChallenge {
    requirementId: string;
    requirementTitle: string;
    projectName: string;
    totalSeconds: number;
    remainingSeconds: number;
    isPaused: boolean;
  }
  const [activeChallenge, setActiveChallenge] = useState<ActiveChallenge | null>(null);

  // Focus Challenge Timer countdown effect
  useEffect(() => {
    if (!activeChallenge || activeChallenge.isPaused) return;

    const interval = setInterval(() => {
      setActiveChallenge(prev => {
        if (!prev) return null;
        if (prev.remainingSeconds <= 1) {
          clearInterval(interval);
          
          // Dispatch native OS notification when timer finishes
          import('@tauri-apps/plugin-notification').then(({ sendNotification }) => {
            sendNotification({
              title: '¡Desafío completado! 🎉',
              body: `Has finalizado con éxito tu ráfaga de enfoque en: "${prev.requirementTitle}".`
            });
          }).catch(console.error);

          return null;
        }
        return {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeChallenge?.isPaused, activeChallenge === null]);

  const handleStartChallenge = (reqId: string, durationMinutes: number) => {
    const requirements = db.getRequirements();
    const req = requirements.find(r => r.id === reqId);
    if (!req) return;

    const projects = db.getProjects();
    const proj = projects.find(p => p.id === req.project_id);
    const projectName = proj ? proj.name : 'Proyecto Desconocido';

    if (req.status === 'todo') {
      req.status = 'in-progress';
      db.saveRequirement(req);
      setRefreshTrigger(prev => prev + 1);
    }

    setActiveChallenge({
      requirementId: reqId,
      requirementTitle: req.title,
      projectName,
      totalSeconds: durationMinutes * 60,
      remainingSeconds: durationMinutes * 60,
      isPaused: false
    });
  };

  const handlePauseToggle = () => {
    setActiveChallenge(prev => {
      if (!prev) return null;
      return {
        ...prev,
        isPaused: !prev.isPaused
      };
    });
  };

  const handleCancelChallenge = () => {
    setActiveChallenge(null);
  };

  const handleCompleteTask = (reqId: string) => {
    const requirements = db.getRequirements();
    const req = requirements.find(r => r.id === reqId);
    if (req) {
      req.status = 'done';
      db.saveRequirement(req);
      setRefreshTrigger(prev => prev + 1);
    }
    setActiveChallenge(null);
  };

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

  // Hotkey keyboard listener for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.indexOf('Mac') !== -1;
      const isTrigger = isMac ? (e.metaKey && e.key === 'k') : (e.ctrlKey && e.key === 'k');
      
      if (isTrigger) {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update urgent count for sidebar indicator
  useEffect(() => {
    const requirements = db.getRequirements();
    const now = new Date();
    const urgent = requirements.filter(r => {
      if (r.status === 'done' || !r.estimated_date) return false;
      const dueDate = new Date(`${r.estimated_date}T23:59:59`);
      const timeDiff = dueDate.getTime() - now.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);
      return daysDiff <= 3;
    });
    setUrgentCount(urgent.length);
  }, [refreshTrigger]);

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
      case 'dashboard':
        return 'Resumen del Workspace';
      case 'challenge':
        return 'Desafío Focus';
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

  // Callback handler from Command Palette triggers
  const handleCommandAction = (action: 'new-project' | 'new-idea' | 'toggle-theme' | 'sync') => {
    switch (action) {
      case 'new-project':
        setForceOpenNewProject(true);
        setActiveSection('projects');
        break;
      case 'new-idea':
        setForceOpenNewIdea(true);
        setActiveSection('ideas');
        break;
      case 'toggle-theme':
        toggleTheme();
        break;
      case 'sync':
        handleSync();
        break;
      default:
        break;
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
        onOpenSearch={() => setIsSearchOpen(true)}
        urgentCount={urgentCount}
      />

      <main className="main-content">
        <header className="content-header">
          <h2 className="content-title">{getSectionTitle()}</h2>
          <div className="flex items-center gap-3">
            {isSyncing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blue)', fontSize: '0.85rem' }} className="select-none">
                <span className="spin-animation" style={{ display: 'inline-block' }}>↻</span>
                <span>Sincronizando...</span>
              </div>
            )}
            
            {availableUpdate && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyUpdate}
                disabled={isUpdating}
                className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300 animate-pulse cursor-pointer shadow-sm"
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                <span>{isUpdating ? 'Actualizando...' : `Actualizar a v${availableUpdate.version}`}</span>
              </Button>
            )}
          </div>
        </header>

        <section className="content-body">
          {activeSection === 'dashboard' && (
            <DashboardSection
              onNavigateToSection={(section, projId) => {
                if (projId) {
                  setSelectedProjectId(projId);
                }
                setActiveSection(section);
              }}
              onOpenCreateProject={() => {
                setForceOpenNewProject(true);
                setActiveSection('projects');
              }}
              onOpenCreateIdea={() => {
                setForceOpenNewIdea(true);
                setActiveSection('ideas');
              }}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeSection === 'challenge' && (
            <ChallengeSection
              activeChallenge={activeChallenge}
              onStartChallenge={handleStartChallenge}
              onPauseToggle={handlePauseToggle}
              onCancelChallenge={handleCancelChallenge}
              onCompleteTask={handleCompleteTask}
              refreshTrigger={refreshTrigger}
            />
          )}

          {activeSection === 'projects' && (
            <ProjectsSection
              onDataChange={handleDataChange}
              refreshTrigger={refreshTrigger}
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              forceOpenNewProject={forceOpenNewProject}
              setForceOpenNewProject={setForceOpenNewProject}
            />
          )}

          {activeSection === 'ideas' && (
            <IdeasSection
              onDataChange={handleDataChange}
              refreshTrigger={refreshTrigger}
              forceOpenNewIdea={forceOpenNewIdea}
              setForceOpenNewIdea={setForceOpenNewIdea}
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

      {/* Spotlight Command Search Palette overlay */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(sec, projId) => {
          if (projId) {
            setSelectedProjectId(projId);
          }
          setActiveSection(sec);
        }}
        onTriggerAction={handleCommandAction}
      />

      {/* Floating Focus Timer Widget */}
      {activeChallenge && (
        <div className="absolute top-4 right-4 z-50 group flex flex-col items-end">
          {/* Main pill-shaped clock widget */}
          <div className="backdrop-blur-md bg-neutral-900/90 border border-neutral-750 text-neutral-50 px-4.5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 select-none transition-all duration-200 hover:scale-102 hover:border-emerald-500/40 cursor-default">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
            
            <div className="flex flex-col text-right leading-none max-w-[140px] truncate">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider truncate">{activeChallenge.projectName}</span>
            </div>
            
            <span className="border-l border-neutral-700 h-5"></span>
            
            <span className="font-mono text-base font-black tabular-nums tracking-tight text-emerald-400">
              {(() => {
                const secs = activeChallenge.remainingSeconds;
                const hrs = Math.floor(secs / 3600);
                const mins = Math.floor((secs % 3600) / 60);
                const remainingSecs = secs % 60;
                const formattedMins = String(mins).padStart(2, '0');
                const formattedSecs = String(remainingSecs).padStart(2, '0');
                return hrs > 0 
                  ? `${String(hrs).padStart(2, '0')}:${formattedMins}:${formattedSecs}` 
                  : `${formattedMins}:${formattedSecs}`;
              })()}
            </span>
          </div>

          {/* Hover Card Panel */}
          <div className="absolute right-0 top-[48px] mt-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 translate-y-1 group-hover:translate-y-0 z-50">
            <Card className="w-[320px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-2xl p-4.5 rounded-2xl flex flex-col gap-3.5">
              <div className="space-y-1">
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  Requerimiento Enfocado
                </span>
                <h5 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 leading-snug break-words">
                  {activeChallenge.requirementTitle}
                </h5>
              </div>
              
              <Separator className="bg-neutral-200 dark:bg-neutral-800" />
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold px-2.5 flex-1 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg"
                  onClick={handlePauseToggle}
                >
                  {activeChallenge.isPaused ? 'Reanudar' : 'Pausar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold px-2.5 flex-1 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/10 rounded-lg"
                  onClick={handleCancelChallenge}
                >
                  Terminar
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs font-bold px-2.5 flex-1 text-white bg-emerald-500 hover:bg-emerald-600 border-none rounded-lg shadow-sm"
                  onClick={() => handleCompleteTask(activeChallenge.requirementId)}
                >
                  Completar
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
