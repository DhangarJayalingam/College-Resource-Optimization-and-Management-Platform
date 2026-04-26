export type RoleType = 'SUPER_ADMIN' | 'COLLEGE_ADMIN' | 'FACULTY' | 'STUDENT';
export type AppLanguage = 'en' | 'ta' | 'hi';
export type SettingsCategory = 'profile' | 'security' | 'appearance' | 'notifications' | 'ai' | 'system' | 'privacy';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface DashboardAnalytics {
  resourceUtilizationRate: number;
  classroomOccupancy: Array<{
    room: string;
    capacity: number;
    status: string;
    occupancyPercent: number;
  }>;
  facultyWorkload: Record<string, number>;
  weeklyHeatmap: Record<string, number>;
  idleResources: Array<{
    resourceType: string;
    resourceId: number;
    resourceName: string;
    idleHours: number;
  }>;
  departmentUsage: Array<{
    department: string;
    utilizationPercent: number;
  }>;
}

export interface TimetableEntry {
  id: number;
  courseCode: string;
  academicLevel: 'FE' | 'SE' | 'TE' | 'BE';
  sectionCode: string;
  facultyUserId: number;
  facultyName: string;
  departmentId: number;
  resourceId: number | null;
  resourceName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  duration: number;
  type: 'LECTURE' | 'LAB';
  classroomId: number | null;
  laboratoryId: number | null;
  generatedByAi: boolean;
}

export interface ConflictItem {
  conflictType: string;
  entryAId: number;
  entryBId: number;
  reason: string;
}

export interface ResourceSuggestion {
  recommendationType: string;
  resource: Record<string, unknown>;
  score: number;
  explanation: string;
}

export interface ClassRoom {
  id: number;
  roomCode: string;
  capacity: number;
  tags: string[];
  status: string;
}

export interface ResourceItem {
  id: number;
  name: string;
  type: 'CLASSROOM' | 'LAB' | 'EQUIPMENT';
  capacity: number;
  building: string;
  departmentId: number;
  tags: string[];
  status: 'AVAILABLE' | 'IN_USE' | 'UNDER_MAINTENANCE' | 'MAINTENANCE';
  assignedLabId: number | null;
  lastMaintenanceDate: string | null;
}

export interface ResourceDashboard {
  utilizationPercent: number;
  activeBookings: number;
  mostUsedResource: string;
  underusedResources: string[];
}

export interface ResourceScheduleItem {
  resourceId: number;
  resourceName: string;
  resourceType: 'CLASSROOM' | 'LAB' | 'EQUIPMENT';
  departmentId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
}

export interface ResourceInsight {
  id: number;
  name: string;
  type: 'CLASSROOM' | 'LAB' | 'EQUIPMENT';
  capacity: number;
  building: string;
  departmentId: number;
  tags: string[];
  smartStatus: 'Available' | 'Occupied' | 'Reserved soon' | 'Maintenance' | string;
  utilizationPercent: number;
  usageLevel: 'High' | 'Moderate' | 'Low' | string;
  maintenanceAlert: boolean;
  maintenanceStatus: string;
  lastMaintenanceDate: string | null;
  nextBookingDate: string | null;
  nextBookingStartTime: string | null;
  nextBookingEndTime: string | null;
  activeBookings: number;
}

export interface BestResourceSuggestion {
  recommendationType: string;
  resourceId: number;
  resourceName: string;
  resourceType: 'CLASSROOM' | 'LAB' | 'EQUIPMENT';
  building: string;
  departmentId: number;
  score: number;
  explanation: string;
}

export interface TimetableFormEntry {
  course: string;
  academicLevel: 'FE' | 'SE' | 'TE' | 'BE';
  sectionCode: string;
  faculty: string;
  resourceId: number;
  resourceType: 'CLASSROOM' | 'LAB';
  type: 'LECTURE' | 'LAB';
  duration: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

export interface FacilityBooking {
  id: number;
  requestId: number;
  bookedByUserId: number;
  resourceType: string;
  resourceId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
}

export interface EquipmentItem {
  id: number;
  assetTag: string;
  assetName: string;
  category: string;
  status: string;
  assignedLabId: number | null;
}

export interface MaintenanceItem {
  id: number;
  resourceId: number | null;
  equipmentId: number | null;
  reportedBy: number;
  issueDescription: string;
  status: string;
  scheduledDate: string;
  completedDate: string | null;
}

export interface AiDemandPrediction {
  resourceType: string;
  nextWeekPredictedUtilization: number;
  recommendedAdditionalUnits: number;
  insight: string;
}

export interface AiInsight {
  title: string;
  summary: string;
  metric: string;
  severity: string;
}

export interface AiRecommendation {
  title: string;
  summary: string;
  action: string;
  priority: string;
}

export interface AiPrediction {
  title: string;
  summary: string;
  predictedValue: string;
  confidence: string;
}

export interface AiPanelResponse<T> {
  role: RoleType;
  scope: string;
  items: T[];
  samplePrompts: string[];
}

export interface AiChatResponse {
  role: RoleType;
  scope: string;
  answer: string;
  followUps: string[];
  sourceModules: string[];
}

export interface TimetableGenerationRequest {
  termName: string;
  sections: Array<{
    courseCode: string;
    sectionCode: string;
    expectedStudents: number;
    requiredTags: string[];
  }>;
}

export interface AppUser {
  id: number;
  tenantId: number;
  campusId: number;
  departmentId: number;
  fullName: string;
  email: string;
  roles: RoleType[];
}

export interface UserPreferences {
  userId: number;
  theme: string;
  emailNotificationsEnabled: boolean;
  announcementAlertsEnabled: boolean;
  aiAlertsEnabled: boolean;
  systemUpdatesEnabled: boolean;
  aiEnabled: boolean;
  animationEnabled: boolean;
  glassEffectEnabled: boolean;
  autoThemeEnabled: boolean;
  predictionLevel: string;
  profileImageUrl: string | null;
  customThemeName: string | null;
  backgroundGradient: string | null;
  cardColor: string | null;
  accentColor: string | null;
  textColor: string | null;
  roleSettings: Record<string, string>;
}

export interface UserSettingsProfile {
  userId: number;
  fullName: string;
  email: string;
  departmentId: number;
  departmentName: string | null;
  roles: RoleType[];
  profileImageUrl: string | null;
}

export interface UserSettingsResponse {
  profile: UserSettingsProfile;
  preferences: UserPreferences;
}

export interface Department {
  id: number;
  campusId: number;
  code: string;
  name: string;
  description: string;
}

export interface ProfileUpdateResponse {
  profile: UserSettingsProfile;
  requiresReauthentication: boolean;
}

export interface ActivityLogItem {
  id: number;
  userId: number;
  action: string;
  entityType: string;
  entityId: number;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface DepartmentDetail {
  id: number;
  name: string;
  code: string;
  description: string;
  campus: string;
  facultyCount: number;
  studentCount: number;
  resourceCount: number;
}

export interface DepartmentFaculty {
  id: number;
  name: string;
  email: string;
  subjects: string[];
}

export interface DepartmentStudent {
  id: number;
  name: string;
  email: string;
  pnrNo: string | null;
  rollNo: string | null;
  yearSemester: string;
  courses: string[];
}

export interface DepartmentAnnouncement {
  id: number;
  title: string;
  content: string;
  audience: string;
  createdByUserId: number;
  departmentId: number | null;
  recipientEmail: string | null;
  emailDeliveryStatus: string | null;
  publishedAt: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  fileName: string | null;
}

export interface BookingApprovalHistory {
  id: number;
  bookingId: number | null;
  stage: string;
  action: string;
  actorUserId: number;
  actorName: string;
  remarks: string;
  actionAt: string;
}

export interface BookingItem {
  id: number;
  userId: number;
  userName: string;
  resourceId: number;
  resourceName: string;
  resourceType: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: string;
  approvedBy: number | null;
  approvedAt: string | null;
  remarks: string;
  priority: string;
  requiresApproval: boolean;
  currentApprovalStage: string;
  recurringPattern: string | null;
  approvalHistory: BookingApprovalHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface BookingRecommendation {
  resourceId: number;
  resourceName: string;
  resourceType: string;
  building: string;
  suggestedStartTime: string;
  suggestedEndTime: string;
  reason: string;
}

export interface BookingNotification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export interface BookingAnalytics {
  totalBookings: number;
  pendingBookings: number;
  approvedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  resourceUsage: Array<{ resource: string; bookings: number }>;
  peakHours: Array<{ hour: string; count: number }>;
  bookingTrends: Array<{ date: string; count: number }>;
}
