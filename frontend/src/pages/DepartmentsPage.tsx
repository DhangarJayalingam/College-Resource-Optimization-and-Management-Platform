import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { SectionCard } from '../components/SectionCard';
import { Plus, Trash2, Edit2, Loader2, Building2, Search, Filter } from 'lucide-react';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment, Department } from '../services/api';

type DepartmentVisual = {
    palette: string;
    chipClass: string;
    image: string;
};

function createDepartmentIllustration(title: string, lines: string[], colors: { primary: string; secondary: string; accent: string }) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${colors.primary}" />
            <stop offset="55%" stop-color="${colors.secondary}" />
            <stop offset="100%" stop-color="#050816" />
          </linearGradient>
          <radialGradient id="glow" cx="70%" cy="25%" r="60%">
            <stop offset="0%" stop-color="${colors.accent}" stop-opacity="0.9" />
            <stop offset="100%" stop-color="${colors.accent}" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="420" rx="36" fill="url(#bg)" />
        <rect width="800" height="420" rx="36" fill="url(#glow)" />
        <g opacity="0.18" stroke="#ffffff" fill="none">
          <path d="M40 300 C170 200, 280 380, 420 250 S670 130, 760 220" stroke-width="3"/>
          <path d="M32 330 C160 230, 300 392, 450 275 S660 180, 770 275" stroke-width="2"/>
          <circle cx="160" cy="110" r="46" />
          <circle cx="645" cy="92" r="28" />
          <circle cx="705" cy="145" r="12" />
        </g>
        <g fill="#ffffff">
          <text x="48" y="94" font-size="48" font-family="Arial, sans-serif" font-weight="700">${title}</text>
          ${lines.map((line, index) =>
            `<text x="50" y="${150 + index * 38}" font-size="24" font-family="Arial, sans-serif" opacity="0.9">${line}</text>`
          ).join('')}
        </g>
      </svg>
    `;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildDepartmentBannerContent(dept: Department) {
    const title = dept.code.toUpperCase();
    const normalizedDescription = (dept.description || '').trim();
    const nameLine = dept.name.length > 26 ? `${dept.name.slice(0, 26)}...` : dept.name;

    const descriptionLines = normalizedDescription
        ? normalizedDescription
            .split(/[,.]/)
            .map((part) => part.trim())
            .filter(Boolean)
            .slice(0, 2)
        : [];

    const lines = [nameLine, ...descriptionLines].slice(0, 3);

    if (lines.length === 0) {
        lines.push(`${dept.code.toUpperCase()} Department`);
    }

    return { title, lines };
}

function getDepartmentVisual(dept: Department): DepartmentVisual {
    const key = `${dept.code} ${dept.name}`.toLowerCase();
    const banner = buildDepartmentBannerContent(dept);

    if (key.includes('computer') || key.includes('cse') || key.includes('it') || key.includes('software')) {
        return {
            palette: 'from-cyan-500/20 via-sky-500/10 to-transparent',
            chipClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
            image: createDepartmentIllustration(banner.title, banner.lines, {
                primary: '#0f766e',
                secondary: '#0f172a',
                accent: '#22d3ee'
            })
        };
    }

    if (key.includes('ece') || key.includes('electronics') || key.includes('communication')) {
        return {
            palette: 'from-violet-500/20 via-fuchsia-500/10 to-transparent',
            chipClass: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
            image: createDepartmentIllustration(banner.title, banner.lines, {
                primary: '#6d28d9',
                secondary: '#111827',
                accent: '#c084fc'
            })
        };
    }

    if (key.includes('mech') || key.includes('mechanical') || key.includes('automobile')) {
        return {
            palette: 'from-amber-500/20 via-orange-500/10 to-transparent',
            chipClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
            image: createDepartmentIllustration(banner.title, banner.lines, {
                primary: '#b45309',
                secondary: '#111827',
                accent: '#f59e0b'
            })
        };
    }

    if (key.includes('civil') || key.includes('architecture') || key.includes('construction')) {
        return {
            palette: 'from-emerald-500/20 via-lime-500/10 to-transparent',
            chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
            image: createDepartmentIllustration(banner.title, banner.lines, {
                primary: '#15803d',
                secondary: '#111827',
                accent: '#4ade80'
            })
        };
    }

    if (key.includes('electrical') || key.includes('eee') || key.includes('power')) {
        return {
            palette: 'from-yellow-500/20 via-amber-400/10 to-transparent',
            chipClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300',
            image: createDepartmentIllustration(banner.title, banner.lines, {
                primary: '#ca8a04',
                secondary: '#111827',
                accent: '#fde047'
            })
        };
    }

    return {
        palette: 'from-slate-500/20 via-slate-300/10 to-transparent',
        chipClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        image: createDepartmentIllustration(banner.title, banner.lines, {
            primary: '#334155',
            secondary: '#0f172a',
            accent: '#94a3b8'
        })
    };
}

export function DepartmentsPage() {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [search, setSearch] = useState('');

    // Form fields
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [campusId, setCampusId] = useState(1);

    useEffect(() => {
        loadDepartments();
    }, []);

    async function loadDepartments() {
        try {
            setLoading(true);
            const data = await getDepartments();
            setDepartments(data);
        } catch (error) {
            console.error('Failed to load departments', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit() {
        if (!name || !code) return;
        try {
            if (editingDept) {
                await updateDepartment(editingDept.id, { id: editingDept.id, name, code, description, campusId });
            } else {
                await createDepartment({ name, code, description, campusId });
            }
            resetForm();
            loadDepartments();
        } catch (error) {
            alert('Operation failed');
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Are you sure you want to delete this department?')) return;
        try {
            await deleteDepartment(id);
            loadDepartments();
        } catch (error) {
            alert('Delete failed');
        }
    }

    function openEdit(dept: Department) {
        setEditingDept(dept);
        setName(dept.name);
        setCode(dept.code);
        setDescription(dept.description);
        setCampusId(dept.campusId);
        setShowModal(true);
    }

    function resetForm() {
        setEditingDept(null);
        setName('');
        setCode('');
        setDescription('');
        setCampusId(1);
        setShowModal(false);
    }

    const filtered = departments.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 fade-up">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Department Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Organize and manage college faculty divisions</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 hover:shadow-cyan-500/30"
                >
                    <Plus size={18} />
                    Add Department
                </button>
            </header>

            <SectionCard title="Active Departments" subtitle="Manage your college organizational structure">
                <div className="mb-6 flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or code..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2.5 text-xs outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 dark:border-slate-800 dark:bg-slate-900/50"
                        />
                    </div>
                    <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-400">
                        <Filter size={16} />
                        Filter: Campus
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-cyan-600" size={32} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((dept) => (
                            (() => {
                                const visual = getDepartmentVisual(dept);

                                return (
                                    <div
                                        key={dept.id}
                                        onClick={() => navigate(`/app/departments/${dept.id}`)}
                                        className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white transition-all hover:-translate-y-1 hover:border-cyan-200 hover:shadow-2xl hover:shadow-cyan-500/10 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-cyan-900/40"
                                    >
                                        <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${visual.palette}`} />
                                        <div
                                            className="h-40 w-full border-b border-slate-200/70 bg-cover bg-center dark:border-slate-800"
                                            style={{ backgroundImage: `url("${visual.image}")` }}
                                        />

                                        <div className="relative p-5">
                                            <div className="mb-4 flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${visual.chipClass}`}>
                                                        <Building2 size={20} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold uppercase tracking-tight">{dept.code}</h3>
                                                        <p className="text-xs text-slate-400">ID: #{dept.id}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openEdit(dept);
                                                        }}
                                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-cyan-600 dark:hover:bg-slate-800"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleDelete(dept.id);
                                                        }}
                                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-rose-600 dark:hover:bg-slate-800"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <Badge label={`Campus ${dept.campusId}`} />
                                            </div>

                                            <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{dept.name}</h4>
                                            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
                                                {dept.description || `${dept.code} Department`}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()
                        ))}
                    </div>
                )}
            </SectionCard>

            {/* Modal Backdrop */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
                    <div className="w-full max-w-md scale-up rounded-3xl border border-white/40 bg-white/90 p-8 shadow-2xl backdrop-blur-2xl dark:border-slate-800/40 dark:bg-slate-950/90">
                        <h2 className="text-2xl font-bold mb-6">{editingDept ? 'Edit' : 'Add New'} Department</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Name</label>
                                <input
                                    value={name} onChange={(e) => setName(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                    placeholder="e.g. Computer Science and Engineering"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Code</label>
                                    <input
                                        value={code} onChange={(e) => setCode(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                        placeholder="e.g. CSE"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Campus ID</label>
                                    <input
                                        type="number" value={campusId} onChange={(e) => setCampusId(parseInt(e.target.value))}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Description</label>
                                <textarea
                                    value={description} onChange={(e) => setDescription(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-900"
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={resetForm} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
                                    Cancel
                                </button>
                                <button onClick={handleSubmit} className="flex-1 rounded-xl bg-cyan-600 py-3 text-sm font-bold text-white hover:bg-cyan-500">
                                    {editingDept ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
