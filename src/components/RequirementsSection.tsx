import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Bell, BellOff, Calendar, AlertCircle, List, Kanban, ArrowLeft, PanelLeftOpen, Clock, Moon } from 'lucide-react';
import { db, Project, Requirement } from '../services/db';
import { checkAlarms, getRequirementUrgency } from '../services/alarms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from './ui/DatePicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface RequirementsSectionProps {
  project: Project;
  onDataChange: () => void;
  refreshTrigger: number;
  onBackToProjects?: () => void;
  onToggleListPane?: () => void;
  isListPaneCollapsed?: boolean;
}

export const RequirementsSection: React.FC<RequirementsSectionProps> = ({
  project,
  onDataChange,
  refreshTrigger,
  onBackToProjects,
  onToggleListPane,
  isListPaneCollapsed,
}) => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmDaysBefore, setAlarmDaysBefore] = useState<number>(() => db.getAlarmSettings().advanceDays);

  const loadRequirements = () => {
    const list = db.getRequirementsByProject(project.id);
    // Sort: uncompleted first, then by estimated date
    const sorted = [...list].sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return new Date(a.estimated_date).getTime() - new Date(b.estimated_date).getTime();
    });
    setRequirements(sorted);
  };

  useEffect(() => {
    loadRequirements();
  }, [project.id, refreshTrigger]);

  const handleCreateRequirement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !estimatedDate) return;

    const newReq: Requirement = {
      id: crypto.randomUUID(),
      project_id: project.id,
      title: title.trim(),
      description: description.trim(),
      status: 'todo',
      created_at: new Date().toISOString(),
      estimated_date: estimatedDate,
      alarm_enabled: alarmEnabled,
      alarm_days_before: alarmDaysBefore,
      notified: false,
    };

    db.saveRequirement(newReq);
    setTitle('');
    setDescription('');
    setEstimatedDate('');
    setAlarmEnabled(true);
    setAlarmDaysBefore(db.getAlarmSettings().advanceDays);
    setIsModalOpen(false);
    onDataChange();
    loadRequirements();

    // Trigger an immediate check in case the newly added task is within 3 days
    checkAlarms().catch(console.error);
  };

  const handleToggleStatus = (req: Requirement) => {
    const nextStatus = req.status === 'done' ? 'todo' : 'done';
    const updated: Requirement = {
      ...req,
      status: nextStatus,
      // If we mark it as active again, reset notified state
      notified: nextStatus === 'done' ? req.notified : false,
    };
    db.saveRequirement(updated);
    onDataChange();
    loadRequirements();
    
    if (updated.status !== 'done') {
      checkAlarms().catch(console.error);
    }
  };

  const handleToggleAlarm = (req: Requirement, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated: Requirement = {
      ...req,
      alarm_enabled: !req.alarm_enabled,
      notified: !req.alarm_enabled ? false : req.notified,
    };
    db.saveRequirement(updated);
    onDataChange();
    loadRequirements();

    if (updated.alarm_enabled) {
      checkAlarms().catch(console.error);
    }
  };

  const handleDeleteRequirement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    db.deleteRequirement(id);
    onDataChange();
    loadRequirements();
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: 'todo' | 'in-progress' | 'done') => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    const req = requirements.find(r => r.id === id);
    if (!req) return;
    if (req.status === targetStatus) return;

    const updated: Requirement = {
      ...req,
      status: targetStatus,
      notified: targetStatus === 'done' ? req.notified : false,
    };

    db.saveRequirement(updated);
    onDataChange();
    loadRequirements();

    if (updated.status !== 'done') {
      checkAlarms().catch(console.error);
    }
  };

  // Helper to determine urgency and get classes/info
  const getUrgencyInfo = (req: Requirement) => {
    if (req.status === 'done' || !req.estimated_date) return { className: '', badge: null };

    const settings = db.getAlarmSettings();
    const urgency = getRequirementUrgency(req, settings.advanceDays);

    if (urgency.isSnoozed) {
      return {
        className: 'border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/2',
        badge: (
          <Badge variant="outline" className="border-purple-200 dark:border-purple-950 bg-purple-500/10 text-purple-600 dark:text-purple-400 gap-1 py-0.5 px-2 select-none shadow-none text-[9px] font-semibold uppercase">
            <Moon className="h-3 w-3" />
            <span>Pospuesto</span>
          </Badge>
        ),
      };
    }

    if (urgency.category === 'overdue') {
      return {
        className: 'border-red-500/30 bg-red-500/5 dark:bg-red-950/2',
        badge: (
          <Badge variant="outline" className="border-red-200 dark:border-red-950 bg-red-500/10 text-red-600 dark:text-red-400 gap-1 py-0.5 px-2 select-none shadow-none text-[9px] font-semibold uppercase">
            <AlertCircle className="h-3 w-3" />
            <span>{urgency.label}</span>
          </Badge>
        ),
      };
    } else if (urgency.category === 'today') {
      return {
        className: 'border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/4',
        badge: (
          <Badge variant="outline" className="border-amber-300 dark:border-amber-900 bg-amber-500/20 text-amber-700 dark:text-amber-300 gap-1 py-0.5 px-2 select-none shadow-none text-[9px] font-bold uppercase">
            <Clock className="h-3 w-3" />
            <span>Vence hoy</span>
          </Badge>
        ),
      };
    } else if (urgency.category === 'soon') {
      return {
        className: 'border-sky-500/30 bg-sky-500/5 dark:bg-sky-950/2',
        badge: (
          <Badge variant="outline" className="border-sky-200 dark:border-sky-950 bg-sky-500/10 text-sky-600 dark:text-sky-400 gap-1 py-0.5 px-2 select-none shadow-none text-[9px] font-semibold uppercase">
            <AlertCircle className="h-3 w-3" />
            <span>{urgency.label}</span>
          </Badge>
        ),
      };
    }

    return { className: '', badge: null };
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'Por Hacer';
      case 'in-progress': return 'En Progreso';
      case 'done': return 'Completado';
      default: return 'Pendiente';
    }
  };

  return (
    <div className="flex flex-col gap-4.5 h-full">
      {/* Header */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          {onBackToProjects && (
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden -ml-2 text-xs font-semibold gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 h-8 px-2"
              onClick={onBackToProjects}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a Proyectos</span>
            </Button>
          )}

          {onToggleListPane && isListPaneCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              className="hidden lg:flex -ml-2 text-xs font-semibold gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 h-8 px-2"
              onClick={onToggleListPane}
              title="Mostrar lista de proyectos"
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span>Mostrar Proyectos</span>
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 truncate">{project.name}</h2>
            {project.description && (
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed max-w-[680px] line-clamp-2 sm:line-clamp-none">
                {project.description}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2.5 sm:gap-3.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
            {/* View Toggle */}
            <div className="flex items-center border border-neutral-200 dark:border-neutral-800 rounded-xl p-0.5 sm:p-1 bg-neutral-100/60 dark:bg-neutral-900/60">
              <Button
                variant="ghost"
                size="sm"
                className={`h-7.5 sm:h-8 px-2.5 sm:px-3 text-xs gap-1.5 rounded-lg ${viewMode === 'list' ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-800'}`}
                onClick={() => setViewMode('list')}
              >
                <List className="h-3.5 w-3.5" />
                <span>Lista</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7.5 sm:h-8 px-2.5 sm:px-3 text-xs gap-1.5 rounded-lg ${viewMode === 'kanban' ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm font-bold' : 'text-neutral-500 hover:text-neutral-800'}`}
                onClick={() => setViewMode('kanban')}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Kanban</span>
              </Button>
            </div>

            <Button size="sm" className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-semibold gap-1.5 sm:gap-2 rounded-xl shadow-sm" onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4" />
              <span>Añadir Tarea</span>
            </Button>
          </div>
        </div>
      </div>

      <Separator className="bg-neutral-200 dark:bg-neutral-800 my-0.5" />

      {requirements.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
          <div className="p-4.5 bg-neutral-100 dark:bg-neutral-900 rounded-full text-neutral-400 dark:text-neutral-500">
            <AlertCircle className="h-12 w-12 text-amber-500/70" />
          </div>
          <div className="max-w-[340px] space-y-1.5">
            <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">Sin Requerimientos</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              No hay requerimientos ni tareas registradas para este proyecto. Crea uno nuevo para comenzar.
            </p>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
          {requirements.map(req => {
            const urgency = getUrgencyInfo(req);
            return (
              <div
                key={req.id}
                className={`flex items-start justify-between gap-4.5 p-4.5 border border-neutral-200 dark:border-neutral-800 rounded-2xl transition-all duration-200 bg-white/70 dark:bg-neutral-900/30 shadow-sm ${
                  req.status === 'done' 
                    ? 'opacity-60 bg-neutral-50/50 dark:bg-neutral-950/20' 
                    : urgency.className || 'hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="pt-0.5">
                  <Checkbox
                    id={`req-check-${req.id}`}
                    checked={req.status === 'done'}
                    onCheckedChange={() => handleToggleStatus(req)}
                    className="h-5.5 w-5.5 rounded-lg border-neutral-300 dark:border-neutral-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h4 className={`font-bold text-base leading-snug tracking-tight break-words select-text ${
                      req.status === 'done' ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-50'
                    }`}>
                      {req.title}
                    </h4>
                    {req.status === 'in-progress' && (
                      <Badge variant="outline" className="h-5 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] py-0.5 px-2 font-bold uppercase select-none rounded-md">
                        En Progreso
                      </Badge>
                    )}
                  </div>
                  {req.description && (
                    <p className={`text-sm leading-relaxed break-words select-text ${
                      req.status === 'done' ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-300'
                    }`}>
                      {req.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2.5 mt-1">
                    <Badge variant="outline" className="border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 gap-1.5 py-1 px-2.5 select-none shadow-none text-xs font-semibold bg-transparent rounded-lg">
                      <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                      <span>Vence: {new Date(`${req.estimated_date}T00:00:00`).toLocaleDateString()}</span>
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 border rounded-lg px-2.5 py-0 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 text-xs font-semibold gap-1.5 cursor-pointer transition-colors ${
                        req.alarm_enabled 
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300' 
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 bg-transparent'
                      }`}
                      onClick={(e) => handleToggleAlarm(req, e)}
                    >
                      {req.alarm_enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                      <span>
                        {req.alarm_enabled 
                          ? (req.alarm_days_before !== undefined 
                              ? (req.alarm_days_before === 0 ? 'Alarma (mismo día)' : `Alarma (${req.alarm_days_before}d)`) 
                              : 'Alarma activa') 
                          : 'Alarma apagada'}
                      </span>
                    </Button>
                    {urgency.badge}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                  onClick={(e) => handleDeleteRequirement(req.id, e)}
                  title="Eliminar requerimiento"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="flex-1 kanban-container">
          {(['todo', 'in-progress', 'done'] as const).map(status => {
            const statusTasks = requirements.filter(r => r.status === status);
            return (
              <div 
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, status)}
                className="kanban-column flex flex-col gap-3.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-100/40 dark:bg-neutral-900/20 rounded-2xl p-3.5 sm:p-4 h-full overflow-hidden"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 flex-shrink-0">
                  <h4 className="text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider select-none">
                    {getStatusLabel(status)}
                  </h4>
                  <Badge variant="secondary" className="h-5.5 px-2 flex items-center justify-center text-xs font-bold bg-neutral-200/70 dark:bg-neutral-800/70 text-neutral-700 dark:text-neutral-300 select-none shadow-none rounded-md">
                    {statusTasks.length}
                  </Badge>
                </div>

                {/* Column Tasks Container */}
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-0.5">
                  {statusTasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl text-neutral-400 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 min-h-[120px]">
                      <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 select-none">Columna vacía</span>
                    </div>
                  ) : (
                    statusTasks.map(task => {
                      const urgency = getUrgencyInfo(task);
                      return (
                        <Card
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className={`group cursor-grab active:cursor-grabbing border shadow-sm select-none transition-all duration-200 rounded-xl hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-950 relative ${
                            task.status === 'done'
                              ? 'opacity-60 bg-neutral-50/50 dark:bg-neutral-950/20'
                              : urgency.className
                          }`}
                        >
                          <CardContent className="p-4 flex flex-col gap-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className={`font-bold text-sm leading-snug tracking-tight break-words pr-6 ${
                                task.status === 'done' ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-50'
                              }`}>
                                {task.title}
                              </h5>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2.5 top-2.5 h-6 w-6 rounded-md text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleDeleteRequirement(task.id, e)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {task.description && (
                              <p className={`text-xs leading-relaxed break-words line-clamp-2 ${
                                task.status === 'done' ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-300'
                              }`}>
                                {task.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-1 select-none">
                              <Badge variant="outline" className="border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 gap-1.5 py-0.5 px-2 h-5.5 shadow-none text-[11px] font-semibold bg-transparent rounded-md">
                                <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                                <span>{new Date(`${task.estimated_date}T00:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                              </Badge>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-5.5 border rounded-md px-2 py-0 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 text-[11px] font-semibold gap-1 cursor-pointer transition-colors ${
                                  task.alarm_enabled 
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300' 
                                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 bg-transparent'
                                }`}
                                onClick={(e) => handleToggleAlarm(task, e)}
                              >
                                {task.alarm_enabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                              </Button>
                              
                              {urgency.badge}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for creating requirement */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px] max-w-[calc(100vw-2rem)] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 rounded-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Nuevo Requerimiento (To Do)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRequirement} className="space-y-4.5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="req-title" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Título del Requerimiento
              </Label>
              <Input
                id="req-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Diseñar mockups, Configurar base de datos..."
                required
                autoFocus
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 text-sm h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-desc" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Detalles / Descripción (Opcional)
              </Label>
              <Textarea
                id="req-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Especifica los detalles de lo que se debe hacer..."
                rows={3}
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 resize-none text-sm rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="req-date" className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Fecha Estimada de Entrega (Vencimiento)
              </Label>
              <DatePicker
                value={estimatedDate}
                onChange={(val) => setEstimatedDate(val)}
              />
            </div>
            
            <div className="space-y-3 pt-1 select-none">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="req-alarm"
                  checked={alarmEnabled}
                  onCheckedChange={(checked) => setAlarmEnabled(!!checked)}
                  className="h-5.5 w-5.5 rounded-lg border-neutral-300 dark:border-neutral-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 cursor-pointer"
                />
                <Label htmlFor="req-alarm" className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2 cursor-pointer">
                  <Bell className={`h-4.5 w-4.5 ${alarmEnabled ? 'text-emerald-500' : 'text-neutral-400'}`} />
                  <span>Activar alarma recordatorio</span>
                </Label>
              </div>

              {alarmEnabled && (
                <div className="pl-8 flex items-center gap-2 text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400 font-medium">Avisar:</span>
                  <select
                    value={alarmDaysBefore}
                    onChange={(e) => setAlarmDaysBefore(Number(e.target.value))}
                    className="h-8 px-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs cursor-pointer"
                  >
                    <option value={0}>El mismo día del vencimiento</option>
                    <option value={1}>1 día antes</option>
                    <option value={2}>2 días antes</option>
                    <option value={3}>3 días antes (Predeterminado)</option>
                    <option value={7}>1 semana antes (7 días)</option>
                  </select>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 gap-2.5">
              <Button type="button" variant="outline" className="rounded-xl h-10 px-4 font-semibold" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl h-10 px-4 font-semibold shadow-sm">
                Añadir Requerimiento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
