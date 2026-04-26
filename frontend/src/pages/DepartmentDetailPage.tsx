import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Download,
  FileImage,
  FileText,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  Wrench
} from 'lucide-react';
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
import { Badge } from '../components/Badge';
import { MetricCard } from '../components/MetricCard';
import { SectionCard } from '../components/SectionCard';
import {
  aiNaturalLanguageSearch,
  aiPredictDemand,
  aiRecommendResource,
  createAnnouncement,
  createUser,
  deleteDepartment,
  getDepartmentAnnouncements,
  getDepartmentDetail,
  getDepartmentFaculty,
  getDepartmentResources,
  getDepartmentStudents,
  getDepartmentTimetable,
  getCurrentUser,
  updateDepartment
  ,
  uploadAnnouncementAttachment
} from '../services/api';
import type {
  AiDemandPrediction,
  AppUser,
  DepartmentAnnouncement,
  DepartmentDetail,
  DepartmentFaculty,
  DepartmentStudent,
  ResourceItem,
  ResourceSuggestion,
  TimetableEntry
} from '../types';
import { canManageCampusData, getCurrentUserRoles } from '../utils/auth';

const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
const academicLevels = ['ALL', 'FE', 'SE', 'TE', 'BE'] as const;

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function inferStudentAcademicLevel(yearSemester: string) {
  return 'SE';
}

function toneForResource(status: ResourceItem['status']) {
  if (status === 'AVAILABLE') return 'success' as const;
  if (status === 'IN_USE') return 'warning' as const;
  return 'danger' as const;
}

function attachmentMeta(announcement: DepartmentAnnouncement) {
  if (!announcement.attachmentType) {
    return null;
  }

  if (announcement.attachmentType.includes('pdf')) {
    return { icon: FileText, label: 'PDF Attachment' };
  }

  if (!announcement.attachmentType.includes('image')) {
    return { icon: FileText, label: 'File Attachment' };
  }

  return { icon: FileImage, label: 'Image Attachment' };
}

function computeConflictIds(entries: TimetableEntry[]) {
  const ids = new Set<number>();

  for (let index = 0; index < entries.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < entries.length; compareIndex += 1) {
      const first = entries[index];
      const second = entries[compareIndex];

      if (first.dayOfWeek !== second.dayOfWeek) {
        continue;
      }

      const overlaps = toMinutes(first.startTime) < toMinutes(second.endTime)
        && toMinutes(second.startTime) < toMinutes(first.endTime);

      if (!overlaps) {
        continue;
      }

      if (first.facultyName === second.facultyName || first.resourceName === second.resourceName) {
        ids.add(first.id);
        ids.add(second.id);
      }
    }
  }

  return ids;
}

export function DepartmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const timetableRef = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [faculty, setFaculty] = useState<DepartmentFaculty[]>([]);
  const [students, setStudents] = useState<DepartmentStudent[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [announcements, setAnnouncements] = useState<DepartmentAnnouncement[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [prediction, setPrediction] = useState<AiDemandPrediction | null>(null);
  const [recommendation, setRecommendation] = useState<ResourceSuggestion | null>(null);
  const [nlQuery, setNlQuery] = useState('');
  const [nlResult, setNlResult] = useState<Awaited<ReturnType<typeof aiNaturalLanguageSearch>> | null>(null);
  const [facultySearchQuery, setFacultySearchQuery] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentYearFilter, setStudentYearFilter] = useState<(typeof academicLevels)[number]>('ALL');
  const [resourceFilter, setResourceFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED'>('ALL');
  const [activeAcademicLevel, setActiveAcademicLevel] = useState<(typeof academicLevels)[number]>('ALL');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [aiError, setAiError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<DepartmentStudent | null>(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '', campusId: 1 });
  const [memberForm, setMemberForm] = useState({ fullName: '', email: '', password: 'Welcome@123' });
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    audience: 'ALL',
    recipientEmail: '',
    file: null as File | null
  });

  const roles = getCurrentUserRoles();
  const canManage = canManageCampusData();
  const canBookResources = canManage || roles.includes('FACULTY');
  const departmentId = Number(id);

  useEffect(() => {
    if (!Number.isFinite(departmentId)) {
      setError('Invalid department id.');
      setLoading(false);
      return;
    }

    async function loadDepartment() {
      try {
        setLoading(true);
        setError('');
        const [detailData, facultyData, studentData, resourceData, timetableData, announcementData] = await Promise.all([
          getDepartmentDetail(departmentId),
          getDepartmentFaculty(departmentId),
          getDepartmentStudents(departmentId),
          getDepartmentResources(departmentId),
          getDepartmentTimetable(departmentId),
          getDepartmentAnnouncements(departmentId)
        ]);

        setDetail(detailData);
        setFaculty(facultyData);
        setStudents(studentData);
        setResources(resourceData);
        setTimetable(timetableData);
        setAnnouncements(announcementData);
        const profile = await getCurrentUser();
        setCurrentUser(profile);
        setEditForm({
          name: detailData.name,
          code: detailData.code,
          description: detailData.description,
          campusId: 1
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load department detail.');
      } finally {
        setLoading(false);
      }
    }

    loadDepartment();
  }, [departmentId]);

  useEffect(() => {
    if (!detail || resources.length === 0) {
      return;
    }

    const inventory = resources.length;
    const utilizationSeed = resources.map((resource) => {
      if (resource.status === 'IN_USE') return 84;
      if (resource.status === 'UNDER_MAINTENANCE' || resource.status === 'MAINTENANCE') return 28;
      return 52;
    });

    const primaryType = resources.some((resource) => resource.type === 'LAB') ? 'LAB' : 'CLASSROOM';
    const requiredTags = [...new Set(resources.flatMap((resource) => resource.tags))].slice(0, 3);
    const expectedUsers = Math.max(30, Math.round(resources.reduce((sum, resource) => sum + resource.capacity, 0) / inventory));

    Promise.allSettled([
      aiPredictDemand({
        resourceType: primaryType,
        recentUtilizationPercentages: utilizationSeed,
        currentInventory: inventory
      }),
      aiRecommendResource({
        resourceType: primaryType,
        expectedUsers,
        requiredTags
      })
    ]).then(([predictionResult, recommendationResult]) => {
      if (predictionResult.status === 'fulfilled') {
        setPrediction(predictionResult.value);
      }
      if (recommendationResult.status === 'fulfilled') {
        setRecommendation(recommendationResult.value);
      }
    });
  }, [detail, resources]);

  const resourceAnalytics = useMemo(() => {
    const available = resources.filter((resource) => resource.status === 'AVAILABLE').length;
    const occupied = resources.filter((resource) => resource.status === 'IN_USE').length;
    const maintenance = resources.length - available - occupied;

    return [
      { name: 'Available', value: available, fill: '#10b981' },
      { name: 'Occupied', value: occupied, fill: '#f59e0b' },
      { name: 'Maintenance', value: maintenance, fill: '#ef4444' }
    ];
  }, [resources]);

  const bookingAnalytics = useMemo(() => {
    const counts = resources.reduce<Record<string, number>>((accumulator, resource) => {
      const key = resource.type === 'LAB' ? 'Labs' : resource.type === 'CLASSROOM' ? 'Classrooms' : 'Equipment';
      if (resource.status === 'IN_USE') {
        accumulator[key] = (accumulator[key] ?? 0) + 1;
      }
      return accumulator;
    }, {});

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const facultyWorkload = useMemo(() => {
    const counts = timetable.reduce<Record<string, number>>((accumulator, entry) => {
      accumulator[entry.facultyName] = (accumulator[entry.facultyName] ?? 0) + 1;
      return accumulator;
    }, {});

    return Object.entries(counts).map(([name, sessions]) => ({ name, sessions }));
  }, [timetable]);

  const filteredResources = useMemo(() => {
    if (resourceFilter === 'ALL') return resources;
    if (resourceFilter === 'AVAILABLE') return resources.filter((resource) => resource.status === 'AVAILABLE');
    return resources.filter((resource) => resource.status !== 'AVAILABLE');
  }, [resourceFilter, resources]);

  const visibleFaculty = useMemo(() => {
    const normalizedQuery = facultySearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return faculty;

    return faculty.filter((member) =>
      [member.name, member.email, ...member.subjects]
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [faculty, facultySearchQuery]);

  const studentCountsByLevel = useMemo(
    () => ({
      FE: students.filter((student) => inferStudentAcademicLevel(student.yearSemester) === 'FE').length,
      SE: students.filter((student) => inferStudentAcademicLevel(student.yearSemester) === 'SE').length,
      TE: students.filter((student) => inferStudentAcademicLevel(student.yearSemester) === 'TE').length,
      BE: students.filter((student) => inferStudentAcademicLevel(student.yearSemester) === 'BE').length
    }),
    [students]
  );

  const visibleStudents = useMemo(() => {
    const normalizedQuery = studentSearchQuery.trim().toLowerCase();
    return students.filter((student) => {
      const matchesYear = studentYearFilter === 'ALL' || inferStudentAcademicLevel(student.yearSemester) === studentYearFilter;
      if (!matchesYear) return false;
      if (!normalizedQuery) return true;

      return [student.name, student.email, student.pnrNo ?? '', student.rollNo ?? '', student.yearSemester, ...student.courses]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [studentSearchQuery, studentYearFilter, students]);

  const visibleTimetable = useMemo(
    () => activeAcademicLevel === 'ALL'
      ? timetable
      : timetable.filter((entry) => entry.academicLevel === activeAcademicLevel),
    [activeAcademicLevel, timetable]
  );

  const timeSlots = useMemo(() => {
    const map = new Map<string, { start: string; end: string; label: string }>();
    visibleTimetable.forEach((entry) => {
      const start = formatTime(entry.startTime);
      const end = formatTime(entry.endTime);
      map.set(`${start}-${end}`, { start, end, label: `${start} - ${end}` });
    });
    return [...map.values()].sort((first, second) => toMinutes(first.start) - toMinutes(second.start));
  }, [visibleTimetable]);

  const timetableMap = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();
    dayOrder.forEach((day) => {
      timeSlots.forEach((slot) => {
        map.set(
          `${day}-${slot.label}`,
          visibleTimetable.filter((entry) => entry.dayOfWeek === day && formatTime(entry.startTime) === slot.start && formatTime(entry.endTime) === slot.end)
        );
      });
    });
    return map;
  }, [timeSlots, visibleTimetable]);

  const conflictIds = useMemo(() => computeConflictIds(visibleTimetable), [visibleTimetable]);

  async function handleDepartmentUpdate(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;

    try {
      setSubmitting(true);
      await updateDepartment(detail.id, {
        id: detail.id,
        name: editForm.name,
        code: editForm.code,
        description: editForm.description,
        campusId: editForm.campusId
      });

      const refreshed = await getDepartmentDetail(detail.id);
      setDetail(refreshed);
      setShowEditModal(false);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Department update failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteDepartment() {
    if (!detail || !window.confirm(`Delete department ${detail.code}?`)) return;

    try {
      await deleteDepartment(detail.id);
      navigate('/app/departments');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Department delete failed.');
    }
  }

  async function handleNaturalLanguageSearch(event: FormEvent) {
    event.preventDefault();
    if (!nlQuery.trim()) return;

    try {
      setAiError('');
      const result = await aiNaturalLanguageSearch(nlQuery);
      setNlResult(result);
    } catch (searchError) {
      setAiError(searchError instanceof Error ? searchError.message : 'AI search failed.');
    }
  }

  async function refreshDepartmentData() {
    const [facultyData, studentData, announcementData] = await Promise.all([
      getDepartmentFaculty(departmentId),
      getDepartmentStudents(departmentId),
      getDepartmentAnnouncements(departmentId)
    ]);

    setFaculty(facultyData);
    setStudents(studentData);
    setAnnouncements(announcementData);
  }

  async function handleCreateMember(role: 'FACULTY' | 'STUDENT') {
    if (!detail || !memberForm.fullName.trim() || !memberForm.email.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      await createUser({
        fullName: memberForm.fullName.trim(),
        email: memberForm.email.trim(),
        password: memberForm.password,
        role,
        departmentId: detail.id
      });

      setMemberForm({ fullName: '', email: '', password: 'Welcome@123' });
      setShowFacultyModal(false);
      setShowStudentModal(false);
      await refreshDepartmentData();
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : `Failed to add ${role.toLowerCase()}.`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAnnouncement() {
    if (!detail || !currentUser || !announcementForm.title.trim() || !announcementForm.content.trim()) {
      return;
    }
    if (announcementForm.audience === 'SPECIFIC_USER' && !announcementForm.recipientEmail.trim()) {
      setError('Recipient email is required for a specific user announcement.');
      return;
    }

    try {
      setSubmitting(true);
      let attachment: { url: string; fileName: string; type: string } | null = null;

      if (announcementForm.file) {
        attachment = await uploadAnnouncementAttachment(announcementForm.file);
      }

      await createAnnouncement({
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        audience: announcementForm.audience,
        createdByUserId: currentUser.id,
        departmentId: detail.id,
        recipientEmail: announcementForm.audience === 'SPECIFIC_USER' ? announcementForm.recipientEmail.trim().toLowerCase() : null,
        attachmentUrl: attachment?.url ?? null,
        attachmentType: attachment?.type ?? null,
        fileName: attachment?.fileName ?? null
      });

      setAnnouncementForm({ title: '', content: '', audience: 'ALL', recipientEmail: '', file: null });
      setShowAnnouncementModal(false);
      await refreshDepartmentData();
    } catch (announcementError) {
      setError(announcementError instanceof Error ? announcementError.message : 'Announcement creation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function openFacultyModal() {
    setMemberForm({ fullName: '', email: '', password: 'Welcome@123' });
    setShowStudentModal(false);
    setShowFacultyModal(true);
  }

  function openStudentModal() {
    setMemberForm({ fullName: '', email: '', password: 'Welcome@123' });
    setShowFacultyModal(false);
    setShowStudentModal(true);
  }

  function openAnnouncementModal() {
    setAnnouncementForm({ title: '', content: '', audience: 'ALL', recipientEmail: '', file: null });
    setShowAnnouncementModal(true);
  }

  function handleViewFacultyTimetable(facultyName: string) {
    const searchParams = new URLSearchParams();
    searchParams.set('faculty', facultyName);
    if (id) {
      searchParams.set('department', id);
    }
    navigate(`/app/timetable?${searchParams.toString()}`);
  }

  function scrollToTimetable() {
    timetableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white/70 px-8 py-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Loading Department</p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
        {error || 'Department not found.'}
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-up">
      <section className="overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950 shadow-2xl shadow-slate-950/25">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.28),transparent_28%),radial-gradient(circle_at_left,rgba(59,130,246,0.24),transparent_32%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#172554_100%)] px-6 py-8 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <button
                type="button"
                onClick={() => navigate('/app/departments')}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:bg-white/10"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/80">{detail.code}</p>
              <h1 className="mt-3 font-display text-4xl font-bold text-white">{detail.name}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75">{detail.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge label={`Campus: ${detail.campus}`} />
                <Badge label={`Code: ${detail.code}`} />
              </div>
            </div>

            {canManage ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  <Pencil size={16} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDepartment}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Faculty Count" value={String(detail.facultyCount)} helper="Academic staff" icon={<Users size={20} />} />
        <MetricCard title="Student Count" value={String(detail.studentCount)} helper="Enrolled learners" icon={<GraduationCap size={20} />} />
        <MetricCard title="Resource Count" value={String(detail.resourceCount)} helper="Labs, rooms, equipment" icon={<Wrench size={20} />} />
      </section>

      <SectionCard title="Department Analytics" subtitle="Live operational indicators for this department">
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="h-72 rounded-3xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
            <p className="mb-3 text-sm font-semibold">Resource Utilization</p>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={resourceAnalytics} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={4}>
                  {resourceAnalytics.map((item) => <Cell key={item.name} fill={item.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="h-72 rounded-3xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
            <p className="mb-3 text-sm font-semibold">Active Bookings</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookingAnalytics}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#38bdf8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-72 rounded-3xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
            <p className="mb-3 text-sm font-semibold">Faculty Workload</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={facultyWorkload}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="sessions" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Faculty" subtitle="Assigned faculty members and subject coverage">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {visibleFaculty.length} of {faculty.length} members
            </p>
            <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:flex-nowrap">
              <label className="relative min-w-[240px] flex-1 lg:w-[320px] lg:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="search"
                  value={facultySearchQuery}
                  onChange={(event) => setFacultySearchQuery(event.target.value)}
                  placeholder="Search by faculty, email, or subject"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              {canManage ? (
                <button
                  type="button"
                  onClick={openFacultyModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
                >
                  <Plus size={16} />
                  Add Faculty
                </button>
              ) : null}
            </div>
          </div>
          <div className="scrollbar-hidden max-h-[32rem] overflow-y-auto pr-1">
            {visibleFaculty.length === 0 ? (
              <article className="rounded-3xl border border-dashed border-slate-300 bg-white/40 p-6 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-lg font-semibold">{facultySearchQuery.trim() ? 'No faculty match your search' : 'No faculty added yet'}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {facultySearchQuery.trim()
                    ? 'Try a different faculty name, email, or subject to find the person you need.'
                    : 'Add department faculty to start showing subject ownership and timetable links.'}
                </p>
                {canManage ? (
                  <button
                    type="button"
                    onClick={openFacultyModal}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                  >
                    <Plus size={16} />
                    Add Faculty
                  </button>
                ) : null}
              </article>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 md:block">
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(0,2.2fr)_auto] gap-4 border-b border-slate-200/80 bg-slate-100/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
                    <p>Faculty</p>
                    <p>Email</p>
                    <p>Subjects</p>
                    <p>Action</p>
                  </div>
                  <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {visibleFaculty.map((member) => (
                      <div
                        key={member.id}
                        className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(0,2.2fr)_auto] items-center gap-4 px-5 py-3 text-sm text-slate-600 transition hover:bg-slate-50/70 dark:text-slate-300 dark:hover:bg-slate-800/30"
                      >
                        <p className="truncate font-semibold text-slate-900 dark:text-white">{member.name}</p>
                        <p className="truncate text-slate-500 dark:text-slate-400">{member.email}</p>
                        <div className="flex flex-wrap gap-2">
                          {member.subjects.length === 0
                            ? <span className="text-xs text-slate-400">No subjects</span>
                            : member.subjects.map((subject) => <Badge key={subject} label={subject} />)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleViewFacultyTimetable(member.name)}
                          className="rounded-xl border border-cyan-300 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                        >
                          View Timetable
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 md:hidden">
                  {visibleFaculty.map((member) => (
                    <article
                      key={member.id}
                      className="rounded-2xl border border-slate-200 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold">{member.name}</p>
                          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{member.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleViewFacultyTimetable(member.name)}
                          className="rounded-xl border border-cyan-300 px-3 py-2 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                        >
                          View Timetable
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {member.subjects.length === 0
                          ? <span className="text-xs text-slate-400">No subjects assigned</span>
                          : member.subjects.map((subject) => <Badge key={subject} label={subject} />)}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Students" subtitle="Current student cohort by year and course selection">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {visibleStudents.length} of {students.length} students
            </p>
            <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:flex-nowrap">
              <label className="relative min-w-[240px] flex-1 lg:w-[320px] lg:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="search"
                  value={studentSearchQuery}
                  onChange={(event) => setStudentSearchQuery(event.target.value)}
                  placeholder="Search by student, email, year, or course"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              {canManage ? (
                <button
                  type="button"
                  onClick={openStudentModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
                >
                  <Plus size={16} />
                  Add Student
                </button>
              ) : null}
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {academicLevels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setStudentYearFilter(level)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${studentYearFilter === level
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
              >
                {level === 'ALL' ? `All ${students.length}` : `${level} ${studentCountsByLevel[level]}`}
              </button>
            ))}
          </div>
          <div className="scrollbar-hidden max-h-[32rem] overflow-y-auto pr-1">
            {visibleStudents.length === 0 ? (
              <article className="rounded-3xl border border-dashed border-slate-300 bg-white/40 p-6 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-lg font-semibold">
                  {studentSearchQuery.trim()
                    ? 'No students match your search'
                    : studentYearFilter === 'ALL'
                      ? 'No students added yet'
                      : `No ${studentYearFilter} students found`}
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {studentSearchQuery.trim()
                    ? 'Try a different student name, email, year, or course keyword to find the record you need.'
                    : 'Create student accounts for this department to populate the cohort and course overview.'}
                </p>
                {canManage ? (
                  <button
                    type="button"
                    onClick={openStudentModal}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                  >
                    <Plus size={16} />
                    Add Student
                  </button>
                ) : null}
              </article>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60 md:block">
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-4 border-b border-slate-200/80 bg-slate-100/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
                    <p>Student</p>
                    <p>Gmail</p>
                    <p>PNR No</p>
                    <p>Roll No</p>
                  </div>
                  <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {visibleStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,0.9fr)] items-center gap-4 px-5 py-3 text-left text-sm text-slate-600 transition hover:bg-slate-50/70 dark:text-slate-300 dark:hover:bg-slate-800/30"
                      >
                        <p className="truncate font-semibold text-slate-900 dark:text-white">{student.name}</p>
                        <p className="truncate text-slate-500 dark:text-slate-400">{student.email}</p>
                        <p className="truncate font-medium text-slate-700 dark:text-slate-200">{student.pnrNo || '-'}</p>
                        <p className="truncate font-medium text-slate-700 dark:text-slate-200">{student.rollNo || '-'}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 md:hidden">
                  {visibleStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedStudent(student)}
                      className="w-full rounded-2xl border border-slate-200 bg-white/70 p-4 text-left backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold">{student.name}</p>
                          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{student.email}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-2xl bg-slate-100/70 px-3 py-2 dark:bg-slate-800/60">
                          <p className="uppercase tracking-[0.16em] text-slate-400">PNR</p>
                          <p className="mt-1 truncate font-semibold text-slate-700 dark:text-slate-200">{student.pnrNo || '-'}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-100/70 px-3 py-2 dark:bg-slate-800/60">
                          <p className="uppercase tracking-[0.16em] text-slate-400">Roll</p>
                          <p className="mt-1 truncate font-semibold text-slate-700 dark:text-slate-200">{student.rollNo || '-'}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Resources" subtitle="Department labs, classrooms, and resource availability">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(['ALL', 'AVAILABLE', 'OCCUPIED'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setResourceFilter(filter)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${resourceFilter === filter
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredResources.map((resource) => (
            <article key={resource.id} className="rounded-3xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{resource.name}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{resource.building}</p>
                </div>
                <Badge label={resource.status} tone={toneForResource(resource.status)} />
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p>Type: <strong>{resource.type}</strong></p>
                <p>Capacity: <strong>{resource.capacity}</strong></p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {resource.tags.map((tag) => <Badge key={tag} label={tag} />)}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {canBookResources ? (
                  <button
                    type="button"
                    onClick={() => window.alert(`Booking flow for ${resource.name} can be connected to the resource request module.`)}
                    className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-cyan-700"
                  >
                    Book Resource
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={scrollToTimetable}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  View Schedule
                </button>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      {selectedStudent ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/55">
          <button
            type="button"
            aria-label="Close student profile"
            onClick={() => setSelectedStudent(null)}
            className="flex-1 cursor-default"
          />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">Student Profile</p>
                <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">{selectedStudent.name}</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{selectedStudent.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Name</p>
                <p className="mt-2 break-words text-base font-semibold text-slate-900 dark:text-white">{selectedStudent.name}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Gmail</p>
                <p className="mt-2 break-all text-base font-semibold text-slate-900 dark:text-white">{selectedStudent.email}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">PNR Number</p>
                <p className="mt-2 break-all text-base font-semibold text-slate-900 dark:text-white">{selectedStudent.pnrNo || 'Not available yet'}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Roll Number</p>
                <p className="mt-2 break-all text-base font-semibold text-slate-900 dark:text-white">{selectedStudent.rollNo || 'Not available yet'}</p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Academic Details</p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{selectedStudent.yearSemester}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedStudent.courses.length === 0
                  ? <span className="text-sm text-slate-500 dark:text-slate-400">No courses mapped yet.</span>
                  : selectedStudent.courses.map((course) => <Badge key={course} label={course} tone="warning" />)}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <SectionCard title="Department Timetable" subtitle="Weekly room usage, faculty allocation, and conflict visibility">
        <div className="mb-4 flex flex-wrap gap-2">
          {academicLevels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setActiveAcademicLevel(level)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${activeAcademicLevel === level
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
            >
              {level === 'ALL' ? 'All Years' : level}
            </button>
          ))}
        </div>
        <section ref={timetableRef} className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/45">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90">
                  <th className="sticky left-0 z-10 min-w-[110px] border-b border-r border-slate-200 bg-slate-100/95 px-5 py-4 text-left text-xs font-bold uppercase tracking-[0.22em] dark:border-slate-700 dark:bg-slate-800/95">
                    Day
                  </th>
                  {timeSlots.map((slot) => (
                    <th key={slot.label} className="border-b border-slate-200 px-4 py-4 text-center text-sm font-semibold dark:border-slate-700">
                      {slot.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayOrder.map((day) => (
                  <tr key={day}>
                    <th className="sticky left-0 z-10 border-r border-b border-slate-200 bg-white px-5 py-5 text-left text-lg font-bold dark:border-slate-800 dark:bg-slate-900">
                      {day.slice(0, 3)}
                    </th>
                    {timeSlots.map((slot) => {
                      const slotEntries = timetableMap.get(`${day}-${slot.label}`) ?? [];
                      return (
                        <td key={`${day}-${slot.label}`} className="border-b border-slate-200 bg-slate-50/40 p-3 align-top dark:border-slate-800 dark:bg-slate-950/50">
                          {slotEntries.length === 0 ? (
                            <div className="flex min-h-[110px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 dark:border-slate-800 dark:text-slate-600">
                              Free
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {slotEntries.map((entry) => (
                                <article
                                  key={entry.id}
                                  className={`rounded-2xl border p-4 ${conflictIds.has(entry.id)
                                      ? 'border-red-300 bg-red-50/90 dark:border-red-900/40 dark:bg-red-950/20'
                                      : 'border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900'
                                    }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold">{entry.courseCode}</p>
                                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{entry.sectionCode}</p>
                                    </div>
                                    <Badge label={entry.resourceName} />
                                  </div>
                                  <p className="mt-3 text-sm">{entry.facultyName}</p>
                                </article>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </SectionCard>

      <SectionCard title="Announcements" subtitle="Department notices, attachments, and downloadable files">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-500 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            PDF and image attachments are supported for department notices.
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={openAnnouncementModal}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
            >
              <Plus size={16} />
              Add Announcement
            </button>
          ) : null}
        </div>
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <article className="rounded-3xl border border-dashed border-slate-300 bg-white/40 p-6 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-lg font-semibold">No announcements published yet</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Publish the first department update and attach any file if needed.
              </p>
              {canManage ? (
                <button
                  type="button"
                  onClick={openAnnouncementModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                >
                  <Upload size={16} />
                  Add Announcement
                </button>
              ) : null}
            </article>
          ) : announcements.map((announcement) => {
            const attachment = attachmentMeta(announcement);
            return (
              <article key={announcement.id} className="rounded-3xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{announcement.title}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{new Date(announcement.publishedAt).toLocaleString()}</p>
                  </div>
                  <Badge label={announcement.audience} />
                  {announcement.recipientEmail ? <Badge label="Private" tone="warning" /> : null}
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{announcement.content}</p>
                {announcement.recipientEmail ? (
                  <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-300">
                    Recipient: {announcement.recipientEmail} {announcement.emailDeliveryStatus ? ` - Email ${announcement.emailDeliveryStatus}` : ''}
                  </p>
                ) : null}
                {attachment ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <attachment.icon size={18} className="text-cyan-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{announcement.fileName ?? attachment.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{attachment.label}</p>
                    </div>
                    {announcement.attachmentUrl ? (
                      <a
                        href={announcement.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                      >
                        <Download size={14} />
                        Download
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="AI Insights" subtitle="Department planning signals and natural language assistance">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1.2fr]">
          <article className="rounded-3xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-cyan-600" size={20} />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Demand Prediction</p>
            </div>
            {prediction ? (
              <div className="mt-5 space-y-3">
                <p className="text-3xl font-bold">{prediction.nextWeekPredictedUtilization}%</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{prediction.insight}</p>
                <Badge label={`Add ${prediction.recommendedAdditionalUnits} units`} tone="warning" />
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">AI demand signal unavailable.</p>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <Bot className="text-violet-600" size={20} />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Recommendations</p>
            </div>
            {recommendation ? (
              <div className="mt-5 space-y-3">
                <p className="text-lg font-semibold">{recommendation.recommendationType}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{recommendation.explanation}</p>
                <Badge label={`Score ${recommendation.score}`} tone="success" />
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">No recommendation generated.</p>
            )}
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white/70 p-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <Search className="text-amber-600" size={20} />
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Natural Language Search</p>
            </div>
            <form onSubmit={handleNaturalLanguageSearch} className="mt-5 flex gap-3">
              <input
                value={nlQuery}
                onChange={(event) => setNlQuery(event.target.value)}
                placeholder="Find an available lab with projector for 40 students"
                className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                Run
              </button>
            </form>
            {aiError ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{aiError}</p> : null}
            {nlResult ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">{nlResult.normalizedQuery}</p>
                <div className="flex flex-wrap gap-2">
                  {nlResult.matches.map((match) => <Badge key={match.id} label={`${match.roomCode} (${match.capacity})`} />)}
                </div>
              </div>
            ) : null}
          </article>
        </div>
      </SectionCard>

      {showEditModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold">Edit Department</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Update department metadata without leaving the detail page.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleDepartmentUpdate} className="mt-6 grid gap-4">
              <label className="space-y-2 text-sm">
                <span>Name</span>
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>Code</span>
                  <input
                    value={editForm.code}
                    onChange={(event) => setEditForm((current) => ({ ...current, code: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>Campus ID</span>
                  <input
                    type="number"
                    value={editForm.campusId}
                    onChange={(event) => setEditForm((current) => ({ ...current, campusId: Number(event.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>
              <label className="space-y-2 text-sm">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={editForm.description}
                  onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-70"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showFacultyModal || showStudentModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold">{showFacultyModal ? 'Add Faculty' : 'Add Student'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Create a new user directly in this department.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFacultyModal(false);
                  setShowStudentModal(false);
                }}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="space-y-2 text-sm">
                <span>Full name</span>
                <input
                  value={memberForm.fullName}
                  onChange={(event) => setMemberForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>Email</span>
                <input
                  type="email"
                  value={memberForm.email}
                  onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>Initial password</span>
                <input
                  value={memberForm.password}
                  onChange={(event) => setMemberForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleCreateMember(showFacultyModal ? 'FACULTY' : 'STUDENT')}
                  disabled={submitting}
                  className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-70"
                >
                  {submitting ? 'Saving...' : showFacultyModal ? 'Create Faculty' : 'Create Student'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFacultyModal(false);
                    setShowStudentModal(false);
                  }}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAnnouncementModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold">Add Announcement</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Create a department notice with optional attachment.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(false)}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="space-y-2 text-sm">
                <span>Title</span>
                <input
                  value={announcementForm.title}
                  onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={announcementForm.content}
                  onChange={(event) => setAnnouncementForm((current) => ({ ...current, content: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>Audience</span>
                <select
                  value={announcementForm.audience}
                  onChange={(event) => setAnnouncementForm((current) => ({ ...current, audience: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="ALL">All</option>
                  <option value="FACULTY">Faculty</option>
                  <option value="STUDENT">Student</option>
                  <option value="SPECIFIC_USER">Specific User</option>
                </select>
              </label>
              {announcementForm.audience === 'SPECIFIC_USER' ? (
                <label className="space-y-2 text-sm">
                  <span>Recipient email</span>
                  <input
                    value={announcementForm.recipientEmail}
                    onChange={(event) => setAnnouncementForm((current) => ({ ...current, recipientEmail: event.target.value }))}
                    list="department-announcement-recipients"
                    placeholder="Select or type a user email"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <datalist id="department-announcement-recipients">
                    {[...faculty, ...students].map((member) => (
                      <option key={member.id} value={member.email}>
                        {member.name}
                      </option>
                    ))}
                  </datalist>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This announcement will be sent to that user by email when Gmail SMTP is configured.
                  </p>
                </label>
              ) : null}
              <label className="space-y-2 text-sm">
                <span>Attach file</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-cyan-700 dark:hover:text-cyan-300">
                  <Upload size={18} />
                  <span>{announcementForm.file ? announcementForm.file.name : 'Upload any file'}</span>
                  <input
                    type="file"
                    accept="*/*"
                    className="hidden"
                    onChange={(event) => setAnnouncementForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                  />
                </label>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCreateAnnouncement}
                  disabled={submitting}
                  className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-70"
                >
                  {submitting ? 'Publishing...' : 'Publish Announcement'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
