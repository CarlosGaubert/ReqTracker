import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { db, Requirement } from './db';

/**
 * Request system notification permissions
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    return permissionGranted;
  } catch (e) {
    console.error('Error checking notification permissions', e);
    return false;
  }
}

/**
 * Play a gentle two-tone chime using Web Audio API (offline ready, no assets needed)
 */
export function playAlarmChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(587.33, now, 0.35); // D5
    playTone(880.00, now + 0.12, 0.55); // A5
  } catch (e) {
    console.warn('Audio chime could not be played', e);
  }
}

/**
 * Calculate the difference in calendar days between an ISO date string (YYYY-MM-DD) and today.
 * Negative value: overdue (e.g. -2 = 2 days ago)
 * 0: due today
 * Positive value: due in X days (e.g. 3 = in 3 days)
 */
export function getDaysDifference(estimatedDate: string, now: Date = new Date()): number {
  if (!estimatedDate) return 999;
  const parts = estimatedDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 999;

  const [year, month, day] = parts;
  const targetDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const diffMs = targetDate.getTime() - todayDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export type UrgencyCategory = 'overdue' | 'today' | 'soon' | 'normal';

export interface RequirementUrgencyInfo {
  category: UrgencyCategory;
  daysDiff: number;
  isSnoozed: boolean;
  snoozedUntil?: string;
  label: string;
}

/**
 * Get comprehensive urgency info for a requirement
 */
export function getRequirementUrgency(
  req: Requirement,
  advanceDays: number = 3
): RequirementUrgencyInfo {
  if (req.status === 'done' || !req.estimated_date) {
    return { category: 'normal', daysDiff: 999, isSnoozed: false, label: '' };
  }

  const now = new Date();
  const isSnoozed = !!(req.snoozed_until && new Date(req.snoozed_until).getTime() > now.getTime());
  const daysDiff = getDaysDifference(req.estimated_date, now);
  const effectiveAdvance = req.alarm_days_before ?? advanceDays;

  let category: UrgencyCategory = 'normal';
  let label = '';

  if (daysDiff < 0) {
    category = 'overdue';
    const abs = Math.abs(daysDiff);
    label = abs === 1 ? 'Venció ayer' : `Venció hace ${abs} días`;
  } else if (daysDiff === 0) {
    category = 'today';
    label = 'Vence hoy';
  } else if (daysDiff <= effectiveAdvance) {
    category = 'soon';
    label = daysDiff === 1 ? 'Vence mañana' : `Vence en ${daysDiff} días`;
  } else {
    label = `En ${daysDiff} días`;
  }

  return {
    category,
    daysDiff,
    isSnoozed,
    snoozedUntil: req.snoozed_until,
    label,
  };
}

/**
 * Snooze a requirement for a given number of days
 */
export function snoozeRequirement(reqId: string, days: number = 1): boolean {
  const reqs = db.getRequirements();
  const req = reqs.find(r => r.id === reqId);
  if (!req) return false;

  const snoozeDate = new Date();
  snoozeDate.setDate(snoozeDate.getDate() + days);
  snoozeDate.setHours(23, 59, 59, 999);

  req.snoozed_until = snoozeDate.toISOString();
  db.saveRequirement(req);
  return true;
}

/**
 * Cancel snooze for a requirement
 */
export function cancelSnooze(reqId: string): boolean {
  const reqs = db.getRequirements();
  const req = reqs.find(r => r.id === reqId);
  if (!req) return false;

  delete req.snoozed_until;
  db.saveRequirement(req);
  return true;
}

/**
 * Main alarm verification routine:
 * - Checks active requirements with alarm_enabled
 * - Evaluates overdue, due today, and upcoming states
 * - Sends desktop notification and plays audio according to settings
 * - Prevents duplicate notifications on the same day
 */
export async function checkAlarms(): Promise<boolean> {
  const reqs = db.getRequirements();
  const settings = db.getAlarmSettings();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let updatedAny = false;
  let shouldPlaySound = false;

  const projects = db.getProjects();
  const projectMap = new Map<string, string>(projects.map(p => [p.id, p.name]));

  for (const r of reqs) {
    if (r.status === 'done' || !r.alarm_enabled || !r.estimated_date) {
      continue;
    }

    // Skip if snoozed
    if (r.snoozed_until && new Date(r.snoozed_until).getTime() > now.getTime()) {
      continue;
    }

    const daysDiff = getDaysDifference(r.estimated_date, now);
    const advanceDays = r.alarm_days_before ?? settings.advanceDays;
    const projectName = projectMap.get(r.project_id) || 'Proyecto';

    let notificationTitle = '';
    let notificationBody = '';
    let shouldNotify = false;

    if (daysDiff < 0 && settings.notifyOverdue) {
      // Overdue: notify once per day until completed or snoozed
      if (r.last_notified_date !== todayStr) {
        const abs = Math.abs(daysDiff);
        notificationTitle = `⚠️ Requerimiento Vencido: ${r.title}`;
        notificationBody = `Proyecto "${projectName}" • Venció hace ${abs} ${abs === 1 ? 'día' : 'días'} (${r.estimated_date}).`;
        shouldNotify = true;
      }
    } else if (daysDiff === 0 && settings.notifyOnDueDate) {
      // Due Today: notify once today
      if (r.last_notified_date !== todayStr) {
        notificationTitle = `🔔 Vence Hoy: ${r.title}`;
        notificationBody = `Proyecto "${projectName}" • El requerimiento vence hoy (${r.estimated_date}).`;
        shouldNotify = true;
      }
    } else if (daysDiff > 0 && daysDiff <= advanceDays) {
      // Due Soon: notify once during the advance window
      if (!r.notified || r.last_notified_date !== todayStr) {
        notificationTitle = `⏳ Requerimiento Próximo: ${r.title}`;
        notificationBody = `Proyecto "${projectName}" • Vence en ${daysDiff} ${daysDiff === 1 ? 'día' : 'días'} (${r.estimated_date}).`;
        shouldNotify = true;
      }
    }

    if (shouldNotify) {
      if (settings.desktopNotifications) {
        const hasPermission = await requestNotificationPermission();
        if (hasPermission) {
          try {
            sendNotification({
              title: notificationTitle,
              body: notificationBody,
            });
          } catch (err) {
            console.error('Error sending desktop notification', err);
          }
        }
      }

      shouldPlaySound = true;
      r.notified = true;
      r.last_notified_date = todayStr;
      db.saveRequirement(r);
      updatedAny = true;
    }
  }

  if (shouldPlaySound && settings.soundEnabled) {
    playAlarmChime();
  }

  return updatedAny;
}

let intervalId: any = null;

export function startAlarmChecker(intervalMs: number = 60000) {
  if (intervalId) clearInterval(intervalId);

  // Run initial check
  checkAlarms().catch(console.error);

  // Set up interval for recurring checks (default: every 1 minute)
  intervalId = setInterval(() => {
    checkAlarms().catch(console.error);
  }, intervalMs);
}

export function stopAlarmChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
