export const USER_SETTINGS_UPDATED_EVENT = 'collegeopt:user-settings-updated';

export function emitUserSettingsUpdated(detail?: { aiEnabled?: boolean; profileUpdated?: boolean }) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(USER_SETTINGS_UPDATED_EVENT, { detail }));
}
