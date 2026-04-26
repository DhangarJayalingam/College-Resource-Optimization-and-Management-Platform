import {
  Bell,
  Bot,
  Brush,
  Download,
  Eye,
  KeyRound,
  LockKeyhole,
  MonitorCog,
  Palette,
  Shield,
  Sparkles,
  Trash2,
  UserCircle2
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import {
  changePassword,
  deleteOwnAccount,
  exportUserData,
  getDepartments,
  getUserActivityLogs,
  getUserSettings,
  logoutAllSessions,
  updateUserPreferences,
  updateUserProfile,
  updateUserTheme
} from '../services/api';
import type {
  ActivityLogItem,
  AppLanguage,
  Department,
  SettingsCategory,
  UserSettingsResponse
} from '../types';
import { emitUserSettingsUpdated } from '../utils/settingsSync';
import { clearStoredToken, getCurrentUserRoles } from '../utils/auth';

const settingSections: Array<{
  id: SettingsCategory;
  label: string;
  icon: typeof UserCircle2;
  description: string;
}> = [
  { id: 'profile', label: 'Profile', icon: UserCircle2, description: 'Identity, department, and personal details' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password, sessions, and account safety' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Themes, motion, glass, and visual style' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email, system, and campus alerts' },
  { id: 'ai', label: 'AI Settings', icon: Bot, description: 'Assistant controls, prediction depth, and AI alerts' },
  { id: 'system', label: 'System Settings', icon: MonitorCog, description: 'Role-specific workspace preferences' },
  { id: 'privacy', label: 'Data & Privacy', icon: LockKeyhole, description: 'Exports, logs, and account controls' }
];

function Toggle({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="settings-toggle-row">
      <div>
        <p className="text-sm font-semibold tracking-tight">{label}</p>
        <p className="mt-1 text-sm text-[color:var(--muted-text-color)]">{description}</p>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`settings-switch ${checked ? 'is-active' : ''}`}
      >
        <span className="settings-switch-thumb" />
      </button>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { language, languages, setLanguage, t } = useLanguage();
  const roles = getCurrentUserRoles();
  const { appearance, presets, resolvedPalette, setThemeByName, syncAppearance, toggleTheme, themeName } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsCategory>('profile');
  const [settings, setSettings] = useState<UserSettingsResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    departmentId: ''
  });
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [customColors, setCustomColors] = useState({
    accentColor: '#60a5fa',
    textColor: '#e2e8f0',
    cardColor: 'rgba(15, 23, 42, 0.7)'
  });
  const [appearanceDraft, setAppearanceDraft] = useState({
    autoThemeEnabled: appearance.autoThemeEnabled,
    animationEnabled: appearance.animationEnabled,
    glassEffectEnabled: appearance.glassEffectEnabled
  });

  const roleLabel = roles.includes('SUPER_ADMIN')
    ? 'ADMIN'
    : roles.includes('COLLEGE_ADMIN')
      ? 'ADMIN'
      : roles.includes('FACULTY')
        ? 'FACULTY'
        : 'STUDENT';

  const currentPreferences = settings?.preferences ?? null;

  const roleSettings = useMemo(() => {
    const current = currentPreferences?.roleSettings ?? {};
    if (roleLabel === 'ADMIN') {
      return [
        {
          key: 'departmentRules',
          label: 'Department Rules',
          description: 'Shape escalation rules, approval patterns, and operating cadence.',
          options: ['Balanced', 'Strict', 'Flexible']
        },
        {
          key: 'systemConfiguration',
          label: 'System Configuration',
          description: 'Decide how visible operational metrics and control widgets should feel.',
          options: ['Guided', 'Detailed', 'Executive']
        }
      ];
    }
    if (roleLabel === 'FACULTY') {
      return [
        {
          key: 'timetablePreference',
          label: 'Timetable Preference',
          description: 'Prefer compact schedules or distributed teaching windows.',
          options: ['Balanced', 'Compact', 'Spread']
        },
        {
          key: 'resourcePreference',
          label: 'Resource Preference',
          description: 'Bias recommendations toward labs, classrooms, or availability.',
          options: ['Balanced', 'Labs First', 'Availability First']
        }
      ];
    }
    return [
      {
        key: 'dashboardLayout',
        label: 'Dashboard Preference',
        description: 'Students can view their saved dashboard style, but not edit it here.',
        options: [String(current.dashboardLayout ?? 'Focused')]
      }
    ];
  }, [currentPreferences?.roleSettings, roleLabel]);

  useEffect(() => {
    void Promise.all([getUserSettings(), getDepartments(), getUserActivityLogs()])
      .then(([settingsResponse, departmentResponse, logResponse]) => {
        setSettings(settingsResponse);
        if (typeof settingsResponse.preferences.roleSettings?.appLanguage === 'string') {
          setLanguage(settingsResponse.preferences.roleSettings.appLanguage as AppLanguage);
        }
        setDepartments(departmentResponse);
        setActivityLogs(logResponse);
        setProfileForm({
          fullName: settingsResponse.profile.fullName,
          email: settingsResponse.profile.email,
          departmentId: String(settingsResponse.profile.departmentId ?? '')
        });
        setAppearanceDraft({
          autoThemeEnabled: settingsResponse.preferences.autoThemeEnabled,
          animationEnabled: settingsResponse.preferences.animationEnabled,
          glassEffectEnabled: settingsResponse.preferences.glassEffectEnabled
        });
        setCustomColors({
          accentColor: settingsResponse.preferences.accentColor ?? resolvedPalette.accentColor,
          textColor: settingsResponse.preferences.textColor ?? resolvedPalette.textColor,
          cardColor: settingsResponse.preferences.cardColor ?? resolvedPalette.cardColor
        });
        syncAppearance({
          theme: settingsResponse.preferences.theme,
          customThemeName: settingsResponse.preferences.customThemeName,
          backgroundGradient: settingsResponse.preferences.backgroundGradient,
          cardColor: settingsResponse.preferences.cardColor,
          accentColor: settingsResponse.preferences.accentColor,
          textColor: settingsResponse.preferences.textColor,
          animationEnabled: settingsResponse.preferences.animationEnabled,
          glassEffectEnabled: settingsResponse.preferences.glassEffectEnabled,
          autoThemeEnabled: settingsResponse.preferences.autoThemeEnabled
        });
      })
      .catch((error: Error) => {
        setStatusMessage(error.message);
      });
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProfile(true);
    setStatusMessage(null);
    try {
      const response = await updateUserProfile({
        fullName: profileForm.fullName,
        email: profileForm.email,
        departmentId: profileForm.departmentId ? Number(profileForm.departmentId) : undefined,
        profileImage
      });
      if (settings) {
        setSettings({
          ...settings,
          profile: response.profile
        });
      }
      emitUserSettingsUpdated({ profileUpdated: true });
      setStatusMessage(response.requiresReauthentication
        ? 'Profile saved. Email changed, so please sign in again.'
        : 'Profile updated successfully.');
      if (response.requiresReauthentication) {
        clearStoredToken();
        window.location.href = '/login?error=' + encodeURIComponent('Please sign in again with your updated email.');
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function saveAppearance() {
    setIsSavingPrefs(true);
    setStatusMessage(null);
    try {
      const themeResponse = await updateUserTheme({
        theme: String(appearance.theme),
        backgroundGradient: appearance.theme === 'Custom'
          ? `linear-gradient(135deg, ${customColors.accentColor}22 0%, ${customColors.cardColor} 58%, ${customColors.accentColor} 100%)`
          : appearance.backgroundGradient,
        cardColor: appearance.theme === 'Custom' ? customColors.cardColor : appearance.cardColor,
        accentColor: appearance.theme === 'Custom' ? customColors.accentColor : appearance.accentColor,
        textColor: appearance.theme === 'Custom' ? customColors.textColor : appearance.textColor,
        animationEnabled: appearanceDraft.animationEnabled,
        glassEffectEnabled: appearanceDraft.glassEffectEnabled,
        autoThemeEnabled: appearanceDraft.autoThemeEnabled
      });
      syncAppearance({
        ...themeResponse
      });
      if (settings) {
        setSettings({
          ...settings,
          preferences: themeResponse
        });
      }
      setStatusMessage('Appearance saved and synced.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not save appearance.');
    } finally {
      setIsSavingPrefs(false);
    }
  }

  async function savePreferenceGroup(next: UserSettingsResponse['preferences']) {
    setIsSavingPrefs(true);
    setStatusMessage(null);
    try {
      const updated = await updateUserPreferences({
        emailNotificationsEnabled: next.emailNotificationsEnabled,
        announcementAlertsEnabled: next.announcementAlertsEnabled,
        aiAlertsEnabled: next.aiAlertsEnabled,
        systemUpdatesEnabled: next.systemUpdatesEnabled,
        aiEnabled: next.aiEnabled,
        animationEnabled: next.animationEnabled,
        glassEffectEnabled: next.glassEffectEnabled,
        autoThemeEnabled: next.autoThemeEnabled,
        predictionLevel: next.predictionLevel,
        customThemeName: next.customThemeName,
        backgroundGradient: next.backgroundGradient,
        cardColor: next.cardColor,
        accentColor: next.accentColor,
        textColor: next.textColor,
        roleSettings: next.roleSettings
      });
      syncAppearance({
        ...updated
      });
      if (settings) {
        setSettings({
          ...settings,
          preferences: updated
        });
      }
      emitUserSettingsUpdated({ aiEnabled: updated.aiEnabled });
      setStatusMessage('Preferences updated.');
      if (typeof next.roleSettings?.appLanguage === 'string') {
        setLanguage(next.roleSettings.appLanguage as AppLanguage);
        setStatusMessage(t('settings.languageSaved', 'Language updated.'));
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not update preferences.');
    } finally {
      setIsSavingPrefs(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setStatusMessage('New password and confirmation do not match.');
      return;
    }
    try {
      await changePassword({
        currentPassword: securityForm.currentPassword,
        newPassword: securityForm.newPassword
      });
      clearStoredToken();
      window.location.href = '/login?error=' + encodeURIComponent('Password updated. Please sign in again.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not change password.');
    }
  }

  async function handleLogoutAllSessions() {
    try {
      await logoutAllSessions(true);
      clearStoredToken();
      window.location.href = '/login?error=' + encodeURIComponent('All sessions were signed out.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not log out all sessions.');
    }
  }

  async function handleExportData() {
    try {
      const payload = await exportUserData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'collegeopt-settings-export.json';
      anchor.click();
      URL.revokeObjectURL(url);
      setStatusMessage('Your data export is ready.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not export your data.');
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm('Delete this account permanently? This cannot be undone.');
    if (!confirmed) {
      return;
    }
    try {
      await deleteOwnAccount();
      clearStoredToken();
      navigate('/login');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not delete account.');
    }
  }

  const previewGradient = appearance.theme === 'Custom'
    ? `linear-gradient(135deg, ${customColors.accentColor}22 0%, ${customColors.cardColor} 58%, ${customColors.accentColor} 100%)`
    : resolvedPalette.backgroundGradient;

  return (
    <div className="fade-up">
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="settings-sidebar">
          <div className="settings-sidebar-hero">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 p-3">
              <Brush size={18} />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.32em] text-white/70">Control Surface</p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white">Settings Studio</h2>
            <p className="mt-2 text-sm text-white/75">
              Shape security, AI, appearance, and role-aware behavior from one premium control panel.
            </p>
          </div>

          <nav className="mt-4 space-y-2">
            {settingSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`settings-nav-item ${activeSection === section.id ? 'is-active' : ''}`}
              >
                <section.icon size={18} />
                <span>
                  <span className="block text-left text-sm font-semibold">{section.label}</span>
                  <span className="mt-1 block text-left text-xs text-[color:var(--muted-text-color)]">
                    {section.description}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="space-y-6">
          <div className="settings-banner" style={{ backgroundImage: previewGradient }}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Live Preview</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
                {settings?.profile.fullName ?? 'Campus User'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Current look: {themeName}. Accent and glass changes preview instantly before you persist them.
              </p>
            </div>
            <div className="settings-mini-preview">
              <div className="settings-mini-card">
                <Sparkles size={16} />
                <span>AI Assistant</span>
              </div>
              <div className="settings-mini-card">
                <Eye size={16} />
                <span>Glass Live</span>
              </div>
            </div>
          </div>

          {statusMessage ? <div className="settings-inline-message">{statusMessage}</div> : null}

          {activeSection === 'profile' && settings ? (
            <form onSubmit={saveProfile} className="settings-panel">
              <div className="settings-section-header">
                <div>
                  <p className="settings-kicker">Profile Settings</p>
                  <h3 className="settings-heading">Personal identity and academic context</h3>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="settings-avatar-block">
                  {settings.profile.profileImageUrl ? (
                    <img src={settings.profile.profileImageUrl} alt={settings.profile.fullName} className="settings-avatar-image" />
                  ) : (
                    <div className="settings-avatar-fallback">
                      {settings.profile.fullName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <label className="settings-upload-button">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => setProfileImage(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <p className="text-xs text-[color:var(--muted-text-color)]">
                    JPG, PNG, or WebP. Your theme-tinted avatar card updates after save.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="settings-field">
                    <span>Name</span>
                    <input
                      value={profileForm.fullName}
                      onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="settings-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="settings-field">
                    <span>Department</span>
                    <select
                      value={profileForm.departmentId}
                      onChange={(event) => setProfileForm((current) => ({ ...current, departmentId: event.target.value }))}
                      disabled={!(roles.includes('SUPER_ADMIN') || roles.includes('COLLEGE_ADMIN'))}
                    >
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field">
                    <span>Role</span>
                    <input value={settings.profile.roles.join(', ')} readOnly />
                  </label>
                </div>
              </div>

              <div className="settings-actions">
                <button type="submit" className="settings-primary-button" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          ) : null}

          {activeSection === 'security' ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
              <form onSubmit={handlePasswordChange} className="settings-panel">
                <div className="settings-section-header">
                  <div>
                    <p className="settings-kicker">Security</p>
                    <h3 className="settings-heading">Password and session management</h3>
                  </div>
                </div>
                <div className="grid gap-4">
                  <label className="settings-field">
                    <span>Current Password</span>
                    <input
                      type="password"
                      value={securityForm.currentPassword}
                      onChange={(event) => setSecurityForm((current) => ({ ...current, currentPassword: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="settings-field">
                    <span>New Password</span>
                    <input
                      type="password"
                      value={securityForm.newPassword}
                      onChange={(event) => setSecurityForm((current) => ({ ...current, newPassword: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="settings-field">
                    <span>Confirm New Password</span>
                    <input
                      type="password"
                      value={securityForm.confirmPassword}
                      onChange={(event) => setSecurityForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      required
                    />
                  </label>
                </div>
                <div className="settings-actions">
                  <button type="submit" className="settings-primary-button">
                    <KeyRound size={16} />
                    Change Password
                  </button>
                </div>
              </form>

              <div className="settings-panel">
                <div className="settings-section-header">
                  <div>
                    <p className="settings-kicker">Active Sessions</p>
                    <h3 className="settings-heading">Invalidate every signed-in device</h3>
                  </div>
                </div>
                <p className="text-sm text-[color:var(--muted-text-color)]">
                  Use this when you suspect device compromise or want to force a clean sign-in everywhere.
                </p>
                <div className="settings-actions">
                  <button type="button" className="settings-secondary-button" onClick={handleLogoutAllSessions}>
                    Logout All Sessions
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          
          {activeSection === 'appearance' ? (
            <div className="space-y-6">
              <div className="settings-panel">
                <div className="settings-section-header">
                  <div>
                    <p className="settings-kicker">Appearance Engine</p>
                    <h3 className="settings-heading">Premium themes with live campus-shell preview</h3>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setThemeByName(preset.name);
                        syncAppearance({
                          theme: preset.name,
                          backgroundGradient: preset.backgroundGradient,
                          cardColor: preset.cardColor,
                          accentColor: preset.accentColor,
                          textColor: preset.textColor
                        });
                      }}
                      className={`theme-card ${appearance.theme === preset.name ? 'is-selected' : ''}`}
                    >
                      <div className="theme-card-preview" style={{ backgroundImage: preset.backgroundGradient }}>
                        <span style={{ backgroundColor: preset.cardColor }} />
                        <span style={{ backgroundColor: preset.accentColor }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{preset.name}</p>
                        <p className="mt-1 text-xs text-[color:var(--muted-text-color)]">
                          Accent tuned for the glassmorphism shell.
                        </p>
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setThemeByName('Custom')}
                    className={`theme-card ${appearance.theme === 'Custom' ? 'is-selected' : ''}`}
                  >
                    <div className="theme-card-preview" style={{ backgroundImage: previewGradient }}>
                      <span style={{ backgroundColor: customColors.cardColor }} />
                      <span style={{ backgroundColor: customColors.accentColor }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Custom Theme</p>
                      <p className="mt-1 text-xs text-[color:var(--muted-text-color)]">
                        Pick your own accent, glass tone, and typography contrast.
                      </p>
                    </div>
                  </button>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <label className="settings-field">
                    <span>Custom Accent</span>
                    <input
                      type="color"
                      value={customColors.accentColor}
                      onChange={(event) => {
                        const next = event.target.value;
                        setCustomColors((current) => ({ ...current, accentColor: next }));
                        syncAppearance({ theme: 'Custom', accentColor: next });
                      }}
                    />
                  </label>
                  <label className="settings-field">
                    <span>Custom Text</span>
                    <input
                      type="color"
                      value={customColors.textColor}
                      onChange={(event) => {
                        const next = event.target.value;
                        setCustomColors((current) => ({ ...current, textColor: next }));
                        syncAppearance({ theme: 'Custom', textColor: next });
                      }}
                    />
                  </label>
                  <label className="settings-field">
                    <span>Custom Glass</span>
                    <input
                      type="text"
                      value={customColors.cardColor}
                      onChange={(event) => {
                        const next = event.target.value;
                        setCustomColors((current) => ({ ...current, cardColor: next }));
                        syncAppearance({ theme: 'Custom', cardColor: next });
                      }}
                    />
                  </label>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <Toggle
                    label="Auto Theme"
                    description="Shift between light and dark automatically based on time of day."
                    checked={appearanceDraft.autoThemeEnabled}
                    onChange={(next) => {
                      setAppearanceDraft((current) => ({ ...current, autoThemeEnabled: next }));
                      syncAppearance({ autoThemeEnabled: next });
                    }}
                  />
                  <Toggle
                    label="Enable Animations"
                    description="Use soft transitions and layered reveals across the interface."
                    checked={appearanceDraft.animationEnabled}
                    onChange={(next) => {
                      setAppearanceDraft((current) => ({ ...current, animationEnabled: next }));
                      syncAppearance({ animationEnabled: next });
                    }}
                  />
                  <Toggle
                    label="Glass Effect"
                    description="Apply blur and frosted translucency to cards, nav, and panels."
                    checked={appearanceDraft.glassEffectEnabled}
                    onChange={(next) => {
                      setAppearanceDraft((current) => ({ ...current, glassEffectEnabled: next }));
                      syncAppearance({ glassEffectEnabled: next });
                    }}
                  />
                  <Toggle
                    label="Dark / Light Quick Switch"
                    description="Instantly flip between dark and light presets from your current context."
                    checked={themeName === 'Dark'}
                    onChange={() => toggleTheme()}
                  />
                </div>

                <div className="settings-actions">
                  <button type="button" className="settings-primary-button" disabled={isSavingPrefs} onClick={saveAppearance}>
                    {isSavingPrefs ? 'Saving...' : 'Save Appearance'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'notifications' && currentPreferences ? (
            <div className="settings-panel">
              <div className="settings-section-header">
                <div>
                  <p className="settings-kicker">Notifications</p>
                  <h3 className="settings-heading">Choose what deserves your attention</h3>
                </div>
              </div>
              <div className="grid gap-3">
                <Toggle
                  label="Email Notifications"
                  description="Receive account and campus updates in your inbox."
                  checked={currentPreferences.emailNotificationsEnabled}
                  onChange={(next) => void savePreferenceGroup({ ...currentPreferences, emailNotificationsEnabled: next })}
                />
                <Toggle
                  label="Announcement Alerts"
                  description="Get pushed when new department or campus notices go live."
                  checked={currentPreferences.announcementAlertsEnabled}
                  onChange={(next) => void savePreferenceGroup({ ...currentPreferences, announcementAlertsEnabled: next })}
                />
                <Toggle
                  label="AI Alerts"
                  description="Surface predictive insights and AI recommendations proactively."
                  checked={currentPreferences.aiAlertsEnabled}
                  onChange={(next) => void savePreferenceGroup({ ...currentPreferences, aiAlertsEnabled: next })}
                />
                <Toggle
                  label="System Updates"
                  description="Receive maintenance windows, release updates, and operational notices."
                  checked={currentPreferences.systemUpdatesEnabled}
                  onChange={(next) => void savePreferenceGroup({ ...currentPreferences, systemUpdatesEnabled: next })}
                />
              </div>
            </div>
          ) : null}

          {activeSection === 'ai' && currentPreferences ? (
            <div className="settings-panel">
              <div className="settings-section-header">
                <div>
                  <p className="settings-kicker">AI Configuration</p>
                  <h3 className="settings-heading">Tune the intelligence layer for your workflow</h3>
                </div>
              </div>
              <div className="grid gap-3">
                <Toggle
                  label="Enable AI Assistant"
                  description="Turn the role-aware assistant on or off across dashboards and side panels."
                  checked={currentPreferences.aiEnabled}
                  onChange={(next) => void savePreferenceGroup({ ...currentPreferences, aiEnabled: next })}
                />
                <Toggle
                  label="AI Alert Notifications"
                  description="Receive AI alerts about conflicts, overload, and optimization opportunities."
                  checked={currentPreferences.aiAlertsEnabled}
                  onChange={(next) => void savePreferenceGroup({ ...currentPreferences, aiAlertsEnabled: next })}
                />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="settings-field">
                  <span>Prediction Level</span>
                  <select
                    value={currentPreferences.predictionLevel}
                    onChange={(event) => void savePreferenceGroup({
                      ...currentPreferences,
                      predictionLevel: event.target.value
                    })}
                  >
                    <option value="BASIC">Basic</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {activeSection === 'system' && currentPreferences ? (
            <div className="settings-panel">
              <div className="settings-section-header">
                <div>
                  <p className="settings-kicker">Role-Based Configuration</p>
                  <h3 className="settings-heading">
                    {roleLabel === 'ADMIN'
                      ? 'Administrative operating preferences'
                      : roleLabel === 'FACULTY'
                        ? 'Faculty workflow preferences'
                        : 'Student dashboard visibility'}
                  </h3>
                </div>
              </div>
              <div className="mb-4 grid gap-2">
                <label className="settings-field">
                  <span>{t('settings.languageLabel', 'Application Language')}</span>
                  <select
                    value={language}
                    onChange={(event) => {
                      const nextLanguage = event.target.value as AppLanguage;
                      setLanguage(nextLanguage);
                      void savePreferenceGroup({
                        ...currentPreferences,
                        roleSettings: {
                          ...currentPreferences.roleSettings,
                          appLanguage: nextLanguage
                        }
                      });
                    }}
                  >
                    {languages.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="text-xs text-[color:var(--muted-text-color)]">
                    {t('settings.languageDescription', 'Choose the language used across the application for better readability.')}
                  </small>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {roleSettings.map((setting) => (
                  <label key={setting.key} className="settings-field">
                    <span>{setting.label}</span>
                    <select
                      disabled={roleLabel === 'STUDENT'}
                      value={String(currentPreferences.roleSettings?.[setting.key] ?? setting.options[0])}
                      onChange={(event) => {
                        const nextRoleSettings = {
                          ...currentPreferences.roleSettings,
                          [setting.key]: event.target.value
                        };
                        void savePreferenceGroup({
                          ...currentPreferences,
                          roleSettings: nextRoleSettings
                        });
                      }}
                    >
                      {setting.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <small className="text-xs text-[color:var(--muted-text-color)]">{setting.description}</small>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === 'privacy' ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="settings-panel">
                <div className="settings-section-header">
                  <div>
                    <p className="settings-kicker">Data & Privacy</p>
                    <h3 className="settings-heading">Export, inspect, or remove account data</h3>
                  </div>
                </div>
                <div className="grid gap-3">
                  <button type="button" className="settings-secondary-button" onClick={handleExportData}>
                    <Download size={16} />
                    Download User Data
                  </button>
                  <button type="button" className="settings-danger-button" onClick={handleDeleteAccount}>
                    <Trash2 size={16} />
                    Delete Account
                  </button>
                </div>
              </div>

              <div className="settings-panel">
                <div className="settings-section-header">
                  <div>
                    <p className="settings-kicker">Activity Logs</p>
                    <h3 className="settings-heading">Recent actions across your account scope</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {activityLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="settings-log-row">
                      <div>
                        <p className="text-sm font-semibold">{log.action}</p>
                        <p className="mt-1 text-xs text-[color:var(--muted-text-color)]">
                          {log.entityType} #{log.entityId}
                        </p>
                      </div>
                      <span className="text-xs text-[color:var(--muted-text-color)]">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {activityLogs.length === 0 ? (
                    <p className="text-sm text-[color:var(--muted-text-color)]">No activity logs available yet.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
