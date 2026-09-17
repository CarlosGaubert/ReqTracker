import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats any date input into strict DD/MM/YYYY format.
 * Handles ISO strings like 'YYYY-MM-DD' without timezone shift,
 * as well as full ISO datetime strings, timestamps, and Date objects.
 */
export function formatDateDDMMYYYY(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTimeDDMMYYYY(dateInput: string | Date | number | null | undefined): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;
  if (isNaN(date.getTime())) return '';
  const datePart = formatDateDDMMYYYY(date);
  const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

