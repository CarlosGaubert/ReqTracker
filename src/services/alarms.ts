import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { db } from './db';

export async function requestNotificationPermission() {
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

export async function checkAlarms() {
  const reqs = db.getRequirements();
  const now = new Date();
  let updatedAny = false;

  for (const r of reqs) {
    // Only check active requirements (not 'done') with alarms enabled that haven't been notified yet
    if (r.status !== 'done' && r.alarm_enabled && !r.notified && r.estimated_date) {
      // Create date object for the due date (end of day)
      const dueDate = new Date(`${r.estimated_date}T23:59:59`);
      const timeDiff = dueDate.getTime() - now.getTime();
      const daysDiff = timeDiff / (1000 * 3600 * 24);

      // Trigger if due date is within 3 days (approx 72 hours)
      if (daysDiff <= 3) {
        const hasPermission = await requestNotificationPermission();
        if (hasPermission) {
          const projects = db.getProjects();
          const project = projects.find(p => p.id === r.project_id);
          const projectName = project ? project.name : 'Proyecto Desconocido';

          sendNotification({
            title: `Requerimiento Próximo: ${r.title}`,
            body: `El requerimiento del proyecto "${projectName}" vence en menos de 3 días (${r.estimated_date}).`
          });

          // Mark as notified so we don't spam the user
          r.notified = true;
          db.saveRequirement(r);
          updatedAny = true;
        }
      }
    }
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
