import type { RoleType } from '../types';

const TOKEN_STORAGE_KEY = 'cop_token';

type TokenPayload = {
  exp?: number;
  roles?: string[];
};

function decodeTokenPayload(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as { roles?: string[] };
  } catch {
    return null;
  }
}

export function getStoredToken() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) {
    return null;
  }

  const payload = decodeTokenPayload(token);
  if (!payload) {
    clearStoredToken();
    return null;
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    clearStoredToken();
    return null;
  }

  return token;
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function isAuthenticated() {
  return Boolean(getStoredToken());
}

export function getCurrentUserRoles(): RoleType[] {
  const token = getStoredToken();
  if (!token) {
    return [];
  }

  const payload = decodeTokenPayload(token);
  const roles = payload?.roles ?? [];

  return roles
    .map((role) => role.replace(/^ROLE_/, ''))
    .filter((role): role is RoleType =>
      role === 'SUPER_ADMIN' || role === 'COLLEGE_ADMIN' || role === 'FACULTY' || role === 'STUDENT'
    );
}

export function canManageCampusData() {
  const roles = getCurrentUserRoles();
  return roles.includes('SUPER_ADMIN') || roles.includes('COLLEGE_ADMIN');
}
