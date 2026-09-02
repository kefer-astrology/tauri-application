export type WheelStyleId = 'minimalist' | 'technical';

export interface WheelStyleOption {
  id: WheelStyleId;
  label: string;
  description: string;
}

export const wheelStyleOptions: WheelStyleOption[] = [
  {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'Sign ring with 12 divider lines only, no degree scale.',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Sign ring plus a full 360° degree tick scale.',
  },
];

const WHEEL_STYLE_STORAGE_KEY = 'wheel_style';

function isWheelStyleId(value: string): value is WheelStyleId {
  return value === 'minimalist' || value === 'technical';
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export function loadStoredWheelStyle(): WheelStyleId {
  if (!hasLocalStorage()) return 'technical';
  try {
    const value = localStorage.getItem(WHEEL_STYLE_STORAGE_KEY);
    if (value && isWheelStyleId(value)) return value;
  } catch {
    /* ignore */
  }
  return 'technical';
}

export const wheelStyleSettings = $state<{ activeStyle: WheelStyleId }>({
  activeStyle: loadStoredWheelStyle(),
});

export function setWheelStyle(next: WheelStyleId) {
  if (!isWheelStyleId(next)) return;
  if (wheelStyleSettings.activeStyle === next) return;
  wheelStyleSettings.activeStyle = next;
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(WHEEL_STYLE_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}
