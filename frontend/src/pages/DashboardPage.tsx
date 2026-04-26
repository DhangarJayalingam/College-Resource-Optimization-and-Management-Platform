import { Activity, Building2, CalendarClock, Cpu, Users, GraduationCap, ClipboardList, Bell } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { MetricCard } from '../components/MetricCard';
import { SectionCard } from '../components/SectionCard';
import { Badge } from '../components/Badge';
import { useLanguage } from '../context/LanguageContext';
import { getDashboardAnalytics, getAnnouncements, getCurrentUser as fetchProfile, getDepartments } from '../services/api';
import { subscribeToResourceStatus } from '../services/resourceStatusSocket';
import type { DashboardAnalytics, AppUser, DepartmentAnnouncement } from '../types';
import { getCurrentUserRoles } from '../utils/auth';

const chartTooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.96)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  borderRadius: '16px',
  boxShadow: '0 18px 48px rgba(2, 6, 23, 0.35)',
  color: '#e2e8f0'
} as const;

const chartTooltipLabelStyle = {
  color: '#f8fafc',
  fontWeight: 700,
  marginBottom: 8
} as const;

const chartTooltipItemStyle = {
  color: '#e2e8f0',
  fontSize: 14
} as const;

const roleHeroConfig = {
  SUPER_ADMIN: {
    title: 'Principal Dashboard',
    subtitle: 'Global visibility across campuses, workload distribution, and AI planning signals.',
    accent: 'from-sky-950/90 via-cyan-900/75 to-emerald-700/55',
    badgeLabel: 'Executive View'
  },
  COLLEGE_ADMIN: {
    title: 'Department Admin',
    subtitle: 'Track departmental utilization, resolve bottlenecks, and keep resources moving.',
    accent: 'from-slate-950/90 via-blue-900/75 to-amber-600/50',
    badgeLabel: 'Operations View'
  },
  FACULTY: {
    title: 'Faculty Portal',
    subtitle: 'See teaching load, classroom access, and weekly schedule context at a glance.',
    accent: 'from-slate-950/90 via-violet-900/75 to-fuchsia-700/45',
    badgeLabel: 'Faculty View'
  },
  STUDENT: {
    title: 'Student Hub',
    subtitle: 'Stay on top of attendance, upcoming sessions, and campus updates from one screen.',
    accent: 'from-slate-950/90 via-teal-900/75 to-cyan-500/45',
    badgeLabel: 'Student View'
  }
} as const;

export function DashboardPage() {
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [announcements, setAnnouncements] = useState<DepartmentAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [departmentScopeLabel, setDepartmentScopeLabel] = useState('');

  const roles = getCurrentUserRoles();
  const isPrincipal = roles.includes('SUPER_ADMIN');
  const isAdmin = roles.includes('COLLEGE_ADMIN');
  const isFaculty = roles.includes('FACULTY');
  const isStudent = roles.includes('STUDENT');
  const roleKey = roles.join('|');
  const primaryRole = isPrincipal
    ? 'SUPER_ADMIN'
    : isAdmin
      ? 'COLLEGE_ADMIN'
      : isFaculty
        ? 'FACULTY'
        : 'STUDENT';
  const hero = roleHeroConfig[primaryRole];
  const localizedHero = {
    ...hero,
    title: primaryRole === 'SUPER_ADMIN'
      ? t('dashboard.principalTitle', hero.title)
      : primaryRole === 'COLLEGE_ADMIN'
        ? t('dashboard.adminTitle', hero.title)
        : primaryRole === 'FACULTY'
          ? t('dashboard.facultyTitle', hero.title)
          : t('dashboard.studentTitle', hero.title),
    badgeLabel: primaryRole === 'SUPER_ADMIN'
      ? t('dashboard.executiveView', hero.badgeLabel)
      : primaryRole === 'COLLEGE_ADMIN'
        ? t('dashboard.operationsView', hero.badgeLabel)
        : primaryRole === 'FACULTY'
          ? t('dashboard.facultyView', hero.badgeLabel)
          : t('dashboard.studentView', hero.badgeLabel)
  };

  useEffect(() => {
    Promise.all([getDashboardAnalytics(), getAnnouncements(), fetchProfile(), getDepartments()])
      .then(([aData, annData, profileData, departmentData]) => {
        setAnalytics(aData);
        setProfile(profileData);
        const currentDepartment = departmentData.find((department) => department.id === profileData.departmentId);
        setDepartmentScopeLabel(currentDepartment ? `${currentDepartment.code} · ${currentDepartment.name}` : `Department #${profileData.departmentId}`);
        const scopedAnnouncements = roles.includes('SUPER_ADMIN')
          ? annData
          : annData.filter((announcement) => announcement.departmentId === null || announcement.departmentId === profileData.departmentId);
        setAnnouncements(scopedAnnouncements.slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncDashboard = async () => {
      try {
        const [aData, annData, profileData, departmentData] = await Promise.all([
          getDashboardAnalytics(),
          getAnnouncements(),
          fetchProfile(),
          getDepartments()
        ]);

        if (!isMounted) {
          return;
        }

        setAnalytics(aData);
        setProfile(profileData);
        const currentDepartment = departmentData.find((department) => department.id === profileData.departmentId);
        setDepartmentScopeLabel(currentDepartment ? `${currentDepartment.code} · ${currentDepartment.name}` : `Department #${profileData.departmentId}`);
        const scopedAnnouncements = roles.includes('SUPER_ADMIN')
          ? annData
          : annData.filter((announcement) => announcement.departmentId === null || announcement.departmentId === profileData.departmentId);
        setAnnouncements(scopedAnnouncements.slice(0, 3));
      } catch {
        // Keep the current dashboard snapshot if a background refresh fails.
      }
    };

    const handleVisibilitySync = () => {
      if (document.visibilityState === 'visible') {
        void syncDashboard();
      }
    };

    const refreshInterval = window.setInterval(() => {
      void syncDashboard();
    }, 10000);

    window.addEventListener('focus', handleVisibilitySync);
    document.addEventListener('visibilitychange', handleVisibilitySync);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', handleVisibilitySync);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
    };
  }, [roleKey]);

  useEffect(() => {
    const unsubscribe = subscribeToResourceStatus(() => {
      void Promise.all([getDashboardAnalytics(), getAnnouncements(), fetchProfile(), getDepartments()])
        .then(([aData, annData, profileData, departmentData]) => {
          setAnalytics(aData);
          setProfile(profileData);
          const currentDepartment = departmentData.find((department) => department.id === profileData.departmentId);
          setDepartmentScopeLabel(currentDepartment ? `${currentDepartment.code} · ${currentDepartment.name}` : `Department #${profileData.departmentId}`);
          const scopedAnnouncements = roles.includes('SUPER_ADMIN')
            ? annData
            : annData.filter((announcement) => announcement.departmentId === null || announcement.departmentId === profileData.departmentId);
          setAnnouncements(scopedAnnouncements.slice(0, 3));
        })
        .catch(() => {
          // Keep the current dashboard data if the socket-triggered refresh fails.
        });
    });

    return unsubscribe;
  }, [roleKey]);

  async function handleProfileClick() {
    try {
      const data = await fetchProfile();
      setProfile(data);
      setShowProfile(true);
    } catch (error: any) {
      alert(error.message || 'Failed to load profile');
    }
  }

  const utilization = analytics?.resourceUtilizationRate ?? 0;
  const occupancyData = analytics?.classroomOccupancy ?? [];
  const deptUsage = analytics?.departmentUsage ?? [];
  const workloadData = useMemo(
    () =>
      Object.entries(analytics?.facultyWorkload ?? {}).map(([name, sessions]) => ({
        name,
        sessions
      })),
    [analytics]
  );
  const weeklyHeatmapData = useMemo(
    () =>
      Object.entries(analytics?.weeklyHeatmap ?? {}).map(([day, sessions]) => ({
        day,
        sessions
      })),
    [analytics]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <Activity className="text-cyan-600 mb-4" size={48} />
        <p className="text-sm font-medium text-slate-500">{t('common.loadingDashboard', 'Preparing your personalized dashboard...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-up">
      <section
        className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-slate-950 shadow-2xl shadow-slate-950/20"
        style={{ backgroundImage: "url('/login-bg.jpg')", backgroundPosition: 'center', backgroundSize: 'cover' }}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${localizedHero.accent}`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_25%)]" />
        <div className="relative flex flex-col gap-6 px-6 py-8 text-white md:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">{localizedHero.badgeLabel}</p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-5xl">{localizedHero.title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/78 md:text-base">{localizedHero.subtitle}</p>
            {isAdmin && departmentScopeLabel ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/90">
                Assigned Department: {departmentScopeLabel}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {roles.map((role) => (
              <span
                key={role}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-md"
              >
                {role === 'SUPER_ADMIN' ? 'PRINCIPAL' : role}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {(isPrincipal || isAdmin) && (
          <MetricCard title="Utilization" value={`${utilization.toFixed(1)}%`} helper="Resource usage" icon={<Activity size={20} />} />
        )}
        <MetricCard title="Classrooms" value={`${occupancyData.length}`} helper="Available halls" icon={<Building2 size={20} />} />
        {isFaculty && (
          <MetricCard title="My Sessions" value="12" helper="Weekly assigned" icon={<CalendarClock size={20} />} />
        )}
        {isStudent && (
          <MetricCard title="Attendance" value="88%" helper="Current semester" icon={<Activity size={20} />} />
        )}
        {!isStudent && (
          <MetricCard title="Faculty Load" value={`${workloadData.length}`} helper="Active staff" icon={<Users size={20} />} />
        )}
        <MetricCard title="AI Updates" value="14" helper="Optimizations today" icon={<Cpu size={20} />} />
        <MetricCard title="Total Sessions" value={`${weeklyHeatmapData.reduce((sum, item) => sum + item.sessions, 0)}`} helper="Active blocks" icon={<CalendarClock size={20} />} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {(isPrincipal || isAdmin) && (
            <SectionCard title="Resource Occupancy" subtitle="Real-time occupancy metrics">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={occupancyData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                    <XAxis dataKey="room" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      cursor={false}
                      contentStyle={chartTooltipStyle}
                      labelStyle={chartTooltipLabelStyle}
                      itemStyle={chartTooltipItemStyle}
                      formatter={(value) => [`${value}%`, 'Occupancy']}
                    />
                    <Bar dataKey="occupancyPercent" radius={[8, 8, 0, 0]}>
                      {occupancyData.map((entry) => (
                        <Cell key={entry.room} fill={entry.status === 'IN_USE' ? '#0f766e' : '#0ea5e9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          )}

          {(isFaculty || isStudent) && (
            <SectionCard title="My Weekly Schedule" subtitle="Assigned time slots and labs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {weeklyHeatmapData.slice(0, 4).map((item) => (
                  <div
                    key={item.day}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{item.day}</p>
                      <p className="mt-1 text-lg font-semibold">{item.sessions} Sessions</p>
                    </div>
                    <div className="rounded-full bg-cyan-100 p-2 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
                      <CalendarClock size={20} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {isPrincipal && (
            <SectionCard title="Branch Analytics" subtitle="Utilization across departments">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deptUsage} dataKey="utilizationPercent" nameKey="department" outerRadius={90} innerRadius={60} paddingAngle={2}>
                      {deptUsage.map((item, idx) => (
                        <Cell key={item.department} fill={['#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444'][idx % 4]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelStyle={chartTooltipLabelStyle}
                      itemStyle={chartTooltipItemStyle}
                      formatter={(value) => [`${value}%`, 'Utilization']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard title={t('dashboard.recentUpdates', 'Recent Updates')} subtitle={t('dashboard.departmentBroadcasts', 'Department broadcasts')}>
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className="group relative rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell size={14} className="text-cyan-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{new Date(ann.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-sm font-semibold truncate">{ann.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">{ann.content}</p>
                </div>
              ))}
              <button className="w-full py-2 text-xs font-bold text-cyan-600 hover:underline">{t('common.viewAllAnnouncements', 'View all announcements')}</button>
            </div>
          </SectionCard>

          <SectionCard title={t('dashboard.quickActions', 'Quick Actions')}>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 p-4 transition hover:bg-cyan-50 dark:bg-slate-800 dark:hover:bg-cyan-900/20">
                <ClipboardList size={20} className="text-cyan-600" />
                <span className="text-[10px] font-bold uppercase">{t('common.bookResource', 'Book Resource')}</span>
              </button>
              <button
                onClick={handleProfileClick}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 p-4 transition hover:bg-cyan-50 dark:bg-slate-800 dark:hover:bg-cyan-900/20"
              >
                <GraduationCap size={20} className="text-amber-600" />
                <span className="text-[10px] font-bold uppercase">{t('common.myProfile', 'My Profile')}</span>
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {showProfile && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-full border-4 border-cyan-500/20 bg-gradient-to-br from-cyan-500 to-blue-600 p-1 mb-4">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-slate-900">
                  <GraduationCap className="text-cyan-600" size={32} />
                </div>
              </div>
              <h3 className="text-xl font-bold">{profile.fullName}</h3>
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {profile.roles.map((r) => <Badge key={r} label={r} tone="neutral" />)}
              </div>

              <div className="mt-8 w-full space-y-3 text-left">
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t('dashboard.emailIdentifier', 'Email Identifier')}</p>
                  <p className="text-sm font-medium break-all">{profile.email}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{t('dashboard.status', 'Status')}</p>
                  <p className="text-sm font-medium text-emerald-600">Active • Institutional Account</p>
                </div>
              </div>

              <button
                onClick={() => setShowProfile(false)}
                className="mt-8 w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500"
              >
                {t('common.done', 'Done')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
