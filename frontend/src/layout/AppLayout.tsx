import { Home, FlaskConical, CalendarClock, Sparkles, Building2, Bell, LogOut, LayoutGrid, Users, ClipboardList, History, CheckSquare, MessageCircleMore, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../hooks/useTheme';
import { getCurrentUser, getUserSettings } from '../services/api';
import type { AppUser, UserSettingsResponse } from '../types';
import { USER_SETTINGS_UPDATED_EVENT } from '../utils/settingsSync';
import { clearStoredToken, getCurrentUserRoles } from '../utils/auth';

const primaryNavItems = [
  { to: '/app', label: 'Dashboard', icon: Home, subtitle: 'Overview of scheduling, allocation, and campus activity' },
  { to: '/app/resources', label: 'Resources', icon: Building2, subtitle: 'Manage classrooms, labs, equipment, and availability' },
  { to: '/app/departments', label: 'Departments', icon: LayoutGrid, subtitle: 'Browse academic branches, ownership, and operational detail' },
  { to: '/app/users', label: 'Identity & Access', icon: Users, subtitle: 'Create and manage principals, HODs, faculty, and students' },
  { to: '/app/timetable', label: 'Timetable', icon: CalendarClock, subtitle: 'Coordinate department schedules, slots, sections, and rooms' },
  { to: '/app/ai-assistant', label: 'AI Assistant', icon: Sparkles, subtitle: 'Use smart recommendations, forecasting, and timetable generation' },
  { to: '/app/lab-ops', label: 'Laboratories', icon: FlaskConical, subtitle: 'Track lab usage, readiness, and operational workflows' },
  { to: '/app/announcements', label: 'Announcements', icon: Bell, subtitle: 'Publish updates, notices, and communication to campus users' },
  { to: '/app/settings', label: 'Settings', icon: Settings2, subtitle: 'Personalize profile, theme engine, AI, privacy, and role-based preferences' }
];

const bookingNavItems = [
  { to: '/app/bookings', label: 'Bookings', icon: ClipboardList, subtitle: 'Create booking requests for classrooms, labs, and equipment' },
  { to: '/app/bookings/history', label: 'Booking History', icon: History, subtitle: 'Review previous booking activity, status, and outcomes' },
  { to: '/app/bookings/approvals', label: 'Booking Approvals', icon: CheckSquare, subtitle: 'Approve or reject pending requests with workflow visibility' }
];

export function AppLayout() {
  const { setLanguage, t } = useLanguage();
  const { themeName, toggleTheme } = useTheme();
  const location = useLocation();
  const roles = getCurrentUserRoles();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [settings, setSettings] = useState<UserSettingsResponse | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const isStudent = roles.includes('STUDENT');
  const isFaculty = roles.includes('FACULTY');
  const appBackgroundImage = roles.includes('SUPER_ADMIN')
    ? '/superadmin-bg.jpg'
    : roles.includes('COLLEGE_ADMIN')
      ? '/college-admin-bg.jpg'
      : roles.includes('FACULTY')
        ? '/faculty-bg.jpg'
        : roles.includes('STUDENT')
          ? '/student-bg.jpg'
          : null;

  const localizedPrimaryNavItems = [
    { ...primaryNavItems[0], label: t('nav.dashboard', primaryNavItems[0].label) },
    { ...primaryNavItems[1], label: t('nav.resources', primaryNavItems[1].label) },
    { ...primaryNavItems[2], label: t('nav.departments', primaryNavItems[2].label) },
    { ...primaryNavItems[3], label: t('nav.identity', primaryNavItems[3].label) },
    { ...primaryNavItems[4], label: t('nav.timetable', primaryNavItems[4].label) },
    { ...primaryNavItems[5], label: t('nav.aiAssistant', primaryNavItems[5].label) },
    { ...primaryNavItems[6], label: t('nav.laboratories', primaryNavItems[6].label) },
    { ...primaryNavItems[7], label: t('nav.announcements', primaryNavItems[7].label) },
    { ...primaryNavItems[8], label: t('nav.settings', primaryNavItems[8].label) }
  ];
  const localizedBookingNavItems = [
    { ...bookingNavItems[0], label: t('nav.bookings', bookingNavItems[0].label) },
    { ...bookingNavItems[1], label: t('nav.bookingHistory', bookingNavItems[1].label) },
    { ...bookingNavItems[2], label: t('nav.bookingApprovals', bookingNavItems[2].label) }
  ];

  const filteredNav = localizedPrimaryNavItems.filter(item => {
    if (item.label === 'Identity & Access' && isStudent) return false;
    if (item.label === 'Departments' && (isStudent || isFaculty)) return false;
    if (item.label === 'AI Assistant' && !aiEnabled) return false;
    return true;
  });

  const filteredBookingNav = localizedBookingNavItems.filter(item => {
    if (item.label === 'Booking Approvals' && !(roles.includes('COLLEGE_ADMIN') || roles.includes('SUPER_ADMIN'))) return false;
    return true;
  });

  const allNavItems = [...filteredNav, ...filteredBookingNav];
  const activePage = allNavItems
    .slice()
    .sort((first, second) => second.to.length - first.to.length)
    .find((item) => location.pathname === item.to || (item.to !== '/app' && location.pathname.startsWith(item.to)));

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [location.pathname]);

  useEffect(() => {
    getCurrentUser()
      .then(setProfile)
      .catch(() => {
        setProfile(null);
      });
    getUserSettings()
      .then((settings) => {
        setSettings(settings);
        setAiEnabled(settings.preferences.aiEnabled);
        if (typeof settings.preferences.roleSettings?.appLanguage === 'string') {
          setLanguage(settings.preferences.roleSettings.appLanguage as 'en' | 'ta' | 'hi');
        }
      })
      .catch(() => {
        setAiEnabled(true);
      });
  }, []);

  useEffect(() => {
    function handleSettingsUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ aiEnabled?: boolean; profileUpdated?: boolean }>;
      if (typeof customEvent.detail?.aiEnabled === 'boolean') {
        setAiEnabled(customEvent.detail.aiEnabled);
      }

      if (customEvent.detail?.profileUpdated) {
        getCurrentUser()
          .then(setProfile)
          .catch(() => {
            setProfile(null);
          });
      }

      getUserSettings()
        .then((settings) => {
          setSettings(settings);
          setAiEnabled(settings.preferences.aiEnabled);
        })
        .catch(() => {
          setAiEnabled(true);
        });
    }

    window.addEventListener(USER_SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
    return () => {
      window.removeEventListener(USER_SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!aiEnabled && location.pathname.startsWith('/app/ai-assistant')) {
      window.location.replace('/app/settings');
    }
  }, [aiEnabled, location.pathname]);

  const profileInitials = useMemo(() => {
    const source = profile?.fullName?.trim();
    if (!source) {
      return 'CO';
    }

    const initials = source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

    return initials || 'CO';
  }, [profile]);

  const accessScopeLabel = roles.includes('SUPER_ADMIN')
    ? t('layout.principalControl', 'Principal Control')
    : roles.includes('COLLEGE_ADMIN')
      ? t('layout.departmentOperations', 'Department Operations')
      : roles.includes('FACULTY')
        ? t('layout.facultyWorkspace', 'Faculty Workspace')
        : t('layout.studentWorkspace', 'Student Workspace');

  function logout() {
    clearStoredToken();
    window.location.href = '/login';
  }

  return (
    <div className="app-shell min-h-screen">
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute -left-14 top-16 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-700/20" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-700/20" />
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
          <aside className="border-r border-slate-200/70 bg-white/80 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 lg:p-5">
            <div className="flex h-full flex-col">
              <div className="rounded-[1.75rem] border border-white/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.24),transparent_32%),linear-gradient(160deg,rgba(15,23,42,0.96),rgba(15,23,42,0.78))] px-5 py-6 text-white shadow-2xl shadow-slate-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full bg-violet-500/95 shadow-[0_0_28px_rgba(139,92,246,0.7)]" />
                    <span className="-ml-2 h-4 w-4 rounded-full bg-indigo-400/95 opacity-90 shadow-[0_0_28px_rgba(96,165,250,0.6)]" />
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/70">
                    {accessScopeLabel}
                  </div>
                </div>

                <div className="mt-6 flex flex-col items-center text-center">
                  {settings?.profile.profileImageUrl ? (
                    <img
                      src={settings.profile.profileImageUrl}
                      alt={profile?.fullName ?? 'Profile'}
                      className="h-24 w-24 rounded-full border-2 border-white/40 object-cover shadow-lg shadow-slate-950/30"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/40 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.35),rgba(15,23,42,0.95))] text-2xl font-bold text-white shadow-lg shadow-slate-950/30">
                      {profileInitials}
                    </div>
                  )}
                  <p className="mt-4 font-display text-xl font-bold tracking-tight">
                    {profile?.fullName ?? 'CollegeOpt User'}
                  </p>
                  <p className="mt-1 text-sm text-cyan-100/75 break-all">
                    {profile?.email ?? 'profile@collegeopt.com'}
                  </p>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/60">Platform</p>
                  <p className="mt-2 text-sm font-medium text-white/90">{t('layout.platformName', 'CollegeOpt AI')}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-cyan-100/60">
                    {t('layout.platformTag', 'Resource Optimization')}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex-1 space-y-5">
                <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/70 p-3 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {t('nav.platform', 'Platform')}
                  </p>
                  <nav className="space-y-1.5">
                    {filteredNav.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25'
                            : 'text-slate-700 hover:bg-slate-100/90 dark:text-slate-200 dark:hover:bg-slate-800/70'
                          }`
                        }
                      >
                        <span className="rounded-xl border border-current/15 bg-white/10 p-2">
                          <item.icon size={17} />
                        </span>
                        <span className="tracking-tight">{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                </section>

                <section className="rounded-[1.75rem] border border-slate-200/80 bg-white/70 p-3 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {t('nav.bookingFlow', 'Booking Flow')}
                  </p>
                  <nav className="space-y-1.5 animate-[fade-up_0.45s_ease-out]">
                    {filteredBookingNav.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/25'
                            : 'text-slate-700 hover:bg-slate-100/90 dark:text-slate-200 dark:hover:bg-slate-800/70'
                          }`
                        }
                      >
                        <span className="rounded-xl border border-current/15 bg-white/10 p-2">
                          <item.icon size={17} />
                        </span>
                        <span className="tracking-tight">{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                </section>
              </div>

              <div className="mt-5 grid gap-3">
                <button
                  onClick={toggleTheme}
                  className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--card-color)] px-4 py-3 text-sm font-semibold text-[color:var(--text-color)] transition hover:brightness-110"
                >
                  {t('common.theme', 'Theme')}: {themeName}
                </button>
                <button
                  onClick={logout}
                  className="rounded-2xl border border-rose-300/80 bg-rose-50/80 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                >
                  <span className="inline-flex items-center gap-2">
                    <LogOut size={16} />
                    {t('common.logout', 'Logout')}
                  </span>
                </button>
              </div>
            </div>
          </aside>

          <main className="relative min-w-0 p-4 md:p-6 lg:p-8">
            {appBackgroundImage ? (
              <div
                className="pointer-events-none absolute inset-0 opacity-100"
                style={{
                  backgroundImage:
                    `linear-gradient(180deg, rgba(2,6,23,0.48) 0%, rgba(2,6,23,0.62) 38%, rgba(2,6,23,0.82) 100%), url('${appBackgroundImage}')`,
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: 'cover'
                }}
              />
            ) : null}
            <div className="relative z-10 min-w-0">
            <header className="mb-6 rounded-[1.75rem] border border-slate-200/80 bg-white/80 px-5 py-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{t('layout.campusControlCenter', 'Campus Control Center')}</p>
                  <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{activePage?.label ?? t('layout.defaultTitle', 'College Resource Optimization')}</h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {activePage?.subtitle ?? t('layout.defaultSubtitle', 'Smart scheduling, allocation, and campus operations')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300"
                    >
                      {role === 'SUPER_ADMIN' ? 'Principal' : role}
                    </span>
                  ))}
                </div>
              </div>
            </header>
            <Outlet />
            {aiEnabled ? (
              <NavLink
                to="/app/ai-assistant"
                className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-cyan-600/30 transition hover:bg-cyan-500 md:bottom-6 md:right-6"
              >
                <MessageCircleMore size={18} />
                {t('nav.aiAssistant', 'AI Assistant')}
              </NavLink>
            ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
