import { useState, useEffect, useMemo, useRef } from 'react';
import { Badge } from '../components/Badge';
import { SectionCard } from '../components/SectionCard';
import { Upload, FileSpreadsheet, Loader2, Search, Trash2, ShieldCheck, Mail, Eye, EyeOff, Users, GraduationCap, UserCog, Building2, AlertTriangle, ChevronDown, Download } from 'lucide-react';
import { listUsers, createUser, bulkUploadUsers, bulkDeleteUsers, getDepartments, deleteUser, assignDepartmentAdmin, Department, getCurrentUser, clearOperationalData, downloadBulkUserTemplate } from '../services/api';
import { AppUser } from '../types';
import { getCurrentUserRoles } from '../utils/auth';

type ClearMode = 'ANNOUNCEMENTS' | 'TIMETABLE' | 'RESOURCES' | 'ALL';

export function UserManagementPage() {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [templateDownloading, setTemplateDownloading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

    // Form State
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('Welcome@123');
    const [prnNo, setPrnNo] = useState('');
    const [rollNo, setRollNo] = useState('');
    const [yearSemester, setYearSemester] = useState<'FE' | 'SE' | 'TE' | 'BE'>('FE');
    const [hodName, setHodName] = useState('');
    const [hodEmail, setHodEmail] = useState('');
    const [hodPassword, setHodPassword] = useState('Welcome@123');
    const [hodDeptId, setHodDeptId] = useState<string>('');
    const [hodMode, setHodMode] = useState<'existing' | 'new'>('existing');
    const [selectedExistingHodId, setSelectedExistingHodId] = useState<string>('');

    const roles = getCurrentUserRoles();
    const isPrincipal = roles.includes('SUPER_ADMIN');
    const isPrincipalMode = isPrincipal;
    const isAdmin = roles.includes('COLLEGE_ADMIN');
    const isFaculty = roles.includes('FACULTY');

    const [role, setRole] = useState<'FACULTY' | 'COLLEGE_ADMIN' | 'STUDENT'>(isFaculty ? 'STUDENT' : 'FACULTY');
    const [deptId, setDeptId] = useState<string>('');
    const [showPassword, setShowPassword] = useState(false);
    const [currentDepartmentId, setCurrentDepartmentId] = useState<number | null>(null);
    const [isClearDataOpen, setIsClearDataOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bulkDeleteInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [uData, dData, currentUser] = await Promise.all([listUsers(), getDepartments(), getCurrentUser()]);
            const scopedDepartmentId = currentUser.departmentId;
            const scopedDepartments = isPrincipalMode
                ? dData
                : dData.filter((department) => department.id === scopedDepartmentId);
            setUsers(uData);
            setDepartments(scopedDepartments);
            setCurrentUser(currentUser);
            setCurrentDepartmentId(scopedDepartmentId);
            if (scopedDepartments.length > 0) setDeptId(scopedDepartments[0].id.toString());
            if (scopedDepartments.length > 0) setHodDeptId(scopedDepartments[0].id.toString());
        } catch (error) {
            console.error('Failed to load user management data', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateUser() {
        if (!fullName || !email || !deptId) {
            alert('Fill in name, email, and department before creating the account.');
            return;
        }
        if (role === 'STUDENT' && !yearSemester) {
            alert('Select FE, SE, TE, or BE for student accounts.');
            return;
        }
        try {
            await createUser({
                fullName,
                email,
                password,
                role,
                departmentId: parseInt(deptId),
                pnrNo: role === 'STUDENT' ? prnNo : undefined,
                rollNo: role === 'STUDENT' ? rollNo : undefined,
                yearSemester: role === 'STUDENT' ? yearSemester : undefined
            });
            setFullName('');
            setEmail('');
            setPrnNo('');
            setRollNo('');
            setYearSemester('FE');
            loadData();
        } catch (error: any) {
            alert(error.message || 'Failed to create user');
        }
    }

    async function handleDeleteUser(user: AppUser) {
        if (!window.confirm(`Are you sure you want to remove ${user.fullName}?`)) return;
        try {
            await deleteUser(user.email);
            setUsers(prev => prev.filter(u => u.id !== user.id));
            await loadData();
        } catch (error: any) {
            alert(error.message || 'Deletion failed');
        }
    }

    async function handleAssignDepartmentAdmin() {
        try {
            if (!hodDeptId) {
                alert('Select a department before assigning HOD.');
                return;
            }

            if (hodMode === 'existing') {
                if (!selectedExistingHodId) {
                    alert('Select an existing user to assign as HOD.');
                    return;
                }
                await assignDepartmentAdmin(parseInt(selectedExistingHodId), parseInt(hodDeptId));
            } else {
                if (!hodName || !hodEmail) {
                    alert('Fill in HOD name, email, and department before assigning admin access.');
                    return;
                }
                await createUser({
                    fullName: hodName,
                    email: hodEmail,
                    password: hodPassword,
                    role: 'COLLEGE_ADMIN',
                    departmentId: parseInt(hodDeptId)
                });
                setHodName('');
                setHodEmail('');
                setHodPassword('Welcome@123');
            }

            setSelectedExistingHodId('');
            await loadData();
        } catch (error: any) {
            alert(error.message || 'Failed to assign department admin');
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const result = await bulkUploadUsers(file);
            alert(`Success: ${result.successCount} users added. ${result.errors.length} errors.`);
            if (result.errors.length > 0) console.table(result.errors);
            loadData();
        } catch (error: any) {
            alert(error.message || 'Bulk upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function handleBulkDeleteUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm('This will delete every user listed in the uploaded file. Do you want to continue?')) {
            if (bulkDeleteInputRef.current) bulkDeleteInputRef.current.value = '';
            return;
        }

        try {
            setBulkDeleting(true);
            const result = await bulkDeleteUsers(file);
            alert(`Success: ${result.successCount} users deleted. ${result.errors.length} errors.`);
            if (result.errors.length > 0) console.table(result.errors);
            await loadData();
        } catch (error: any) {
            alert(error.message || 'Bulk delete failed');
        } finally {
            setBulkDeleting(false);
            if (bulkDeleteInputRef.current) bulkDeleteInputRef.current.value = '';
        }
    }

    async function handleDownloadTemplate() {
        try {
            setTemplateDownloading(true);
            await downloadBulkUserTemplate();
        } catch (error: any) {
            alert(error.message || 'Template download failed');
        } finally {
            setTemplateDownloading(false);
        }
    }

    async function handleClearOperationalData(mode: ClearMode, label: string) {
        const scopeLabel = isPrincipalMode ? 'the full system' : 'your department only';
        const warningByMode: Record<ClearMode, string> = {
            ANNOUNCEMENTS: `This will permanently delete announcements for ${scopeLabel}. Do you want to continue?`,
            TIMETABLE: `This will permanently delete timetable entries for ${scopeLabel}. Do you want to continue?`,
            RESOURCES: `This will permanently delete resources, laboratories, equipment-linked maintenance, and related bookings for ${scopeLabel}. Do you want to continue?`,
            ALL: `This will permanently delete announcements, timetable entries, resources, laboratories, maintenance, and related bookings for ${scopeLabel}. Do you want to continue?`
        };

        if (!window.confirm(warningByMode[mode])) {
            return;
        }

        try {
            const result = await clearOperationalData(mode);
            const summary = Object.entries(result.deletedCounts)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
            alert(`${label} completed successfully.\n\nScope: ${result.scope}\nMode: ${result.mode}\n${summary}`);
        } catch (error: any) {
            alert(error.message || 'Failed to clear operational data');
        }
    }

    const roleLabel = (roles: string[]) => {
        if (roles.includes('SUPER_ADMIN')) return 'Principal';
        if (roles.includes('COLLEGE_ADMIN')) return 'Admin/HOD';
        return roles[0].charAt(0) + roles[0].slice(1).toLowerCase();
    };

    const getDeleteAvailability = (user: AppUser) => {
        if (currentUser?.email?.toLowerCase() === user.email.toLowerCase()) {
            return { allowed: false, reason: 'You cannot delete your own account from here.' };
        }

        if (isPrincipalMode) {
            return { allowed: true, reason: 'Delete this user account.' };
        }

        if (isAdmin) {
            return { allowed: true, reason: 'Delete this user account from your department.' };
        }

        if (isFaculty) {
            if (!user.roles.includes('STUDENT' as any)) {
                return { allowed: false, reason: 'Faculty can delete student accounts only.' };
            }
            return { allowed: true, reason: 'Delete this student account.' };
        }

        return { allowed: false, reason: 'You do not have permission to delete this user.' };
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        // Faculty only sees students in their list
        if (isFaculty) return u.roles.includes('STUDENT' as any);
        // Admin sees Fac/Student
        if (isAdmin) return u.roles.includes('FACULTY' as any) || u.roles.includes('STUDENT' as any);

        return true; // Principal sees all
    });

    const assignedAdminDepartmentIds = useMemo(
        () => new Set(
            users
                .filter(user => user.roles.includes('COLLEGE_ADMIN' as any))
                .map(user => user.departmentId)
        ),
        [users]
    );

    const availableAdminDepartments = useMemo(
        () => departments.filter(department => !assignedAdminDepartmentIds.has(department.id)),
        [departments, assignedAdminDepartmentIds]
    );

    const hodCandidateUsers = useMemo(() => {
        return users.filter((user) => {
            if (user.roles.includes('SUPER_ADMIN' as any)) return false;
            if (user.roles.includes('COLLEGE_ADMIN' as any)) return false;
            if (!hodDeptId) return true;
            return user.departmentId === parseInt(hodDeptId);
        });
    }, [users, hodDeptId]);

    useEffect(() => {
        if (role !== 'COLLEGE_ADMIN') {
            return;
        }

        const selectedDepartmentTaken = deptId !== '' && assignedAdminDepartmentIds.has(parseInt(deptId));
        if (selectedDepartmentTaken) {
            setDeptId(availableAdminDepartments[0]?.id?.toString() ?? '');
        }
    }, [role, deptId, availableAdminDepartments, assignedAdminDepartmentIds]);

    useEffect(() => {
        const selectedDepartmentTaken = hodDeptId !== '' && assignedAdminDepartmentIds.has(parseInt(hodDeptId));
        if (selectedDepartmentTaken) {
            setHodDeptId(availableAdminDepartments[0]?.id?.toString() ?? '');
        }
    }, [hodDeptId, availableAdminDepartments, assignedAdminDepartmentIds]);

    useEffect(() => {
        if (hodMode !== 'existing') {
            return;
        }
        if (hodCandidateUsers.length === 0) {
            setSelectedExistingHodId('');
            return;
        }
        const stillValid = selectedExistingHodId !== '' && hodCandidateUsers.some((user) => user.id === parseInt(selectedExistingHodId));
        if (!stillValid) {
            setSelectedExistingHodId(hodCandidateUsers[0].id.toString());
        }
    }, [hodMode, hodCandidateUsers, selectedExistingHodId]);

    const principalCount = users.filter(user => user.roles.includes('SUPER_ADMIN' as any)).length;
    const adminCount = users.filter(user => user.roles.includes('COLLEGE_ADMIN' as any)).length;
    const facultyCount = users.filter(user => user.roles.includes('FACULTY' as any)).length;
    const studentCount = users.filter(user => user.roles.includes('STUDENT' as any)).length;

    const stats = [
        {
            label: 'Principal',
            value: principalCount,
            helper: 'Executive access',
            icon: ShieldCheck,
            tone: 'from-rose-500/25 via-rose-400/10 to-transparent'
        },
        {
            label: 'Department HODs',
            value: adminCount,
            helper: 'Admin accounts',
            icon: UserCog,
            tone: 'from-amber-500/25 via-amber-400/10 to-transparent'
        },
        {
            label: 'Faculty',
            value: facultyCount,
            helper: 'Teaching staff',
            icon: Users,
            tone: 'from-emerald-500/25 via-emerald-400/10 to-transparent'
        },
        {
            label: 'Students',
            value: studentCount,
            helper: 'Learner accounts',
            icon: GraduationCap,
            tone: 'from-cyan-500/25 via-cyan-400/10 to-transparent'
        }
    ];

    const clearActions: Array<{ mode: ClearMode; label: string; helper: string; tone: string }> = [
        {
            mode: 'ANNOUNCEMENTS',
            label: 'Clear Announcements Only',
            helper: 'Erase notices without touching timetable or resources.',
            tone: 'border-rose-200/80 bg-white/70 hover:border-rose-400 hover:bg-rose-50/60 dark:border-rose-900/40 dark:bg-slate-950/40 dark:hover:border-rose-700 dark:hover:bg-rose-950/20'
        },
        {
            mode: 'TIMETABLE',
            label: 'Clear Timetable Only',
            helper: 'Remove scheduled classes while keeping resources and announcements.',
            tone: 'border-amber-200/80 bg-white/70 hover:border-amber-400 hover:bg-amber-50/60 dark:border-amber-900/40 dark:bg-slate-950/40 dark:hover:border-amber-700 dark:hover:bg-amber-950/20'
        },
        {
            mode: 'RESOURCES',
            label: 'Clear Resources Only',
            helper: 'Delete classrooms, labs, equipment, maintenance, and linked bookings.',
            tone: 'border-fuchsia-200/80 bg-white/70 hover:border-fuchsia-400 hover:bg-fuchsia-50/60 dark:border-fuchsia-900/40 dark:bg-slate-950/40 dark:hover:border-fuchsia-700 dark:hover:bg-fuchsia-950/20'
        },
        {
            mode: 'ALL',
            label: isPrincipalMode ? 'Clear All Operational Data' : 'Clear All Department Data',
            helper: 'Wipe announcements, timetable, resources, labs, maintenance, and bookings together.',
            tone: 'border-rose-300 bg-rose-50/90 hover:border-rose-500 hover:bg-rose-100/80 dark:border-rose-900/60 dark:bg-rose-950/20 dark:hover:border-rose-700 dark:hover:bg-rose-950/35'
        }
    ];

    return (
        <div className="space-y-6 fade-up">
            <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-slate-950/20">
                <div className="bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_left,rgba(59,130,246,0.18),transparent_35%),linear-gradient(135deg,#020617_0%,#0f172a_52%,#172554_100%)] px-6 py-8 md:px-8">
                    <div className="flex flex-wrap items-start justify-between gap-6">
                        <div className="max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/80">Identity Workspace</p>
                            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">Identity & Access</h1>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                                Organize principals, HODs, faculty, and students from one place with cleaner onboarding, role mapping, and department ownership.
                            </p>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Departments</p>
                            <p className="mt-2 flex items-center gap-2 text-3xl font-semibold text-white">
                                <Building2 size={24} className="text-cyan-300" />
                                {departments.length}
                            </p>
                            <p className="mt-1 text-xs text-slate-300/80">Academic branches configured</p>
                        </div>
                    </div>
                </div>
            </header>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {stats.map((item) => {
                    const Icon = item.icon;
                    return (
                        <article
                            key={item.label}
                            className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/55"
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${item.tone}`} />
                            <div className="relative flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{item.label}</p>
                                    <p className="mt-3 text-3xl font-bold">{item.value}</p>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.helper}</p>
                                </div>
                                <div className="rounded-2xl border border-white/20 bg-white/50 p-3 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
                                    <Icon size={20} />
                                </div>
                            </div>
                        </article>
                    );
                })}
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,0.95fr)]">
                {/* User List */}
                <div className="space-y-6">
                    <SectionCard title="System Users" subtitle="Current active users in your division">
                        <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Find users by name or email..."
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-3 pl-12 pr-4 text-sm outline-none transition focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900/60"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[320px]">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Visible</p>
                                    <p className="mt-2 text-lg font-semibold">{filteredUsers.length}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Admins</p>
                                    <p className="mt-2 text-lg font-semibold">{adminCount}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Faculty</p>
                                    <p className="mt-2 text-lg font-semibold">{facultyCount}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Students</p>
                                    <p className="mt-2 text-lg font-semibold">{studentCount}</p>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="animate-spin text-cyan-600" size={32} />
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/60 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/40">
                                <div className="border-b border-slate-200/70 bg-slate-50/80 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                                    Use the Delete button in the last column to remove a user account.
                                </div>
                                <div className="scrollbar-hidden max-h-[34rem] overflow-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur dark:bg-slate-800/95">
                                        <tr>
                                            <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400">Real Name</th>
                                            <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400">Email</th>
                                            <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400">Mapped Role</th>
                                            <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400">Department</th>
                                            <th className="px-5 py-4 font-semibold text-slate-600 dark:text-slate-400 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className="transition hover:bg-slate-50/60 dark:hover:bg-slate-800/25">
                                                <td className="px-5 py-4">
                                                    <div>
                                                        <p className="font-semibold">{user.fullName}</p>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                                                    <div className="flex items-center gap-2">
                                                        <Mail size={14} />
                                                        {user.email}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <Badge
                                                        label={roleLabel(user.roles as any)}
                                                        tone={user.roles.includes('SUPER_ADMIN' as any) ? 'danger' : user.roles.includes('COLLEGE_ADMIN' as any) ? 'warning' : 'success'}
                                                    />
                                                </td>
                                                <td className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                    {departments.find(d => d.id === user.departmentId)?.code || '-'}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    {(() => {
                                                        const deleteAvailability = getDeleteAvailability(user);
                                                        return (
                                                    <button
                                                        onClick={() => handleDeleteUser(user)}
                                                        disabled={!deleteAvailability.allowed}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-400 hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:border-rose-700 dark:hover:bg-rose-950/35 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                                                        title={deleteAvailability.reason}
                                                    >
                                                        <Trash2 size={16} />
                                                        Delete
                                                    </button>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        )}
                    </SectionCard>
                </div>

                {/* Action Panel */}
                <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                    {isPrincipalMode ? (
                        <SectionCard title="Assign Department HOD" subtitle="Superadmin can set one admin for each department">
                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
                                    The assigned HOD gets `COLLEGE_ADMIN` access automatically and will only see their own department admin dashboard.
                                </div>
                                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
                                    <button
                                        type="button"
                                        onClick={() => setHodMode('existing')}
                                        className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${hodMode === 'existing' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        Existing User
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHodMode('new')}
                                        className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${hodMode === 'new' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                                    >
                                        New User
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Department</label>
                                    <select
                                        value={hodDeptId}
                                        onChange={(e) => setHodDeptId(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        {departments.map((department) => (
                                            <option
                                                key={department.id}
                                                value={department.id}
                                                disabled={assignedAdminDepartmentIds.has(department.id)}
                                            >
                                                {department.name}{assignedAdminDepartmentIds.has(department.id) ? ' (HOD assigned)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {hodMode === 'existing' ? (
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Current Users Available</label>
                                        <select
                                            value={selectedExistingHodId}
                                            onChange={(e) => setSelectedExistingHodId(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
                                        >
                                            {hodCandidateUsers.length === 0 ? (
                                                <option value="">No eligible users available</option>
                                            ) : hodCandidateUsers.map((user) => (
                                                <option key={user.id} value={user.id}>
                                                    {user.fullName} · {user.email}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            Select an existing faculty or student account from the application and promote that user as the department HOD.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">HOD Name</label>
                                            <input
                                                value={hodName}
                                                onChange={(e) => setHodName(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                                placeholder="e.g. Dr. Ananya Rao"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">HOD Email</label>
                                            <input
                                                value={hodEmail}
                                                onChange={(e) => setHodEmail(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                                placeholder="hod@college.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Initial Password</label>
                                            <input
                                                type="password"
                                                value={hodPassword}
                                                onChange={(e) => setHodPassword(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                            />
                                        </div>
                                    </>
                                )}
                                <button
                                    onClick={handleAssignDepartmentAdmin}
                                    disabled={!hodDeptId || (hodMode === 'existing' && !selectedExistingHodId)}
                                    className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:opacity-60"
                                >
                                    {hodMode === 'existing' ? 'Set Existing User as HOD' : 'Set Department HOD'}
                                </button>
                                <div className="rounded-xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Current Department HODs</p>
                                    <div className="space-y-2 text-sm">
                                        {departments.map((department) => {
                                            const departmentAdmin = users.find((user) =>
                                                user.departmentId === department.id && user.roles.includes('COLLEGE_ADMIN' as any)
                                            );
                                            return (
                                                <div key={department.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                                                    <div>
                                                        <p className="font-semibold">{department.code}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{department.name}</p>
                                                    </div>
                                                    <Badge label={departmentAdmin ? departmentAdmin.fullName : 'Unassigned'} tone={departmentAdmin ? 'warning' : 'neutral'} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    ) : null}
                    <SectionCard title="Add Individually" subtitle="Quick creation of a single profile">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Real Name</label>
                                <div className="relative">
                                    <ShieldCheck className="absolute left-3 top-3 text-slate-400" size={16} />
                                    <input
                                        value={fullName} onChange={(e) => setFullName(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Email Identifier</label>
                                <input
                                    value={email} onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                    placeholder="name@college.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Initial Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password} onChange={(e) => setPassword(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                        placeholder="Set secret..."
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-600"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Assignment</label>
                                    <select
                                        value={role} onChange={(e) => setRole(e.target.value as 'FACULTY' | 'COLLEGE_ADMIN' | 'STUDENT')}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        {!isFaculty && <option value="FACULTY">Faculty</option>}
                                        {isPrincipalMode && <option value="COLLEGE_ADMIN">Admin (HOD)</option>}
                                        <option value="STUDENT">Student</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Branch/Dept</label>
                                    <select
                                        value={deptId} onChange={(e) => setDeptId(e.target.value)}
                                        disabled={!isPrincipal}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
                                    >
                                        {departments.map(d => (
                                            <option
                                                key={d.id}
                                                value={d.id}
                                                disabled={role === 'COLLEGE_ADMIN' && assignedAdminDepartmentIds.has(d.id)}
                                            >
                                                {d.name}{role === 'COLLEGE_ADMIN' && assignedAdminDepartmentIds.has(d.id) ? ' (Admin assigned)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            {role === 'STUDENT' ? (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">PRN No</label>
                                        <input
                                            value={prnNo}
                                            onChange={(e) => setPrnNo(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                            placeholder="e.g. PRN2026001"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Roll No</label>
                                        <input
                                            value={rollNo}
                                            onChange={(e) => setRollNo(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                            placeholder="e.g. 24CSE101"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Year</label>
                                        <select
                                            value={yearSemester}
                                            onChange={(e) => setYearSemester(e.target.value as 'FE' | 'SE' | 'TE' | 'BE')}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                        >
                                            <option value="FE">FE</option>
                                            <option value="SE">SE</option>
                                            <option value="TE">TE</option>
                                            <option value="BE">BE</option>
                                        </select>
                                    </div>
                                </div>
                            ) : null}
                            {isPrincipalMode && role === 'COLLEGE_ADMIN' ? (
                                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                    One admin is allowed per department. Only departments without an assigned admin can be selected.
                                </p>
                            ) : !isPrincipal && currentDepartmentId ? (
                                <p className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300">
                                    New accounts created here are locked to your own department only.
                                </p>
                            ) : null}
                            <button
                                onClick={handleCreateUser}
                                disabled={role === 'COLLEGE_ADMIN' && !deptId}
                                className="w-full rounded-xl bg-cyan-600 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-500"
                            >
                                Create Account
                            </button>
                        </div>
                    </SectionCard>

                    <SectionCard title="Bulk User Actions" subtitle="Upload files for mass onboarding or mass removal">
                        <div className="space-y-5">
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                            <input type="file" ref={bulkDeleteInputRef} onChange={handleBulkDeleteUpload} className="hidden" />

                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={handleDownloadTemplate}
                                    disabled={uploading || bulkDeleting || templateDownloading}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                    <Download size={16} />
                                    {templateDownloading ? 'Downloading...' : 'Download Excel Template'}
                                </button>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading || bulkDeleting || templateDownloading}
                                    className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-8 transition hover:border-cyan-500 hover:bg-cyan-50/20 disabled:opacity-60 dark:border-slate-800 dark:hover:bg-cyan-900/10"
                                >
                                    {uploading ? <Loader2 className="animate-spin text-cyan-600" size={32} /> : <FileSpreadsheet className="text-slate-400" size={32} />}
                                    <div className="text-center">
                                        <p className="text-sm font-semibold">{uploading ? 'Creating Users...' : 'Bulk Create Users'}</p>
                                        <p className="text-xs text-slate-500">Excel or CSV upload, max size 2MB</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => bulkDeleteInputRef.current?.click()}
                                    disabled={uploading || bulkDeleting || templateDownloading}
                                    className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-rose-200 py-8 transition hover:border-rose-500 hover:bg-rose-50/30 disabled:opacity-60 dark:border-rose-900/40 dark:hover:bg-rose-950/10"
                                >
                                    {bulkDeleting ? <Loader2 className="animate-spin text-rose-600" size={32} /> : <Trash2 className="text-rose-500" size={32} />}
                                    <div className="text-center">
                                        <p className="text-sm font-semibold">{bulkDeleting ? 'Deleting Users...' : 'Bulk Delete Users'}</p>
                                        <p className="text-xs text-slate-500">Excel or CSV upload, max size 2MB</p>
                                    </div>
                                </button>
                            </div>

                            <div className="grid gap-4 xl:grid-cols-2">
                                <div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                                    <p className="mb-2 font-bold uppercase tracking-wider">Create Format</p>
                                    <code className="block break-all whitespace-normal rounded bg-white p-2 dark:bg-slate-900">
                                        name,email,role,deptId,password,prnNo,rollNo,yearSemester
                                    </code>
                                    <p className="mt-2">Role can be `FACULTY`, `COLLEGE_ADMIN`, or `STUDENT`.</p>
                                    <p className="mt-1">`prnNo`, `rollNo`, and `yearSemester` are optional for non-students and supported for students.</p>
                                </div>

                                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                                    <p className="mb-2 font-bold uppercase tracking-wider">Delete Format</p>
                                    <code className="block rounded bg-white p-2 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                        email
                                    </code>
                                    <p className="mt-2">One email per row. Header row `email` is supported.</p>
                                    <p className="mt-1">Deletion permissions still follow your role: faculty can remove students only, and you cannot delete your own account here.</p>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {(isPrincipalMode || isAdmin) ? (
                        <SectionCard
                            title="Clear Operational Data"
                            subtitle={isPrincipalMode ? 'Choose what to erase across the platform' : 'Choose what to erase for your department'}
                        >
                            <div className="rounded-2xl border border-rose-200/70 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/10">
                                <button
                                    type="button"
                                    onClick={() => setIsClearDataOpen((current) => !current)}
                                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-rose-100/40 dark:hover:bg-rose-950/10"
                                >
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="rounded-xl border border-rose-300/60 bg-white/70 p-2 text-rose-500 dark:border-rose-800/60 dark:bg-slate-950/50">
                                            <AlertTriangle size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-500">Danger Zone</p>
                                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                                {isClearDataOpen ? 'Hide clear-data actions' : 'Show clear-data actions'}
                                            </p>
                                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                {isPrincipalMode
                                                    ? 'Compact menu for announcements, timetable, resources, or full platform reset.'
                                                    : 'Compact menu for announcements, timetable, resources, or full department reset.'}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        size={18}
                                        className={`shrink-0 text-rose-500 transition-transform duration-300 ${isClearDataOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                <div className={`grid transition-all duration-300 ease-out ${isClearDataOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                    <div className="overflow-hidden">
                                        <div className="space-y-3 border-t border-rose-200/70 px-4 pb-4 pt-3 dark:border-rose-900/40">
                                            {clearActions.map((action) => (
                                                <button
                                                    key={action.mode}
                                                    onClick={() => handleClearOperationalData(action.mode, action.label)}
                                                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${action.tone}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{action.label}</p>
                                                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{action.helper}</p>
                                                        </div>
                                                        <Trash2 size={16} className="mt-0.5 shrink-0 text-rose-500" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
