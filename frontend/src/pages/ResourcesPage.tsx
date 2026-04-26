import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Building2, CalendarDays, Loader2, Pencil, Plus, Search, Sparkles, Trash2, Wrench } from 'lucide-react';
import { Badge } from '../components/Badge';
import { SectionCard } from '../components/SectionCard';
import {
  createResource,
  deleteResource,
  getCurrentUser,
  getDepartments,
  getEquipmentAssets,
  getResourceDashboard,
  getResourceInsights,
  getResourceSchedule,
  suggestBestManagedResource,
  updateResource,
  type Department
} from '../services/api';
import type {
  BestResourceSuggestion,
  EquipmentItem,
  ResourceDashboard,
  ResourceInsight,
  ResourceItem,
  ResourceScheduleItem
} from '../types';
import { canManageCampusData, getCurrentUserRoles } from '../utils/auth';

const resourceTypes = ['CLASSROOM', 'LAB', 'EQUIPMENT'] as const;
const editableResourceStatuses = ['AVAILABLE', 'UNDER_MAINTENANCE'] as const;
type ResourceTab = 'CLASSROOM' | 'LAB' | 'EQUIPMENT';
type ResourceViewMode = 'LIST' | 'CALENDAR';

const emptyForm: Omit<ResourceItem, 'id'> = {
  name: '',
  type: 'CLASSROOM',
  capacity: 0,
  building: '',
  departmentId: 1,
  tags: [],
  status: 'AVAILABLE',
  assignedLabId: null,
  lastMaintenanceDate: null
};

const todayIso = new Date().toISOString().slice(0, 10);

function toneBySmartStatus(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Available') return 'success';
  if (status === 'Occupied' || status === 'Reserved soon') return 'warning';
  if (status === 'Maintenance' || status === 'UNDER_MAINTENANCE') return 'danger';
  return 'neutral';
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : '-';
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function progressTone(percent: number) {
  if (percent >= 70) return 'bg-rose-500';
  if (percent >= 35) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function ResourcesPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<ResourceDashboard | null>(null);
  const [resourceInsights, setResourceInsights] = useState<ResourceInsight[]>([]);
  const [equipmentAssets, setEquipmentAssets] = useState<EquipmentItem[]>([]);
  const [schedule, setSchedule] = useState<ResourceScheduleItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeTab, setActiveTab] = useState<ResourceTab>('CLASSROOM');
  const [activeDept, setActiveDept] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [viewMode, setViewMode] = useState<ResourceViewMode>('LIST');
  const [capacityFilter, setCapacityFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('ALL');
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceInsight | null>(null);
  const [formState, setFormState] = useState<Omit<ResourceItem, 'id'>>(emptyForm);
  const [suggestion, setSuggestion] = useState<BestResourceSuggestion | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canManage = canManageCampusData();
  const roles = getCurrentUserRoles();
  const isDepartmentScoped = roles.includes('COLLEGE_ADMIN') && !roles.includes('SUPER_ADMIN');
  const [currentDepartmentId, setCurrentDepartmentId] = useState<number | null>(null);

  async function loadResources(targetDate = selectedDate) {
    try {
      setLoading(true);
      setError('');
      const [dashboardData, insightData, scheduleData, equipmentData, deptData, currentUser] = await Promise.all([
        getResourceDashboard(),
        getResourceInsights(targetDate),
        getResourceSchedule(targetDate),
        getEquipmentAssets(),
        getDepartments(),
        getCurrentUser()
      ]);
      const scopedDepartmentId = currentUser.departmentId;
      const scopedDepartments = isDepartmentScoped ? deptData.filter((department) => department.id === scopedDepartmentId) : deptData;
      setDashboard(dashboardData);
      setResourceInsights(insightData);
      setSchedule(scheduleData);
      setEquipmentAssets(equipmentData);
      setDepartments(scopedDepartments);
      setCurrentDepartmentId(scopedDepartmentId);
      setActiveDept(isDepartmentScoped ? String(scopedDepartmentId) : 'ALL');
      setFormState((prev) => ({ ...prev, departmentId: isDepartmentScoped ? scopedDepartmentId : prev.departmentId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResources(selectedDate);
  }, [selectedDate]);

  const buildingOptions = useMemo(
    () => [...new Set(resourceInsights.map((resource) => resource.building).filter(Boolean))].sort(),
    [resourceInsights]
  );

  const filteredResources = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const minCapacity = capacityFilter ? Number(capacityFilter) : 0;
    return resourceInsights.filter((resource) => {
      if (resource.type !== activeTab) return false;
      if (activeDept !== 'ALL' && String(resource.departmentId) !== activeDept) return false;
      if (availabilityFilter !== 'ALL' && resource.smartStatus !== availabilityFilter) return false;
      if (buildingFilter !== 'ALL' && resource.building !== buildingFilter) return false;
      if (minCapacity > 0 && resource.capacity < minCapacity) return false;
      if (equipmentFilter.trim() && !resource.tags.some((tag) => tag.toLowerCase().includes(equipmentFilter.trim().toLowerCase()))) return false;
      if (!normalizedSearch) return true;
      return resource.name.toLowerCase().includes(normalizedSearch)
        || resource.building.toLowerCase().includes(normalizedSearch)
        || resource.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
    });
  }, [activeDept, activeTab, availabilityFilter, buildingFilter, capacityFilter, equipmentFilter, resourceInsights, search]);

  const resourceById = useMemo(() => new Map(resourceInsights.map((resource) => [resource.id, resource])), [resourceInsights]);
  const selectedResourceSchedule = useMemo(() => {
    const relevant = schedule.filter((item) => selectedResourceId == null || item.resourceId === selectedResourceId);
    return relevant.sort((first, second) => `${first.bookingDate}${first.startTime}`.localeCompare(`${second.bookingDate}${second.startTime}`));
  }, [schedule, selectedResourceId]);
  const calendarGroups = useMemo(() => {
    const groups = new Map<number, ResourceScheduleItem[]>();
    selectedResourceSchedule.forEach((item) => groups.set(item.resourceId, [...(groups.get(item.resourceId) ?? []), item]));
    return groups;
  }, [selectedResourceSchedule]);

  function openCreateModal(tab: ResourceTab) {
    setEditingResource(null);
    setFormState({ ...emptyForm, type: tab, departmentId: currentDepartmentId ?? departments[0]?.id ?? emptyForm.departmentId });
    setIsModalOpen(true);
  }

  function openEditModal(resource: ResourceInsight) {
    setEditingResource(resource);
    setFormState({
      name: resource.name,
      type: resource.type,
      capacity: resource.capacity,
      building: resource.building,
      departmentId: resource.departmentId,
      tags: resource.tags,
      status: resource.smartStatus === 'Maintenance' ? 'UNDER_MAINTENANCE' : 'AVAILABLE',
      assignedLabId: null,
      lastMaintenanceDate: resource.lastMaintenanceDate
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      const payload = { ...formState, tags: formState.tags.filter(Boolean) };
      if (editingResource) await updateResource(editingResource.id, payload);
      else await createResource(payload);
      setIsModalOpen(false);
      setEditingResource(null);
      setFormState(emptyForm);
      await loadResources(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save resource');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      setError('');
      await deleteResource(id);
      await loadResources(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete resource');
    }
  }

  async function handleMarkMaintenance(resource: ResourceInsight) {
    try {
      setError('');
      await updateResource(resource.id, {
        name: resource.name,
        type: resource.type,
        capacity: resource.capacity,
        building: resource.building,
        departmentId: resource.departmentId,
        tags: resource.tags,
        status: 'UNDER_MAINTENANCE',
        assignedLabId: null,
        lastMaintenanceDate: resource.lastMaintenanceDate
      });
      await loadResources(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update maintenance status');
    }
  }

  async function handleSuggestBestResource() {
    try {
      setLoadingSuggestion(true);
      setError('');
      const result = await suggestBestManagedResource({
        resourceType: activeTab,
        capacity: capacityFilter ? Number(capacityFilter) : 30,
        departmentId: activeDept === 'ALL' ? null : Number(activeDept),
        building: buildingFilter === 'ALL' ? '' : buildingFilter,
        equipment: equipmentFilter
      });
      setSuggestion(result);
      setSelectedResourceId(result.resourceId);
      setViewMode('CALENDAR');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not suggest a resource');
    } finally {
      setLoadingSuggestion(false);
    }
  }

  const labOptions = resourceInsights.filter((resource) => resource.type === 'LAB');

  return (
    <div className="space-y-6 fade-up">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-slate-950/20">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_left,rgba(16,185,129,0.18),transparent_35%),linear-gradient(135deg,#020617_0%,#0f172a_52%,#0f3b4f_100%)] px-6 py-8 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300/80">Resource Intelligence</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">Resource Management</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Monitor usage, inspect schedules, filter by readiness, and let AI suggest the best-fit space or asset for each operational need.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setViewMode('LIST')} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${viewMode === 'LIST' ? 'bg-white text-slate-950' : 'border border-white/20 bg-white/5 text-white'}`}>List View</button>
              <button type="button" onClick={() => setViewMode('CALENDAR')} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${viewMode === 'CALENDAR' ? 'bg-white text-slate-950' : 'border border-white/20 bg-white/5 text-white'}`}>Calendar View</button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Utilization', value: `${dashboard?.utilizationPercent ?? 0}%`, helper: 'Current platform usage', icon: Activity },
          { label: 'Active Bookings', value: String(dashboard?.activeBookings ?? 0), helper: 'Live schedule load', icon: CalendarDays },
          { label: 'Most Used', value: dashboard?.mostUsedResource ?? '-', helper: 'Highest demand resource', icon: Sparkles },
          { label: 'Underused', value: String(dashboard?.underusedResources.length ?? 0), helper: 'Resources needing attention', icon: Building2 }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/55">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-3 truncate text-2xl font-bold">{item.value}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.helper}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><Icon size={20} /></div>
              </div>
            </article>
          );
        })}
      </section>

      <SectionCard title="Smart Filters" subtitle="Refine by operational fit, readiness, and location">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.9fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search resources, tags, or buildings" className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800" />
          </label>
          {isDepartmentScoped ? <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{departments[0]?.code ?? 'Dept'}</div> : (
            <select value={activeDept} onChange={(event) => setActiveDept(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800">
              <option value="ALL">All Departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.code}</option>)}
            </select>
          )}
          <input value={capacityFilter} onChange={(event) => setCapacityFilter(event.target.value)} type="number" min="0" placeholder="Min capacity" className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800" />
          <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800">
            <option value="ALL">All Status</option><option value="Available">Available</option><option value="Occupied">Occupied</option><option value="Reserved soon">Reserved soon</option><option value="Maintenance">Maintenance</option>
          </select>
          <input value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value)} placeholder="Equipment / tag" className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800" />
          <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800">
            <option value="ALL">All Buildings</option>
            {buildingOptions.map((building) => <option key={building} value={building}>{building}</option>)}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {resourceTypes.map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                {tab === 'CLASSROOM' ? 'Classrooms' : tab === 'LAB' ? 'Labs' : 'Equipment'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800" />
            <button type="button" onClick={handleSuggestBestResource} disabled={loadingSuggestion} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70">
              {loadingSuggestion ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Suggest Best Resource
            </button>
            {canManage ? <button type="button" onClick={() => openCreateModal(activeTab)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700"><Plus size={16} />Add Resource</button> : null}
          </div>
        </div>
      </SectionCard>

      {suggestion ? (
        <SectionCard title="AI Suggestion" subtitle="Best-fit recommendation based on availability, capacity, and department">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">{suggestion.recommendationType}</p>
              <h3 className="mt-2 text-2xl font-bold">{suggestion.resourceName}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{suggestion.explanation}</p>
            </div>
            <div className="space-y-2 text-right">
              <Badge label={`${suggestion.score}/100 fit`} tone="success" />
              <p className="text-sm text-slate-500 dark:text-slate-400">{suggestion.resourceType} · {suggestion.building}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={viewMode === 'LIST' ? 'Resource Cards' : 'Booking Calendar'} subtitle={viewMode === 'LIST' ? 'Each card includes health, status, quick actions, and usage visibility' : 'See the selected date schedule grouped by resource'}>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-cyan-600" size={30} /></div>
        ) : viewMode === 'LIST' ? (
          <div className="space-y-4">
            {dashboard?.underusedResources?.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="font-semibold text-amber-800 dark:text-amber-200">Underused resources</p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">{dashboard.underusedResources.join(', ')}</p>
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {filteredResources.map((resource) => {
                const dept = departments.find((department) => department.id === resource.departmentId);
                return (
                  <article key={resource.id} className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-semibold">{resource.name}</p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Building2 size={14} />{resource.building}</p>
                      </div>
                      <Badge label={resource.smartStatus} tone={toneBySmartStatus(resource.smartStatus)} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/70">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Usage level</p>
                        <p className="mt-2 text-lg font-semibold">{resource.usageLevel}</p>
                        <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800"><div className={`h-2 rounded-full ${progressTone(resource.utilizationPercent)}`} style={{ width: `${resource.utilizationPercent}%` }} /></div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{resource.utilizationPercent}% utilization</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/70">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Resource health</p>
                        <p className="mt-2 text-lg font-semibold">{resource.maintenanceAlert ? 'Attention needed' : 'Healthy'}</p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{resource.maintenanceAlert ? resource.maintenanceStatus : `Last maintenance ${formatDate(resource.lastMaintenanceDate)}`}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <p>Type: <strong>{resource.type}</strong></p>
                      <p>Department: <strong>{dept ? `${dept.code} - ${dept.name}` : `ID#${resource.departmentId}`}</strong></p>
                      <p>Capacity: <strong>{resource.capacity}</strong></p>
                      <p>Next schedule: <strong>{resource.nextBookingDate ? `${formatDate(resource.nextBookingDate)} ${formatTime(resource.nextBookingStartTime)} - ${formatTime(resource.nextBookingEndTime)}` : 'No booking scheduled'}</strong></p>
                      <p>Active bookings: <strong>{resource.activeBookings}</strong></p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {resource.tags.map((tag) => <Badge key={tag} label={tag} />)}
                    </div>
                    {resource.type === 'LAB' ? (
                      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950/70">
                        <p className="font-semibold">Linked equipment</p>
                        <div className="mt-3 space-y-2">
                          {equipmentAssets.filter((equipment) => equipment.assignedLabId === resource.id).slice(0, 4).map((equipment) => (
                            <div key={equipment.id} className="flex items-center justify-between gap-3">
                              <span>{equipment.assetName}</span>
                              <Badge label={equipment.status} tone={toneBySmartStatus(equipment.status)} />
                            </div>
                          ))}
                          {equipmentAssets.filter((equipment) => equipment.assignedLabId === resource.id).length === 0 ? <p className="text-xs text-slate-500 dark:text-slate-400">No linked equipment yet.</p> : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => navigate('/app/bookings')} className="rounded-xl border border-cyan-200 px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-950/30">Book</button>
                      <button type="button" onClick={() => { setSelectedResourceId(resource.id); setViewMode('CALENDAR'); }} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">View Schedule</button>
                      <button type="button" onClick={() => handleMarkMaintenance(resource)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-950/20"><Wrench size={14} />Mark Maintenance</button>
                      <button type="button" onClick={() => setSelectedResourceId(resource.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-950/20"><Activity size={14} />View Usage</button>
                    </div>
                    {canManage ? (
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => openEditModal(resource)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Pencil size={14} />Edit</button>
                        <button type="button" onClick={() => handleDelete(resource.id)} className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-900/20"><Trash2 size={14} />Delete</button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div>
                <p className="text-sm font-semibold">Booking schedule for {formatDate(selectedDate)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Switch resources by clicking “View Schedule” or “View Usage” on any card.</p>
              </div>
              <select value={selectedResourceId ?? ''} onChange={(event) => setSelectedResourceId(event.target.value ? Number(event.target.value) : null)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900">
                <option value="">All visible resources</option>
                {filteredResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
              </select>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {(selectedResourceId ? [selectedResourceId] : filteredResources.map((resource) => resource.id)).map((resourceId) => {
                const resource = resourceById.get(resourceId);
                if (!resource) return null;
                const items = calendarGroups.get(resourceId) ?? [];
                return (
                  <article key={resourceId} className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="flex items-start justify-between gap-4">
                      <div><p className="text-lg font-semibold">{resource.name}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{resource.building} · {resource.type}</p></div>
                      <Badge label={resource.smartStatus} tone={toneBySmartStatus(resource.smartStatus)} />
                    </div>
                    <div className="mt-4 space-y-3">
                      {items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">No bookings scheduled for this date.</div> : items.map((item, index) => (
                        <div key={`${item.resourceId}-${item.startTime}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                          <div className="flex items-center justify-between gap-3"><p className="font-semibold">{formatTime(item.startTime)} - {formatTime(item.endTime)}</p><Badge label={item.status} tone={toneBySmartStatus(item.status)} /></div>
                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.source === 'BOOKING' ? 'Advanced booking' : 'Legacy booking'}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">{error}</p>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold">{editingResource ? 'Edit Resource' : 'Add Resource'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Manage classrooms, labs, and equipment from one form.</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span>Name</span>
                <input value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="space-y-2 text-sm">
                <span>Type</span>
                <select value={formState.type} onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value as ResourceTab }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800">
                  {resourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>Capacity</span>
                <input type="number" value={formState.capacity} onChange={(event) => setFormState((prev) => ({ ...prev, capacity: Number(event.target.value) }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="space-y-2 text-sm">
                <span>Building</span>
                <input value={formState.building} onChange={(event) => setFormState((prev) => ({ ...prev, building: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="space-y-2 text-sm">
                <span>Department</span>
                <select value={formState.departmentId} onChange={(event) => setFormState((prev) => ({ ...prev, departmentId: Number(event.target.value) }))} disabled={isDepartmentScoped} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800">
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>Tags</span>
                <input value={formState.tags.join(', ')} onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean) }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="space-y-2 text-sm">
                <span>Status</span>
                <select value={formState.status} onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as ResourceItem['status'] }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800">
                  {editableResourceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>

              {formState.type === 'EQUIPMENT' ? (
                <>
                  <label className="space-y-2 text-sm">
                    <span>Assigned Lab</span>
                    <select value={formState.assignedLabId ?? ''} onChange={(event) => setFormState((prev) => ({ ...prev, assignedLabId: event.target.value ? Number(event.target.value) : null }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800">
                      <option value="">Unassigned</option>
                      {labOptions.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm">
                    <span>Last maintenance date</span>
                    <input type="date" value={formState.lastMaintenanceDate ?? ''} onChange={(event) => setFormState((prev) => ({ ...prev, lastMaintenanceDate: event.target.value || null }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800" />
                  </label>
                </>
              ) : null}

              <div className="flex gap-3 md:col-span-2">
                <button type="submit" disabled={submitting} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-70">{submitting ? 'Saving...' : editingResource ? 'Update Resource' : 'Create Resource'}</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
