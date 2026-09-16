import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Bell, 
  BellOff, 
  Check, 
  Clock, 
  ExternalLink, 
  AlertCircle, 
  Calendar, 
  Moon, 
  Volume2,
  RotateCcw
} from 'lucide-react';
import { db, Requirement } from '../services/db';
import { 
  getRequirementUrgency, 
  snoozeRequirement, 
  cancelSnooze, 
  playAlarmChime, 
  checkAlarms,
  RequirementUrgencyInfo 
} from '../services/alarms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface NotificationCenterProps {
  onNavigateToProject: (projectId: string) => void;
  onDataChange: () => void;
  refreshTrigger: number;
}

interface EnrichedRequirement extends Requirement {
  urgency: RequirementUrgencyInfo;
  projectName: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onNavigateToProject,
  onDataChange,
  refreshTrigger,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'today' | 'soon' | 'snoozed'>('all');
  const [snoozeMenuReqId, setSnoozeMenuReqId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSnoozeMenuReqId(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSnoozeMenuReqId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Settings and items
  const settings = db.getAlarmSettings();

  // Load requirements and enrich with project and urgency info
  const enrichedItems: EnrichedRequirement[] = useMemo(() => {
    const requirements = db.getRequirements();
    const projects = db.getProjects();
    const projectMap = new Map<string, string>(projects.map(p => [p.id, p.name]));

    return requirements
      .filter(r => r.status !== 'done' && r.alarm_enabled && r.estimated_date)
      .map(r => ({
        ...r,
        urgency: getRequirementUrgency(r, settings.advanceDays),
        projectName: projectMap.get(r.project_id) || 'Proyecto Desconocido',
      }))
      .filter(item => item.urgency.category !== 'normal' || item.urgency.isSnoozed)
      .sort((a, b) => a.urgency.daysDiff - b.urgency.daysDiff);
  }, [refreshTrigger, isOpen]);

  // Category counts
  const overdueCount = enrichedItems.filter(i => i.urgency.category === 'overdue' && !i.urgency.isSnoozed).length;
  const todayCount = enrichedItems.filter(i => i.urgency.category === 'today' && !i.urgency.isSnoozed).length;
  const soonCount = enrichedItems.filter(i => i.urgency.category === 'soon' && !i.urgency.isSnoozed).length;
  const snoozedCount = enrichedItems.filter(i => i.urgency.isSnoozed).length;

  const totalUrgentActive = overdueCount + todayCount + soonCount;

  // Filter items for display
  const filteredItems = enrichedItems.filter(item => {
    if (activeFilter === 'overdue') return item.urgency.category === 'overdue' && !item.urgency.isSnoozed;
    if (activeFilter === 'today') return item.urgency.category === 'today' && !item.urgency.isSnoozed;
    if (activeFilter === 'soon') return item.urgency.category === 'soon' && !item.urgency.isSnoozed;
    if (activeFilter === 'snoozed') return item.urgency.isSnoozed;
    return true;
  });

  // Action: Mark done
  const handleMarkDone = (req: Requirement, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: Requirement = {
      ...req,
      status: 'done',
    };
    db.saveRequirement(updated);
    onDataChange();
  };

  // Action: Snooze
  const handleSnooze = (reqId: string, days: number, e: React.MouseEvent) => {
    e.stopPropagation();
    snoozeRequirement(reqId, days);
    setSnoozeMenuReqId(null);
    onDataChange();
  };

  // Action: Cancel Snooze
  const handleCancelSnooze = (reqId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    cancelSnooze(reqId);
    onDataChange();
  };

  // Action: Toggle Alarm
  const handleToggleAlarm = (req: Requirement, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: Requirement = {
      ...req,
      alarm_enabled: !req.alarm_enabled,
    };
    db.saveRequirement(updated);
    onDataChange();
    if (updated.alarm_enabled) {
      checkAlarms().catch(console.error);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`relative flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl border transition-all duration-150 cursor-pointer ${
          isOpen
            ? 'bg-neutral-200 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-50 shadow-sm'
            : 'bg-white/80 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-50 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 shadow-2xs'
        }`}
        title="Centro de Alarmas y Recordatorios"
        aria-label="Alarmas"
      >
        <Bell className={`h-4 w-4 ${totalUrgentActive > 0 ? 'text-amber-500 animate-pulse' : ''}`} />

        {totalUrgentActive > 0 && (
          <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full shadow-sm ${
            overdueCount > 0 ? 'bg-red-500' : todayCount > 0 ? 'bg-amber-500' : 'bg-sky-500'
          }`}>
            {totalUrgentActive > 99 ? '99+' : totalUrgentActive}
          </span>
        )}
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[420px] max-h-[85vh] flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100">
          
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Centro de Alarmas
                </h3>
                <p className="text-[11px] text-neutral-450 dark:text-neutral-400">
                  {totalUrgentActive === 0 ? 'Todo al día' : `${totalUrgentActive} requerimientos requieren atención`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => playAlarmChime()}
                title="Probar sonido de alarma"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-2.5 border-b border-neutral-100 dark:border-neutral-800/60 text-xs overflow-x-auto select-none bg-neutral-50/20 dark:bg-neutral-900/20">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-2xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
              }`}
            >
              Todos ({enrichedItems.length})
            </button>
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilter('overdue')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors ${
                  activeFilter === 'overdue'
                    ? 'bg-red-500 text-white shadow-2xs'
                    : 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
                }`}
              >
                Vencidos ({overdueCount})
              </button>
            )}
            {todayCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilter('today')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors ${
                  activeFilter === 'today'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                Vence hoy ({todayCount})
              </button>
            )}
            {soonCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilter('soon')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  activeFilter === 'soon'
                    ? 'bg-sky-500 text-white shadow-2xs'
                    : 'text-sky-600 dark:text-sky-400 hover:bg-sky-500/10'
                }`}
              >
                Próximos ({soonCount})
              </button>
            )}
            {snoozedCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilter('snoozed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  activeFilter === 'snoozed'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                }`}
              >
                Pospuestos ({snoozedCount})
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto max-h-[420px] p-2 space-y-2 divide-y divide-neutral-100 dark:divide-neutral-800/40">
            {filteredItems.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2.5">
                  <Check className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  ¡No hay alarmas pendientes!
                </h4>
                <p className="text-xs text-neutral-450 dark:text-neutral-400 mt-1 max-w-[240px] mx-auto">
                  Todos tus requerimientos están al día o no tienen alarmas activadas para este periodo.
                </p>
              </div>
            ) : (
              filteredItems.map(item => {
                const isSnoozed = item.urgency.isSnoozed;
                const isOverdue = item.urgency.category === 'overdue';
                const isToday = item.urgency.category === 'today';

                const badgeBg = isSnoozed 
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                  : isOverdue 
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    : isToday
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';

                return (
                  <div 
                    key={item.id} 
                    className="group pt-2 first:pt-0 pb-1 px-2 rounded-xl transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Project Name + Urgency Badge */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="text-[11px] font-medium text-neutral-450 dark:text-neutral-400 truncate max-w-[150px]">
                            {item.projectName}
                          </span>
                          <span className="text-neutral-300 dark:text-neutral-700">•</span>
                          <Badge variant="outline" className={`py-0 px-1.5 text-[9px] font-bold uppercase rounded-md gap-0.5 select-none ${badgeBg}`}>
                            {isSnoozed ? (
                              <>
                                <Moon className="h-2.5 w-2.5" />
                                <span>Pospuesto</span>
                              </>
                            ) : isOverdue ? (
                              <>
                                <AlertCircle className="h-2.5 w-2.5" />
                                <span>{item.urgency.label}</span>
                              </>
                            ) : isToday ? (
                              <>
                                <Clock className="h-2.5 w-2.5" />
                                <span>Vence Hoy</span>
                              </>
                            ) : (
                              <>
                                <Calendar className="h-2.5 w-2.5" />
                                <span>{item.urgency.label}</span>
                              </>
                            )}
                          </Badge>
                        </div>

                        {/* Title - clickable to navigate */}
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateToProject(item.project_id);
                            setIsOpen(false);
                          }}
                          className="text-left font-semibold text-sm text-neutral-900 dark:text-neutral-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors line-clamp-2 cursor-pointer"
                        >
                          {item.title}
                        </button>

                        <div className="text-[11px] text-neutral-450 dark:text-neutral-400 mt-0.5">
                          Fecha límite: <span className="font-medium text-neutral-700 dark:text-neutral-300">{item.estimated_date}</span>
                        </div>
                      </div>

                      {/* Quick Complete Action */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleMarkDone(item, e)}
                        className="h-7 w-7 rounded-lg text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 flex-shrink-0"
                        title="Marcar como completado"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-neutral-100/60 dark:border-neutral-800/30 text-xs">
                      {/* Snooze button / menu */}
                      <div className="relative">
                        {isSnoozed ? (
                          <button
                            type="button"
                            onClick={(e) => handleCancelSnooze(item.id, e)}
                            className="flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Desposponer</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSnoozeMenuReqId(snoozeMenuReqId === item.id ? null : item.id);
                            }}
                            className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                          >
                            <Moon className="h-3 w-3" />
                            <span>Posponer...</span>
                          </button>
                        )}

                        {/* Floating Snooze Menu */}
                        {snoozeMenuReqId === item.id && (
                          <div className="absolute left-0 bottom-6 w-32 p-1 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 space-y-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleSnooze(item.id, 1, e)}
                              className="w-full text-left px-2 py-1 text-xs rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium"
                            >
                              + 1 día
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSnooze(item.id, 3, e)}
                              className="w-full text-left px-2 py-1 text-xs rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium"
                            >
                              + 3 días
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSnooze(item.id, 7, e)}
                              className="w-full text-left px-2 py-1 text-xs rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium"
                            >
                              + 1 semana
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right actions: Jump to project & mute */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleToggleAlarm(item, e)}
                          title="Silenciar alarma para este requerimiento"
                          className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                          <BellOff className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateToProject(item.project_id);
                            setIsOpen(false);
                          }}
                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <span>Ver</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-2.5 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/30 text-center">
            <span className="text-[10px] text-neutral-450 dark:text-neutral-400">
              Anticipación actual: {settings.advanceDays} días antes • Configurable en Ajustes
            </span>
          </div>

        </div>
      )}
    </div>
  );
};
