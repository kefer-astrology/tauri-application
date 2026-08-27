// Time Navigation Store - Svelte 5 runes-based
// This file must be Svelte-compiled (.svelte.ts) to use runes

export type TimeStepUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years';

export interface TimeStep {
  unit: TimeStepUnit;
  value: number;
}

export interface TimeNavigationState {
  // Current time being viewed
  currentTime: Date;

  // Time range for computation
  startTime: Date;
  endTime: Date;

  // Current step size
  step: TimeStep;
}

// Initialize with sensible defaults
function getDefaultState(): TimeNavigationState {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    currentTime: now,
    startTime: sevenDaysAgo,
    endTime: now,
    step: { unit: 'hours', value: 1 },
  };
}

// Export state using Svelte 5 runes
export const timeNavigation = $state<TimeNavigationState>(getDefaultState());

// Helper: Add time step to date
function addTimeStep(date: Date, step: TimeStep): Date {
  const result = new Date(date);
  switch (step.unit) {
    case 'seconds':
      result.setUTCSeconds(result.getUTCSeconds() + step.value);
      break;
    case 'minutes':
      result.setUTCMinutes(result.getUTCMinutes() + step.value);
      break;
    case 'hours':
      result.setUTCHours(result.getUTCHours() + step.value);
      break;
    case 'days':
      result.setUTCDate(result.getUTCDate() + step.value);
      break;
    case 'months':
      result.setUTCMonth(result.getUTCMonth() + step.value);
      break;
    case 'years':
      result.setUTCFullYear(result.getUTCFullYear() + step.value);
      break;
  }
  return result;
}

// Helper: Subtract time step from date
function subtractTimeStep(date: Date, step: TimeStep): Date {
  const result = new Date(date);
  switch (step.unit) {
    case 'seconds':
      result.setUTCSeconds(result.getUTCSeconds() - step.value);
      break;
    case 'minutes':
      result.setUTCMinutes(result.getUTCMinutes() - step.value);
      break;
    case 'hours':
      result.setUTCHours(result.getUTCHours() - step.value);
      break;
    case 'days':
      result.setUTCDate(result.getUTCDate() - step.value);
      break;
    case 'months':
      result.setUTCMonth(result.getUTCMonth() - step.value);
      break;
    case 'years':
      result.setUTCFullYear(result.getUTCFullYear() - step.value);
      break;
  }
  return result;
}

// Navigation functions
export function stepForward() {
  timeNavigation.currentTime = addTimeStep(timeNavigation.currentTime, timeNavigation.step);
  // Clamp to end time
  if (timeNavigation.currentTime > timeNavigation.endTime) {
    timeNavigation.currentTime = new Date(timeNavigation.endTime);
  }
}

export function stepBackward() {
  timeNavigation.currentTime = subtractTimeStep(timeNavigation.currentTime, timeNavigation.step);
  // Clamp to start time
  if (timeNavigation.currentTime < timeNavigation.startTime) {
    timeNavigation.currentTime = new Date(timeNavigation.startTime);
  }
}

export function jumpToStart() {
  timeNavigation.currentTime = new Date(timeNavigation.startTime);
}

export function jumpToEnd() {
  timeNavigation.currentTime = new Date(timeNavigation.endTime);
}

export function jumpToNow() {
  timeNavigation.currentTime = new Date();
  // Update end time if now is beyond it
  if (timeNavigation.currentTime > timeNavigation.endTime) {
    timeNavigation.endTime = new Date(timeNavigation.currentTime);
  }
}

// Export function to get effective time (computed on access)
export function effectiveTime(): Date {
  return timeNavigation.currentTime;
}

// Format time for display
export function formatTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Format time with microseconds (for high precision)
export function formatTimePrecise(date: Date): string {
  const iso = date.toISOString();
  return iso.slice(0, 23).replace('T', ' '); // Includes milliseconds
}
