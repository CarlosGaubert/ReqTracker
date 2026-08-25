import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Bell, BellOff, Calendar, AlertCircle, List, Kanban } from 'lucide-react';
import { db, Project, Requirement } from '../services/db';
import { checkAlarms } from '../services/alarms';
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
}

export const RequirementsSection: React.FC<RequirementsSectionProps> = ({
  project,
  onDataChange,
  refreshTrigger,
}) => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
  const [alarmEnabled, setAlarmEnabled] = useState(true);

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
      notified: false,
    };

    db.saveRequirement(newReq);
    setTitle('');
    setDescription('');
    setEstimatedDate('');
    setAlarmEnabled(true);
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
    if (req.status === 'done') return { className: '', badge: null };

    const now = new Date();
    const dueDate = new Date(`${req.estimated_date}T23:59:59`);
    const timeDiff = dueDate.getTime() - now.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);

    if (daysDiff < 0) {
      return {
        className: 'border-red-500/30 bg-red-500/5 dark:bg-red-950/2',
        badge: (
          <Badge variant="outline" className="border-red-200 dark:border-red-950 bg-red-500/10 text-red-600 dark:text-red-400 gap-1 py-0.5 px-2 select-none shadow-none text-[9px] font-semibold uppercase">
            <AlertCircle className="h-3 w-3" />
            <span>Vencido</span>
          </Badge>
        ),
      };
    } else if (daysDiff <= 3) {
      return {
        className: 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/2',
        badge: (
          <Badge variant="outline" className="border-amber-250 dark:border-amber-950 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 py-0.5 px-2 select-none shadow-none text-[9px] font-semibold uppercase">
            <AlertCircle className="h-3 w-3" />
            <span>Vence pronto</span>
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
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-800 dark:text-neutral-50">{project.name}</h2>
          {project.description && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed max-w-[640px]">
              {project.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3.5 w-full sm:w-auto justify-between sm:justify-end">
          {/* View Toggle */}
          <div className="flex items-center border border-neutral-200 dark:border-neutral-800 rounded-lg p-0.5 bg-neutral-100/50 dark:bg-neutral-900/50">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2.5 text-xs gap-1 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm font-semibold' : 'text-neutral-500 hover:text-neutral-800'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Lista</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2.5 text-xs gap-1 rounded-md ${viewMode === 'kanban' ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 shadow-sm font-semibold' : 'text-neutral-500 hover:text-neutral-800'}`}
              onClick={() => setViewMode('kanban')}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Kanban</span>
            </Button>
          </div>

          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>Añadir Tarea</span>
          </Button>
        </div>
      </div>

      <Separator className="bg-neutral-200 dark:bg-neutral-800 my-1" />

      {requirements.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
          <div className="p-4 bg-neutral-100 dark:bg-neutral-900 rounded-full text-neutral-400 dark:text-neutral-500">
            <AlertCircle className="h-10 w-10" />
          </div>
          <div className="max-w-[320px] space-y-1.5">
            <h3 className="font-semibold text-base text-neutral-800 dark:text-neutral-200">Sin Requerimientos</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              No hay requerimientos ni tareas registradas para este proyecto. Crea uno nuevo para comenzar.
            </p>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-1">
          {requirements.map(req => {
            const urgency = getUrgencyInfo(req);
            return (
              <div
                key={req.id}
                className={`flex items-start justify-between gap-4 p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl transition-all duration-200 bg-white dark:bg-neutral-900/10 ${
                  req.status === 'done' 
                    ? 'opacity-50 bg-neutral-50/50 dark:bg-neutral-950/20' 
                    : urgency.className || 'hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="pt-0.5">
                  <Checkbox
                    id={`req-check-${req.id}`}
                    checked={req.status === 'done'}
                    onCheckedChange={() => handleToggleStatus(req)}
                    className="h-5 w-5 border-neutral-300 dark:border-neutral-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={`font-semibold text-sm leading-none tracking-tight break-words select-text ${
                      req.status === 'done' ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-100'
                    }`}>
                      {req.title}
                    </h4>
                    {req.status === 'in-progress' && (
                      <Badge variant="outline" className="h-4 border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[8px] py-0 px-1 font-bold uppercase select-none">
                        En Progreso
                      </Badge>
                    )}
                  </div>
                  {req.description && (
                    <p className={`text-xs leading-relaxed break-words select-text ${
                      req.status === 'done' ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-550 dark:text-neutral-400'
                    }`}>
                      {req.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline" className="border-neutral-200 dark:border-neutral-800 text-neutral-550 dark:text-neutral-400 gap-1 py-0.5 px-2 select-none shadow-none text-[10px] font-medium bg-transparent">
                      <Calendar className="h-3 w-3" />
                      <span>Vence: {new Date(`${req.estimated_date}T00:00:00`).toLocaleDateString()}</span>
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-5 border rounded-full px-2 py-0 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-[10px] font-medium gap-1 cursor-pointer transition-colors ${
                        req.alarm_enabled 
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300' 
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 bg-transparent'
                      }`}
                      onClick={(e) => handleToggleAlarm(req, e)}
                    >
                      {req.alarm_enabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                      <span>{req.alarm_enabled ? 'Alarma activa' : 'Alarma apagada'}</span>
                    </Button>
                    {urgency.badge}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
                  onClick={(e) => handleDeleteRequirement(req.id, e)}
                  title="Eliminar requerimiento"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden h-full pb-2">
          {(['todo', 'in-progress', 'done'] as const).map(status => {
            const statusTasks = requirements.filter(r => r.status === status);
            return (
              <div 
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, status)}
                className="flex flex-col gap-3 border border-neutral-200 dark:border-neutral-800 bg-neutral-100/30 dark:bg-neutral-900/10 rounded-xl p-3.5 h-full overflow-hidden"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 flex-shrink-0">
                  <h4 className="text-xs font-bold text-neutral-750 dark:text-neutral-300 uppercase tracking-wide select-none">
                    {getStatusLabel(status)}
                  </h4>
                  <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] font-bold bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 select-none shadow-none">
                    {statusTasks.length}
                  </Badge>
                </div>

                {/* Column Tasks Container */}
                <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
                  {statusTasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-400 dark:text-neutral-500 min-h-[120px]">
                      <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 select-none">Columna vacía</span>
                    </div>
                  ) : (
                    statusTasks.map(task => {
                      const urgency = getUrgencyInfo(task);
                      return (
                        <Card
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className={`group cursor-grab active:cursor-grabbing border shadow-none select-none transition-all duration-200 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-950 relative ${
                            task.status === 'done'
                              ? 'opacity-60 bg-neutral-50/50 dark:bg-neutral-950/20'
                              : urgency.className
                          }`}
                        >
                          <CardContent className="p-3.5 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className={`font-semibold text-xs leading-snug tracking-tight break-words pr-5 ${
                                task.status === 'done' ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-850 dark:text-neutral-100'
                              }`}>
                                {task.title}
                              </h5>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-2 h-5 w-5 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleDeleteRequirement(task.id, e)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>

                            {task.description && (
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed break-words">
                                {task.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 mt-1 select-none">
                              <Badge variant="outline" className="border-neutral-200 dark:border-neutral-800 text-neutral-450 dark:text-neutral-450 gap-1 py-0 px-1.5 h-5 shadow-none text-[9px] font-semibold bg-transparent">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(`${task.estimated_date}T00:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                              </Badge>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-5 border rounded-full px-1.5 py-0 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-[9px] font-semibold gap-1 cursor-pointer transition-colors ${
                                  task.alarm_enabled 
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300' 
                                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-550 bg-transparent'
                                }`}
                                onClick={(e) => handleToggleAlarm(task, e)}
                              >
                                {task.alarm_enabled ? <Bell className="h-2.5 w-2.5" /> : <BellOff className="h-2.5 w-2.5" />}
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
        <DialogContent className="sm:max-w-[425px] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight">Nuevo Requerimiento (To Do)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRequirement} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="req-title" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Título del Requerimiento
              </Label>
              <Input
                id="req-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Diseñar mockups, Configurar base de datos..."
                required
                autoFocus
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-desc" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Detalles / Descripción (Opcional)
              </Label>
              <Textarea
                id="req-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Especifica los detalles de lo que se debe hacer..."
                rows={3}
                className="bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 focus-visible:ring-emerald-500 resize-none"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="req-date" className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Fecha Estimada de Entrega (Vencimiento)
              </Label>
              <DatePicker
                value={estimatedDate}
                onChange={(val) => setEstimatedDate(val)}
              />
            </div>
            
            <div className="flex items-center gap-3 pt-1 select-none">
              <Checkbox
                id="req-alarm"
                checked={alarmEnabled}
                onCheckedChange={(checked) => setAlarmEnabled(!!checked)}
                className="h-5 w-5 border-neutral-300 dark:border-neutral-700 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 cursor-pointer"
              />
              <Label htmlFor="req-alarm" className="text-xs font-medium text-neutral-600 dark:text-neutral-300 flex items-center gap-2 cursor-pointer">
                <Bell className={`h-4 w-4 ${alarmEnabled ? 'text-emerald-500' : 'text-neutral-400'}`} />
                <span>Activar alarma recordatorio (3 días antes)</span>
              </Label>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Añadir Requerimiento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
