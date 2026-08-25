import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Zap, 
  Search, 
  Play, 
  Pause, 
  XCircle, 
  CheckCircle2, 
  Timer,
  ChevronRight,
  Trophy
} from 'lucide-react';
import { db, Requirement } from '../services/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

interface ActiveChallenge {
  requirementId: string;
  requirementTitle: string;
  projectName: string;
  totalSeconds: number;
  remainingSeconds: number;
  isPaused: boolean;
}

interface ChallengeSectionProps {
  activeChallenge: ActiveChallenge | null;
  onStartChallenge: (reqId: string, durationMinutes: number) => void;
  onPauseToggle: () => void;
  onCancelChallenge: () => void;
  onCompleteTask: (reqId: string) => void;
  refreshTrigger: number;
}

export const ChallengeSection: React.FC<ChallengeSectionProps> = ({
  activeChallenge,
  onStartChallenge,
  onPauseToggle,
  onCancelChallenge,
  onCompleteTask,
  refreshTrigger,
}) => {
  const [tasks, setTasks] = useState<(Requirement & { projectName: string })[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  // Focusburst timing states
  const [focusType, setFocusType] = useState<'minutes' | 'hours'>('minutes');
  const [focusValue, setFocusValue] = useState<number>(25);

  useEffect(() => {
    const projects = db.getProjects();
    const requirements = db.getRequirements();

    // Get all pending tasks (todo and in-progress) with their project names
    const pendingTasks = requirements
      .filter(r => r.status !== 'done')
      .map(r => {
        const proj = projects.find(p => p.id === r.project_id);
        return {
          ...r,
          projectName: proj ? proj.name : 'Proyecto Desconocido',
        };
      });
    
    setTasks(pendingTasks);
  }, [refreshTrigger, activeChallenge]);

  // Filter tasks based on search input
  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    t.projectName.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // Time formatter helper: converts seconds to hh:mm:ss or mm:ss
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;

    const formattedMins = String(mins).padStart(2, '0');
    const formattedSecs = String(remainingSecs).padStart(2, '0');

    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${formattedMins}:${formattedSecs}`;
    }
    return `${formattedMins}:${formattedSecs}`;
  };

  const handlePresetSelect = (mins: number) => {
    setFocusType('minutes');
    setFocusValue(mins);
  };

  const handleStart = () => {
    if (!selectedTaskId) return;
    const durationMinutes = focusType === 'hours' ? focusValue * 60 : focusValue;
    onStartChallenge(selectedTaskId, durationMinutes);
  };

  // Preset Configurations
  const presets = [
    { label: '10 min', value: 10, sub: 'Enfoque rápido' },
    { label: '15 min', value: 15, sub: 'Micro ráfaga' },
    { label: '25 min', value: 25, sub: 'Pomodoro' },
    { label: '50 min', value: 50, sub: 'Bloque doble' },
    { label: '1 hora', value: 60, sub: 'Enfoque profundo' },
    { label: '2 horas', value: 120, sub: 'Sprint creativo' },
  ];

  // If a challenge is ACTIVE, display the Focus Timer screen
  if (activeChallenge) {
    const progressPercent = ((activeChallenge.totalSeconds - activeChallenge.remainingSeconds) / activeChallenge.totalSeconds) * 100;
    
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-[620px] mx-auto gap-6 select-none animate-in fade-in duration-200">
        <Card className="w-full border border-neutral-200 dark:border-neutral-850 bg-white/40 dark:bg-neutral-900/10 shadow-xl rounded-2xl overflow-hidden p-6 flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 dark:bg-emerald-500/5 px-3 py-1 rounded-full">
            <Flame className="h-3.5 w-3.5 fill-emerald-500 animate-pulse" />
            <span>Desafío Focus Activo</span>
          </div>

          <div className="flex flex-col items-center gap-1.5 text-center mt-2 max-w-full">
            <span className="text-[10px] font-bold text-neutral-450 dark:text-neutral-550 uppercase tracking-wider">
              {activeChallenge.projectName}
            </span>
            <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-50 px-4 leading-relaxed truncate max-w-full">
              {activeChallenge.requirementTitle}
            </h3>
          </div>

          {/* Large Countdown Clock */}
          <div className="text-6xl font-extrabold tracking-tighter text-neutral-800 dark:text-neutral-100 font-mono my-2.5 tabular-nums">
            {formatTime(activeChallenge.remainingSeconds)}
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-1">
            <div className="w-full bg-neutral-100 dark:bg-neutral-850 rounded-full h-2 overflow-hidden border border-neutral-200/50 dark:border-neutral-800/50">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-medium text-neutral-400 dark:text-neutral-550 px-1">
              <span>{Math.round(progressPercent)}% Completado</span>
              <span>Total: {formatTime(activeChallenge.totalSeconds)}</span>
            </div>
          </div>

          <Separator className="bg-neutral-200 dark:bg-neutral-800 my-1" />

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-4 w-full pt-1">
            <Button
              variant="outline"
              size="lg"
              className="h-10 text-xs gap-1.5 border-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-500/5 hover:text-red-600 dark:hover:text-red-300 flex-1"
              onClick={onCancelChallenge}
            >
              <XCircle className="h-4.5 w-4.5" />
              <span>Finalizar Desafío</span>
            </Button>

            <Button
              size="lg"
              className={`h-10 text-xs gap-1.5 flex-1 ${
                activeChallenge.isPaused 
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                  : 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 hover:bg-neutral-900 dark:hover:bg-neutral-50'
              }`}
              onClick={onPauseToggle}
            >
              {activeChallenge.isPaused ? (
                <>
                  <Play className="h-4.5 w-4.5 fill-white" />
                  <span>Reanudar Enfoque</span>
                </>
              ) : (
                <>
                  <Pause className="h-4.5 w-4.5 fill-current" />
                  <span>Pausar Enfoque</span>
                </>
              )}
            </Button>
          </div>

          <Button
            variant="outline"
            className="w-full h-10 text-xs gap-2 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
            onClick={() => onCompleteTask(activeChallenge.requirementId)}
          >
            <CheckCircle2 className="h-4.5 w-4.5" />
            <span>Marcar Requerimiento como Completado</span>
          </Button>
        </Card>
      </div>
    );
  }

  // If NO active challenge, display the Selection Screen
  return (
    <div className="flex h-full w-full overflow-hidden gap-4 select-none">
      
      {/* Left panel: List of pending requirements to choose from */}
      <div className="w-[320px] flex-shrink-0 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-950/20 p-4 rounded-xl flex flex-col gap-4 overflow-y-auto">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Timer className="h-4.5 w-4.5 text-neutral-500" />
            <span>Seleccionar Tarea</span>
          </h3>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-450 leading-relaxed">
            Elige la tarea en la que deseas trabajar enfocado en esta ráfaga de tiempo.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400 dark:text-neutral-550" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tarea o proyecto..."
            className="pl-8.5 bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 text-xs h-8.5"
          />
        </div>

        {tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg text-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/70 animate-bounce" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">¡Sin tareas pendientes!</p>
              <p className="text-[10px] text-neutral-450 dark:text-neutral-500">Crea requerimientos en tus proyectos antes de iniciar un desafío.</p>
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <p className="text-center text-xs text-neutral-400 dark:text-neutral-650 py-10">
            No se encontraron coincidencias.
          </p>
        ) : (
          <div className="flex flex-col gap-2 flex-1">
            {filteredTasks.map(t => (
              <Card
                key={t.id}
                className={`cursor-pointer border transition-all duration-200 shadow-none hover:bg-neutral-100/50 dark:hover:bg-neutral-900/30 ${
                  selectedTaskId === t.id
                    ? 'border-emerald-500/50 bg-emerald-50/5 dark:bg-emerald-950/5'
                    : 'border-neutral-200 dark:border-neutral-800 bg-transparent'
                }`}
                onClick={() => setSelectedTaskId(t.id)}
              >
                <CardContent className="p-3 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold text-neutral-450 dark:text-neutral-550 uppercase tracking-wide truncate max-w-[200px]">
                      {t.projectName}
                    </span>
                    {t.status === 'in-progress' && (
                      <Badge variant="outline" className="border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[8px] py-0 px-1 font-bold uppercase select-none h-4">
                        En curso
                      </Badge>
                    )}
                  </div>
                  <h4 className={`font-semibold text-xs leading-snug break-words ${
                    selectedTaskId === t.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-800 dark:text-neutral-200'
                  }`}>
                    {t.title}
                  </h4>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Right panel: Focusburst Setup & Presets */}
      <div className="flex-1 border border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-950/20 p-4 rounded-xl flex flex-col overflow-y-auto">
        {selectedTask ? (
          <div className="flex flex-col gap-5 h-full animate-in fade-in slide-in-from-right-1 duration-200">
            {/* Header: Selected Task Details */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-neutral-450 dark:text-neutral-550 uppercase tracking-wider">
                {selectedTask.projectName}
              </span>
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
                <ChevronRight className="h-4 w-4 text-emerald-500" />
                <span>{selectedTask.title}</span>
              </h3>
              {selectedTask.description && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 pl-5 leading-relaxed">
                  {selectedTask.description}
                </p>
              )}
            </div>

            <Separator className="bg-neutral-200 dark:bg-neutral-800" />

            {/* 1. Presets Burst selection */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-neutral-550 dark:text-neutral-400">
                Selecciona una Ráfaga de Tiempo (Presets)
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {presets.map(p => {
                  const isMinsValue = focusType === 'minutes' && focusValue === p.value;
                  const isHoursValue = focusType === 'hours' && focusValue * 60 === p.value;
                  const isActive = isMinsValue || isHoursValue;

                  return (
                    <Card
                      key={p.label}
                      className={`cursor-pointer border shadow-none text-center p-3 transition-all duration-200 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40 ${
                        isActive
                          ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950'
                      }`}
                      onClick={() => handlePresetSelect(p.value)}
                    >
                      <CardContent className="p-0 flex flex-col items-center gap-0.5 justify-center">
                        <span className="text-sm font-bold">{p.label}</span>
                        <span className="text-[9px] text-neutral-450 dark:text-neutral-500 font-medium">{p.sub}</span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* 2. Custom Duration Input */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-neutral-550 dark:text-neutral-400">
                O define una Duración Personalizada
              </Label>
              <div className="flex items-center gap-3">
                <div className="relative max-w-[120px]">
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={focusValue}
                    onChange={(e) => setFocusValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 text-xs font-bold h-9 pr-6"
                  />
                  <span className="absolute right-2 top-2.5 text-[10px] text-neutral-400 font-bold select-none">
                    {focusType === 'minutes' ? 'min' : 'hr'}
                  </span>
                </div>
                
                <div className="flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg p-0.5 bg-neutral-100/50 dark:bg-neutral-900/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-3 text-xs rounded-md font-semibold ${focusType === 'minutes' ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                    onClick={() => {
                      setFocusType('minutes');
                      if (focusType === 'hours') {
                        setFocusValue(prev => Math.round(prev * 60));
                      }
                    }}
                  >
                    Minutos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-3 text-xs rounded-md font-semibold ${focusType === 'hours' ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
                    onClick={() => {
                      setFocusType('hours');
                      if (focusType === 'minutes') {
                        setFocusValue(prev => Math.max(1, Math.round(prev / 60)));
                      }
                    }}
                  >
                    Horas
                  </Button>
                </div>
              </div>
            </div>

            {/* Big Start button */}
            <div className="mt-auto pt-4 flex items-center justify-end">
              <Button 
                size="lg" 
                className="h-10 text-xs font-bold gap-2 px-6 shadow-md"
                onClick={handleStart}
              >
                <Zap className="h-4 w-4 fill-current" />
                <span>Iniciar Desafío Focus</span>
              </Button>
            </div>
          </div>
        ) : (
          /* Empty state when no task is selected */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
            <div className="p-4 bg-neutral-100 dark:bg-neutral-900 rounded-full text-neutral-400 dark:text-neutral-500">
              <Trophy className="h-10 w-10" />
            </div>
            <div className="max-w-[420px] space-y-1.5">
              <h3 className="font-semibold text-base text-neutral-800 dark:text-neutral-200">Comienza tu Desafío</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Selecciona uno de tus requerimientos en la lista de la izquierda para configurar su tiempo de enfoque e iniciar el cronómetro de productividad.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
