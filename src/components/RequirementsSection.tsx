import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Bell, BellOff, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { db, Project, Requirement } from '../services/db';
import { checkAlarms } from '../services/alarms';

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

    // Trigger an immediate alarm check in case the newly added task is already within 3 days
    checkAlarms().catch(console.error);
  };

  const handleToggleStatus = (req: Requirement) => {
    const updated: Requirement = {
      ...req,
      status: req.status === 'done' ? 'todo' : 'done',
      // If we mark it as active again, reset notified state so it can alert again if needed
      notified: req.status === 'done' ? false : req.notified,
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
      // Reset notified if enabling alarm
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
    if (confirm('¿Estás seguro de que quieres eliminar este requerimiento?')) {
      db.deleteRequirement(id);
      onDataChange();
      loadRequirements();
    }
  };

  // Helper to determine urgency and get classes/info
  const getUrgencyInfo = (req: Requirement) => {
    if (req.status === 'done') return { className: '', badge: null };

    const now = new Date();
    // Use end of day for due date
    const dueDate = new Date(`${req.estimated_date}T23:59:59`);
    const timeDiff = dueDate.getTime() - now.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);

    if (daysDiff < 0) {
      return {
        className: 'urgent-alarm',
        badge: (
          <span className="meta-badge overdue">
            <AlertCircle size={12} />
            <span>Vencido</span>
          </span>
        ),
      };
    } else if (daysDiff <= 3) {
      return {
        className: 'warning-alarm',
        badge: (
          <span className="meta-badge due-soon">
            <AlertCircle size={12} />
            <span>Vence pronto</span>
          </span>
        ),
      };
    }

    return { className: '', badge: null };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <div className="requirements-header">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{project.name}</h2>
          {project.description && (
            <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              {project.description}
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Añadir Requerimiento</span>
        </button>
      </div>

      <div style={{ borderBottom: '1px solid var(--border-color)', margin: '0.5rem 0' }}></div>

      {requirements.length === 0 ? (
        <div className="empty-state" style={{ flex: 1, justifyContent: 'center' }}>
          <AlertCircle className="empty-state-icon" size={40} />
          <h3>Sin Requerimientos</h3>
          <p>No hay requerimientos (todos) registrados para este proyecto. Crea uno para comenzar.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
          {requirements.map(req => {
            const urgency = getUrgencyInfo(req);
            return (
              <div
                key={req.id}
                className={`requirement-item ${req.status === 'done' ? 'done' : ''} ${urgency.className}`}
              >
                <div
                  className={`requirement-checkbox ${req.status === 'done' ? 'checked' : ''}`}
                  onClick={() => handleToggleStatus(req)}
                  title={req.status === 'done' ? 'Marcar como pendiente' : 'Marcar como completado'}
                >
                  {req.status === 'done' && <CheckCircle size={14} style={{ color: '#020617' }} />}
                </div>

                <div className="requirement-content">
                  <h4 className="requirement-title">{req.title}</h4>
                  {req.description && (
                    <p className="text-muted" style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem' }}>
                      {req.description}
                    </p>
                  )}
                  <div className="requirement-meta" style={{ marginTop: '0.35rem' }}>
                    <span className="meta-badge">
                      <Calendar size={12} />
                      <span>Plazo: {new Date(`${req.estimated_date}T00:00:00`).toLocaleDateString()}</span>
                    </span>
                    <button
                      className={`meta-badge ${req.alarm_enabled ? 'alarm-active' : ''}`}
                      onClick={(e) => handleToggleAlarm(req, e)}
                      style={{ cursor: 'pointer', border: '1px solid var(--border-color)', background: 'none' }}
                      title={req.alarm_enabled ? 'Desactivar alarma' : 'Activar alarma'}
                    >
                      {req.alarm_enabled ? <Bell size={12} /> : <BellOff size={12} />}
                      <span>{req.alarm_enabled ? 'Alarma activada' : 'Alarma apagada'}</span>
                    </button>
                    {urgency.badge}
                  </div>
                </div>

                <button
                  className="btn-icon"
                  onClick={(e) => handleDeleteRequirement(req.id, e)}
                  title="Eliminar requerimiento"
                >
                  <Trash2 size={16} style={{ color: 'var(--accent-red)' }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for creating requirement */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nuevo Requerimiento (To Do)</h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRequirement}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="req-title">Título del Requerimiento</label>
                  <input
                    type="text"
                    id="req-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Diseñar mockups, Configurar base de datos..."
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="req-desc">Detalles / Descripción (Opcional)</label>
                  <textarea
                    id="req-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Especifica los detalles de lo que se debe hacer..."
                    rows={3}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="req-date">Fecha Estimada de Entrega (Vencimiento)</label>
                  <input
                    type="date"
                    id="req-date"
                    value={estimatedDate}
                    onChange={(e) => setEstimatedDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="req-alarm"
                    checked={alarmEnabled}
                    onChange={(e) => setAlarmEnabled(e.target.checked)}
                    style={{ width: '18px', height: '18px', margin: 0, cursor: 'pointer' }}
                  />
                  <label htmlFor="req-alarm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Bell size={14} style={{ color: alarmEnabled ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
                    <span>Activar alarma recordatorio (3 días antes)</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Añadir Requerimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
