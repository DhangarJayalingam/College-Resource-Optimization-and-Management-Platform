import type {
  AiDemandPrediction,
  AiChatResponse,
  AiInsight,
  AiPanelResponse as AiRolePanelResponse,
  AiPrediction,
  AiRecommendation,
  ApiResponse,
  ClassRoom,
  ConflictItem,
  DashboardAnalytics,
  EquipmentItem,
  FacilityBooking,
  MaintenanceItem,
  ResourceItem,
  ResourceDashboard,
  ResourceInsight,
  ResourceSuggestion,
  ResourceScheduleItem,
  TimetableEntry,
  TimetableFormEntry,
  TimetableGenerationRequest,
  AppUser,
  DepartmentDetail,
  DepartmentFaculty,
  DepartmentStudent,
  DepartmentAnnouncement,
  BookingAnalytics,
  BookingItem,
  BookingNotification,
  BookingRecommendation,
  BestResourceSuggestion,
  UserSettingsResponse,
  UserPreferences,
  ProfileUpdateResponse,
  ActivityLogItem
} from '../types';
import { clearStoredToken, getStoredToken, setStoredToken } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath.startsWith('/login')) {
    return;
  }

  window.location.href = '/login?error=' + encodeURIComponent('Your session expired. Please sign in again.');
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const isAuthEndpoint = path.startsWith('/auth/');
  if (!token && !isAuthEndpoint) {
    redirectToLogin();
    throw new Error('Authentication required. Please login to call protected APIs.');
  }

  const headers = new Headers(init?.headers);
  const isFormData = init?.body instanceof FormData;
  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !isAuthEndpoint) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStoredToken();
      if (!isAuthEndpoint) {
        redirectToLogin();
      }
    }

    let message = `Request failed: ${response.status}`;
    try {
      const errorPayload = (await response.json()) as { message?: string; data?: unknown };
      if (typeof errorPayload.data === 'string' && errorPayload.data.trim()) {
        message = errorPayload.data;
      } else if (typeof errorPayload.message === 'string' && errorPayload.message.trim()) {
        message = errorPayload.message;
      } else if (errorPayload.data && typeof errorPayload.data === 'object') {
        const validationErrors = Object.entries(errorPayload.data as Record<string, unknown>)
          .filter(([, value]) => typeof value === 'string' && value.trim())
          .map(([field, value]) => `${field}: ${String(value).trim()}`);

        if (validationErrors.length > 0) {
          message = validationErrors.join(', ');
        }
      }
    } catch {
      // Keep default fallback message when response body is not JSON.
    }
    throw new Error(message);
  }
  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

async function authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  if (!token) {
    redirectToLogin();
    throw new Error('Authentication required. Please login to call protected APIs.');
  }

  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStoredToken();
      redirectToLogin();
    }

    let message = `Request failed: ${response.status}`;
    try {
      const errorPayload = (await response.json()) as { message?: string; data?: unknown };
      if (typeof errorPayload.message === 'string' && errorPayload.message.trim()) {
        message = errorPayload.message;
      }
    } catch {
      // Keep fallback message for non-JSON responses.
    }

    throw new Error(message);
  }

  return response;
}

export async function login(email: string, password: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const data = await apiRequest<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: normalizedEmail, password })
  });
  setStoredToken(data.token);
  return data.token;
}

export async function socialLogin(provider: 'GOOGLE' | 'LINKEDIN', email: string, fullName: string): Promise<string> {
  const data = await apiRequest<{ token: string }>('/auth/social-login', {
    method: 'POST',
    body: JSON.stringify({ provider, email, fullName })
  });
  setStoredToken(data.token);
  return data.token;
}

export async function sendVerificationCode(payload: {
  email: string;
  fullName?: string;
  purpose: 'REGISTRATION' | 'PASSWORD_RESET';
}): Promise<{ demoCode: string; expiresInMinutes: number; message: string }> {
  return apiRequest<{ demoCode: string; expiresInMinutes: number; message: string }>('/auth/verification/send', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function registerSelf(payload: {
  fullName: string;
  email: string;
  password: string;
  verificationCode: string;
}): Promise<string> {
  const data = await apiRequest<{ token: string }>('/auth/register-self', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  setStoredToken(data.token);
  return data.token;
}

export async function forgotPassword(email: string): Promise<{ demoCode: string; expiresInMinutes: number; message: string }> {
  return apiRequest<{ demoCode: string; expiresInMinutes: number; message: string }>('/auth/password/forgot', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function resetPassword(payload: {
  email: string;
  verificationCode: string;
  newPassword: string;
}): Promise<string> {
  return apiRequest<string>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<string> {
  return apiRequest<string>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function logoutAllSessions(includeCurrentSession: boolean): Promise<string> {
  return apiRequest<string>('/auth/logout-all-sessions', {
    method: 'POST',
    body: JSON.stringify({ includeCurrentSession })
  });
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  try {
    return await apiRequest<DashboardAnalytics>('/analytics/dashboard');
  } catch {
    return {
      resourceUtilizationRate: 76,
      classroomOccupancy: [
        { room: 'A-101', capacity: 40, status: 'IN_USE', occupancyPercent: 100 },
        { room: 'A-204', capacity: 70, status: 'AVAILABLE', occupancyPercent: 35 },
        { room: 'C-010', capacity: 60, status: 'AVAILABLE', occupancyPercent: 35 }
      ],
      facultyWorkload: { 'Dr. Ananya Rao': 9, 'Prof. S. Iyer': 7, 'Dr. Mehta': 5 },
      weeklyHeatmap: { MONDAY: 12, TUESDAY: 9, WEDNESDAY: 10, THURSDAY: 8, FRIDAY: 7, SATURDAY: 3 },
      idleResources: [
        { resourceType: 'CLASSROOM', resourceId: 2, resourceName: 'A-204', idleHours: 5 },
        { resourceType: 'CLASSROOM', resourceId: 4, resourceName: 'C-010', idleHours: 6 }
      ],
      departmentUsage: [
        { department: 'Computer Science', utilizationPercent: 82 },
        { department: 'Electrical', utilizationPercent: 66 },
        { department: 'Mechanical', utilizationPercent: 54 },
        { department: 'Civil', utilizationPercent: 47 }
      ]
    };
  }
}

export async function getTimetableEntries(): Promise<TimetableEntry[]> {
  try {
    return await apiRequest<TimetableEntry[]>('/timetable/entries');
  } catch {
    return [
      {
        id: 1,
        courseCode: 'CS101',
        academicLevel: 'FE',
        sectionCode: 'F1',
        facultyUserId: 3,
        facultyName: 'Dr. Ananya Rao',
        departmentId: 1,
        resourceId: 2,
        resourceName: 'A-204',
        dayOfWeek: 'MONDAY',
        startTime: '09:00:00',
        endTime: '10:00:00',
        duration: 1,
        type: 'LECTURE',
        classroomId: 2,
        laboratoryId: null,
        generatedByAi: true
      },
      {
        id: 2,
        courseCode: 'EE220',
        academicLevel: 'TE',
        sectionCode: 'T1',
        facultyUserId: 5,
        facultyName: 'Prof. S. Iyer',
        departmentId: 2,
        resourceId: 2,
        resourceName: 'LAB-EE-2',
        dayOfWeek: 'MONDAY',
        startTime: '09:00:00',
        endTime: '10:00:00',
        duration: 1,
        type: 'LECTURE',
        classroomId: null,
        laboratoryId: 2,
        generatedByAi: false
      }
    ];
  }
}

export async function getConflicts(): Promise<ConflictItem[]> {
  try {
    return await apiRequest<ConflictItem[]>('/timetable/conflicts');
  } catch {
    return [
      {
        conflictType: 'ROOM_DOUBLE_BOOKING',
        entryAId: 11,
        entryBId: 17,
        reason: 'Classroom A-204 is assigned to two sections at 09:00.'
      }
    ];
  }
}

export async function getClassrooms(): Promise<ClassRoom[]> {
  try {
    return await apiRequest<ClassRoom[]>('/resources/classrooms');
  } catch {
    return [
      { id: 1, roomCode: 'A-101', capacity: 40, tags: ['PROJECTOR', 'AC'], status: 'AVAILABLE' },
      { id: 2, roomCode: 'A-204', capacity: 70, tags: ['PROJECTOR', 'SMART_BOARD', 'AC'], status: 'AVAILABLE' },
      { id: 3, roomCode: 'B-310', capacity: 120, tags: ['SMART_BOARD', 'AC'], status: 'IN_USE' }
    ];
  }
}

export async function getResources(): Promise<ResourceItem[]> {
  return apiRequest<ResourceItem[]>('/resources');
}

export async function getEquipmentAssets(): Promise<EquipmentItem[]> {
  return apiRequest<EquipmentItem[]>('/resources/equipment');
}

export async function getFacilityBookings(): Promise<FacilityBooking[]> {
  return apiRequest<FacilityBooking[]>('/bookings/facility');
}

export async function getMaintenanceRecords(): Promise<MaintenanceItem[]> {
  return apiRequest<MaintenanceItem[]>('/maintenance');
}

export async function getResourceDashboard(): Promise<ResourceDashboard> {
  return apiRequest<ResourceDashboard>('/resources/dashboard');
}

export async function getResourceInsights(date?: string): Promise<ResourceInsight[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<ResourceInsight[]>(`/resources/insights${query}`);
}

export async function getResourceSchedule(date?: string): Promise<ResourceScheduleItem[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiRequest<ResourceScheduleItem[]>(`/resources/schedule${query}`);
}

export async function suggestBestManagedResource(payload: {
  resourceType: 'CLASSROOM' | 'LAB' | 'EQUIPMENT';
  capacity: number;
  departmentId?: number | null;
  building?: string;
  equipment?: string;
}): Promise<BestResourceSuggestion> {
  return apiRequest<BestResourceSuggestion>('/resources/suggest-best', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function createResource(payload: Omit<ResourceItem, 'id'>): Promise<ResourceItem> {
  return apiRequest<ResourceItem>('/resources', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateResource(id: number, payload: Omit<ResourceItem, 'id'>): Promise<ResourceItem> {
  return apiRequest<ResourceItem>(`/resources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function deleteResource(id: number): Promise<void> {
  await apiRequest<null>(`/resources/${id}`, {
    method: 'DELETE'
  });
}

export async function aiNaturalLanguageSearch(query: string) {
  return apiRequest<{
    normalizedQuery: string;
    capacityDetected: number;
    requiredTagsDetected: string[];
    matches: ClassRoom[];
    matchCount: number;
  }>('/ai/nl-search', {
    method: 'POST',
    body: JSON.stringify({ query })
  });
}

export async function aiRecommendResource(payload: {
  resourceType: string;
  expectedUsers: number;
  requiredTags: string[];
}): Promise<ResourceSuggestion> {
  return apiRequest<ResourceSuggestion>('/ai/recommend-resource', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function aiPredictDemand(payload: {
  resourceType: string;
  recentUtilizationPercentages: number[];
  currentInventory: number;
}): Promise<AiDemandPrediction> {
  return apiRequest<AiDemandPrediction>('/ai/demand-prediction', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function aiGenerateTimetable(payload: TimetableGenerationRequest): Promise<TimetableEntry[]> {
  return apiRequest<TimetableEntry[]>('/ai/generate-timetable', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getAiInsights(): Promise<AiRolePanelResponse<AiInsight>> {
  return apiRequest<AiRolePanelResponse<AiInsight>>('/ai/insights');
}

export async function getAiRecommendations(): Promise<AiRolePanelResponse<AiRecommendation>> {
  return apiRequest<AiRolePanelResponse<AiRecommendation>>('/ai/recommendations');
}

export async function getAiPredictions(): Promise<AiRolePanelResponse<AiPrediction>> {
  return apiRequest<AiRolePanelResponse<AiPrediction>>('/ai/predictions');
}

export async function queryAiAssistant(query: string): Promise<AiChatResponse> {
  return apiRequest<AiChatResponse>('/ai/query', {
    method: 'POST',
    body: JSON.stringify({ query })
  });
}

export async function getManagedTimetableEntries(): Promise<TimetableEntry[]> {
  return apiRequest<TimetableEntry[]>('/timetable');
}

export async function createManagedTimetableEntry(payload: TimetableFormEntry): Promise<TimetableEntry> {
  return apiRequest<TimetableEntry>('/timetable', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateManagedTimetableEntry(id: number, payload: TimetableFormEntry): Promise<TimetableEntry> {
  return apiRequest<TimetableEntry>(`/timetable/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function deleteManagedTimetableEntry(id: number): Promise<void> {
  await apiRequest<null>(`/timetable/${id}`, {
    method: 'DELETE'
  });
}

export async function bulkUploadTimetableEntries(file: File): Promise<{ successCount: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<{ successCount: number; errors: string[] }>('/timetable/bulk-upload', {
    method: 'POST',
    body: formData
  });
}

export async function downloadTimetableTemplate(): Promise<void> {
  const response = await authenticatedFetch('/timetable/bulk-template');
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = 'timetable-bulk-template.xlsx';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

// Announcements & File Uploads
export async function getAnnouncements(): Promise<any[]> {
  return apiRequest<any[]>('/announcements');
}

export async function createAnnouncement(payload: any): Promise<any> {
  return apiRequest<any>('/announcements', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function uploadAnnouncementAttachment(file: File): Promise<{ url: string; fileName: string; type: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<{ url: string; fileName: string; type: string }>('/announcements/upload', {
    method: 'POST',
    body: formData
  });
}

// Department Management
export interface Department {
  id: number;
  campusId: number;
  code: string;
  name: string;
  description: string;
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: 'FACULTY' | 'COLLEGE_ADMIN' | 'STUDENT';
  departmentId: number;
  pnrNo?: string;
  rollNo?: string;
  yearSemester?: 'FE' | 'SE' | 'TE' | 'BE';
}

export async function getDepartments(): Promise<Department[]> {
  return apiRequest<Department[]>('/departments');
}

export async function createDepartment(payload: Omit<Department, 'id'>): Promise<Department> {
  return apiRequest<Department>('/departments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateDepartment(id: number, payload: Department): Promise<Department> {
  return apiRequest<Department>(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function deleteDepartment(id: number): Promise<void> {
  await apiRequest<void>(`/departments/${id}`, {
    method: 'DELETE'
  });
}

export async function getDepartmentDetail(id: number): Promise<DepartmentDetail> {
  return apiRequest<DepartmentDetail>(`/departments/${id}`);
}

export async function getDepartmentFaculty(id: number): Promise<DepartmentFaculty[]> {
  return apiRequest<DepartmentFaculty[]>(`/departments/${id}/faculty`);
}

export async function getDepartmentStudents(id: number): Promise<DepartmentStudent[]> {
  return apiRequest<DepartmentStudent[]>(`/departments/${id}/students`);
}

export async function getDepartmentResources(id: number): Promise<ResourceItem[]> {
  return apiRequest<ResourceItem[]>(`/departments/${id}/resources`);
}

export async function getDepartmentTimetable(id: number): Promise<TimetableEntry[]> {
  return apiRequest<TimetableEntry[]>(`/departments/${id}/timetable`);
}

export async function getDepartmentAnnouncements(id: number): Promise<DepartmentAnnouncement[]> {
  return apiRequest<DepartmentAnnouncement[]>(`/departments/${id}/announcements`);
}

// User Management
export async function listUsers(): Promise<AppUser[]> {
  return apiRequest<AppUser[]>('/users');
}

export async function createUser(payload: CreateUserPayload): Promise<AppUser> {
  return apiRequest<AppUser>('/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function bulkUploadUsers(file: File): Promise<{ successCount: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<{ successCount: number; errors: string[] }>('/users/bulk-upload', {
    method: 'POST',
    body: formData
  });
}

export async function bulkDeleteUsers(file: File): Promise<{ successCount: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<{ successCount: number; errors: string[] }>('/users/bulk-delete', {
    method: 'POST',
    body: formData
  });
}

export async function downloadBulkUserTemplate(): Promise<void> {
  const response = await authenticatedFetch('/users/bulk-template');
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = 'bulk-user-template.xlsx';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export async function deleteUser(email: string): Promise<void> {
  await apiRequest<void>(`/users/${encodeURIComponent(email)}`, {
    method: 'DELETE'
  });
}

export async function assignDepartmentAdmin(userId: number, departmentId: number): Promise<AppUser> {
  return apiRequest<AppUser>(`/users/${userId}/assign-department-admin`, {
    method: 'POST',
    body: JSON.stringify({ departmentId })
  });
}

export async function clearOperationalData(mode: 'ANNOUNCEMENTS' | 'TIMETABLE' | 'RESOURCES' | 'ALL'): Promise<{
  scope: string;
  mode: string;
  departmentId: number | null;
  deletedCounts: Record<string, number>;
}> {
  return apiRequest<{
    scope: string;
    mode: string;
    departmentId: number | null;
    deletedCounts: Record<string, number>;
  }>('/operations/clear-data', {
    method: 'POST',
    body: JSON.stringify({ mode })
  });
}

export async function getCurrentUser(): Promise<AppUser> {
  return apiRequest<AppUser>('/users/me');
}

export async function getUserSettings(): Promise<UserSettingsResponse> {
  return apiRequest<UserSettingsResponse>('/user/settings');
}

export async function updateUserProfile(payload: {
  fullName: string;
  email: string;
  departmentId?: number;
  profileImage?: File | null;
}): Promise<ProfileUpdateResponse> {
  const formData = new FormData();
  formData.append('fullName', payload.fullName);
  formData.append('email', payload.email);
  if (payload.departmentId) {
    formData.append('departmentId', String(payload.departmentId));
  }
  if (payload.profileImage) {
    formData.append('profileImage', payload.profileImage);
  }

  return apiRequest<ProfileUpdateResponse>('/user/update', {
    method: 'PUT',
    body: formData
  });
}

export async function updateUserTheme(payload: {
  theme: string;
  customThemeName?: string | null;
  backgroundGradient?: string | null;
  cardColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  animationEnabled?: boolean;
  glassEffectEnabled?: boolean;
  autoThemeEnabled?: boolean;
}): Promise<UserPreferences> {
  return apiRequest<UserPreferences>('/user/theme', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function updateUserPreferences(payload: {
  emailNotificationsEnabled?: boolean;
  announcementAlertsEnabled?: boolean;
  aiAlertsEnabled?: boolean;
  systemUpdatesEnabled?: boolean;
  aiEnabled?: boolean;
  animationEnabled?: boolean;
  glassEffectEnabled?: boolean;
  autoThemeEnabled?: boolean;
  predictionLevel?: string;
  customThemeName?: string | null;
  backgroundGradient?: string | null;
  cardColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  roleSettings?: Record<string, unknown>;
}): Promise<UserPreferences> {
  return apiRequest<UserPreferences>('/user/preferences', {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function getUserActivityLogs(): Promise<ActivityLogItem[]> {
  return apiRequest<ActivityLogItem[]>('/user/activity-logs');
}

export async function exportUserData(): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>('/user/export');
}

export async function deleteOwnAccount(): Promise<string> {
  return apiRequest<string>('/user/delete-account', {
    method: 'DELETE'
  });
}

export async function requestBooking(payload: {
  resourceId: number;
  resourceType: 'CLASSROOM' | 'LAB' | 'EQUIPMENT';
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  remarks?: string;
  expectedCapacity?: number;
  recurring?: boolean;
  recurringPattern?: string;
  priorityOverride?: boolean;
}): Promise<BookingItem> {
  return apiRequest<BookingItem>('/bookings/request', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function approveBooking(id: number, remarks = ''): Promise<BookingItem> {
  return apiRequest<BookingItem>(`/bookings/approve/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ remarks })
  });
}

export async function rejectBooking(id: number, remarks = ''): Promise<BookingItem> {
  return apiRequest<BookingItem>(`/bookings/reject/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ remarks })
  });
}

export async function cancelBooking(id: number, remarks = ''): Promise<BookingItem> {
  return apiRequest<BookingItem>(`/bookings/cancel/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ remarks })
  });
}

export async function getBookingHistory(): Promise<BookingItem[]> {
  return apiRequest<BookingItem[]>('/bookings/history');
}

export async function getPendingBookingApprovals(): Promise<BookingItem[]> {
  return apiRequest<BookingItem[]>('/bookings/pending-approvals');
}

export async function getBookingRecommendations(params: {
  resourceType: 'CLASSROOM' | 'LAB' | 'EQUIPMENT';
  expectedCapacity?: number;
  date: string;
  startTime: string;
  endTime: string;
}): Promise<BookingRecommendation[]> {
  const query = new URLSearchParams({
    resourceType: params.resourceType,
    date: params.date,
    startTime: params.startTime,
    endTime: params.endTime
  });
  if (params.expectedCapacity) {
    query.set('expectedCapacity', String(params.expectedCapacity));
  }
  return apiRequest<BookingRecommendation[]>(`/bookings/recommend?${query.toString()}`);
}

export async function getBookingNotifications(): Promise<BookingNotification[]> {
  return apiRequest<BookingNotification[]>('/bookings/notifications');
}

export async function getBookingAnalytics(): Promise<BookingAnalytics> {
  return apiRequest<BookingAnalytics>('/bookings/analytics');
}
