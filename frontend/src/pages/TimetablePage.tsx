import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, FileSpreadsheet, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Badge } from '../components/Badge';
import { SectionCard } from '../components/SectionCard';
import {
  clearOperationalData,
  createManagedTimetableEntry,
  deleteManagedTimetableEntry,
  downloadTimetableTemplate,
  bulkUploadTimetableEntries,
  getConflicts,
  getCurrentUser,
  getDepartments,
  getDepartmentFaculty,
  getManagedTimetableEntries,
  getResources,
  updateManagedTimetableEntry
} from '../services/api';
import type { ConflictItem, DepartmentFaculty, ResourceItem, TimetableEntry, TimetableFormEntry } from '../types';
import type { Department } from '../services/api';
import { canManageCampusData, getCurrentUserRoles } from '../utils/auth';

const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
const academicLevels = ['ALL', 'FE', 'SE', 'TE', 'BE'] as const;
const SLOT_STORAGE_KEY = 'cop_timetable_slots';
const SECTION_STORAGE_KEY = 'cop_timetable_sections';
const SLOT_MERGE_STORAGE_KEY = 'cop_timetable_slot_merges';
const SLOT_HIDDEN_STORAGE_KEY = 'cop_timetable_hidden_slots';
const SLOT_COLUMN_MIN_WIDTH = 132;
const FACULTY_SHORT_CODES: Record<string, string> = {
  'PATIL WALMIK DHARMARAJ': 'WDP',
  'PACHGHARE RADHIKA PANKAJ': 'RPP',
  'KHOT SUREKHA ANNAPPA': 'SAK',
  'DEORE SAHILA KASHINATH': 'SPP',
  'POTRAJE POONAM PRAKASH': 'PPP',
  'DEORE MANASI NANDKISHOR': 'MND',
  'DEORE SAREEN SHANKAR': 'SD',
  'BHOLE VARSHA YOGESH': 'VYB',
  'SAMPADA LOKHANDE': 'SSD'
};

const emptyForm: TimetableFormEntry = {
  course: '',
  academicLevel: 'FE',
  sectionCode: 'F1',
  faculty: '',
  resourceId: 0,
  resourceType: 'CLASSROOM',
  type: 'LECTURE',
  duration: 1,
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '10:00'
};

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function formatDisplayTime(time: string) {
  const [hoursText, minutes] = formatTime(time).split(':');
  const hours = Number(hoursText);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 || 12;
  return `${String(normalizedHours).padStart(2, '0')}:${minutes} ${suffix}`;
}

function dayLabel(day: string) {
  return day.slice(0, 3);
}

function slotKey(start: string, end: string) {
  return `${formatTime(start)}-${formatTime(end)}`;
}

function toTimeText(totalMinutes: number) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function slotDurationInMinutes(startTime: string, endTime: string) {
  return Math.max(0, toMinutes(formatTime(endTime)) - toMinutes(formatTime(startTime)));
}

function formatEntryKindLabel(type: TimetableFormEntry['type'], duration: number) {
  if (type === 'LAB') {
    return `LAB (${duration} hrs)`;
  }
  return 'LECTURE';
}

function resolveSlotRange(
  slots: Array<{ start: string; end: string }>,
  requestedStartTime: string,
  duration: number
) {
  const normalizedStartTime = formatTime(requestedStartTime);
  const startIndex = slots.findIndex((slot) => formatTime(slot.start) === normalizedStartTime);

  if (startIndex < 0) {
    const fallbackSlot = slots[0];
    return {
      startTime: formatTime(fallbackSlot?.start ?? requestedStartTime),
      endTime: formatTime(fallbackSlot?.end ?? requestedStartTime)
    };
  }

  const spanSlots = slots.slice(startIndex, startIndex + Math.max(1, duration));
  if (spanSlots.length < Math.max(1, duration)) {
    return {
      startTime: formatTime(slots[startIndex].start),
      endTime: formatTime(slots[startIndex].end)
    };
  }

  const isContinuous = spanSlots.every((slot, index) =>
    index === 0 || formatTime(spanSlots[index - 1].end) === formatTime(slot.start)
  );

  return {
    startTime: formatTime(slots[startIndex].start),
    endTime: formatTime(isContinuous ? spanSlots[spanSlots.length - 1].end : slots[startIndex].end)
  };
}

function cardTone(entryType: 'LECTURE' | 'LAB', generatedByAi: boolean, hasConflict: boolean) {
  if (hasConflict) return 'border-red-300 bg-red-50/90 dark:border-red-900/50 dark:bg-red-950/30';
  if (entryType === 'LAB') return 'border-violet-200 bg-violet-50/90 dark:border-violet-900/50 dark:bg-violet-950/30';
  if (generatedByAi) return 'border-emerald-200 bg-emerald-50/90 dark:border-emerald-900/50 dark:bg-emerald-950/30';
  return 'border-cyan-200 bg-cyan-50/90 dark:border-cyan-900/50 dark:bg-cyan-950/20';
}

function defaultSectionForLevel(level: TimetableFormEntry['academicLevel']) {
  if (level === 'FE') return 'F1';
  if (level === 'SE') return 'S1';
  if (level === 'TE') return 'T1';
  return 'B1';
}

function sectionOptionsForLevel(level: TimetableFormEntry['academicLevel']) {
  if (level === 'FE') return ['F1', 'F2', 'F3'];
  if (level === 'SE') return ['S1', 'S2', 'S3'];
  if (level === 'TE') return ['T1', 'T2', 'T3'];
  return ['B1', 'B2', 'B3'];
}

function sectionPrefixForLevel(level: TimetableFormEntry['academicLevel']) {
  if (level === 'FE') return 'F';
  if (level === 'SE') return 'S';
  if (level === 'TE') return 'T';
  return 'B';
}

function formatSectionCodeLabel(sectionCode: string, entryType?: TimetableFormEntry['type']) {
  if (entryType === 'LECTURE') {
    return 'ALL';
  }
  return sectionCode;
}

function compactEntryCode(entry: TimetableEntry) {
  const resource = entry.resourceName || 'NA';
  const section = formatSectionCodeLabel(entry.sectionCode, entry.type);
  const kind = entry.type === 'LAB' ? 'LAB' : 'LEC';
  return `${entry.courseCode}-${section}-${resource}-${kind}`;
}

function facultyShortLabel(facultyName: string) {
  const normalizedName = facultyName.trim();
  const exactMatch = FACULTY_SHORT_CODES[normalizedName];
  if (exactMatch) {
    return exactMatch;
  }

  const fallbackMatch = Object.entries(FACULTY_SHORT_CODES).find(
    ([fullName]) => fullName.toUpperCase() === normalizedName.toUpperCase()
  );
  return fallbackMatch?.[1] ?? facultyName;
}

function facultyInputMatches(memberName: string, input: string) {
  const normalizedMember = memberName.trim().toUpperCase();
  const normalizedInput = input.trim().toUpperCase();
  return normalizedMember === normalizedInput || facultyShortLabel(memberName).toUpperCase() === normalizedInput;
}

function facultyOptionLabel(memberName: string) {
  const shortCode = facultyShortLabel(memberName);
  return shortCode === memberName ? memberName : `${memberName} (${shortCode})`;
}

export function TimetablePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentFaculty, setDepartmentFaculty] = useState<DepartmentFaculty[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [editingSlotKey, setEditingSlotKey] = useState<string | null>(null);
  const [formState, setFormState] = useState<TimetableFormEntry>(emptyForm);
  const [customSlots, setCustomSlots] = useState<Array<{ start: string; end: string }>>([]);
  const [hiddenSlotKeys, setHiddenSlotKeys] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<Record<'FE' | 'SE' | 'TE' | 'BE', string[]>>({
    FE: [],
    SE: [],
    TE: [],
    BE: []
  });
  const [newSectionCode, setNewSectionCode] = useState('');
  const [activeDepartmentFilter, setActiveDepartmentFilter] = useState<number | null>(null);
  const [activeAcademicLevel, setActiveAcademicLevel] = useState<(typeof academicLevels)[number]>('ALL');
  const [activeFacultyFilter, setActiveFacultyFilter] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState({ startTime: '10:00', endTime: '11:00' });
  const [mergedSlotGroups, setMergedSlotGroups] = useState<string[][]>([]);
  const [mergeSelectionKey, setMergeSelectionKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [resettingTimetable, setResettingTimetable] = useState(false);
  const bulkUploadInputRef = useRef<HTMLInputElement>(null);

  const canManage = canManageCampusData();
  const roles = getCurrentUserRoles();
  const isDepartmentScoped = roles.includes('COLLEGE_ADMIN') && !roles.includes('SUPER_ADMIN');

  async function loadTimetable() {
    try {
      setError('');
      const [entryData, conflictData, resourceData, currentUser] = await Promise.all([
        getManagedTimetableEntries(),
        getConflicts(),
        getResources(),
        getCurrentUser()
      ]);
      const departmentData = await getDepartments();
      const scopedDepartmentId = currentUser.departmentId;
      const scopedDepartments = isDepartmentScoped
        ? departmentData.filter((department) => department.id === scopedDepartmentId)
        : departmentData;
      setEntries(entryData);
      setConflicts(conflictData);
      setResources(resourceData);
      setDepartments(scopedDepartments);
      if (isDepartmentScoped) {
        setActiveDepartmentFilter(scopedDepartmentId);
      } else {
        setActiveDepartmentFilter((current) => current ?? scopedDepartments[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timetable');
    }
  }

  useEffect(() => {
    loadTimetable();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SLOT_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Array<{ start: string; end: string }>;
      setCustomSlots(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCustomSlots([]);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SLOT_HIDDEN_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as string[];
      setHiddenSlotKeys(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHiddenSlotKeys([]);
    }
  }, []);

  useEffect(() => {
    if (activeDepartmentFilter === null) {
      setDepartmentFaculty([]);
      return;
    }

    getDepartmentFaculty(activeDepartmentFilter)
      .then((faculty) => {
        setDepartmentFaculty(faculty);
        setFormState((current) => {
          if (!faculty.length) {
            return current;
          }

          const hasSelectedFaculty = faculty.some((member) => facultyInputMatches(member.name, current.faculty));
          return hasSelectedFaculty ? current : { ...current, faculty: faculty[0].name };
        });
      })
      .catch(() => {
        setDepartmentFaculty([]);
      });
  }, [activeDepartmentFilter]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SECTION_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Record<'FE' | 'SE' | 'TE' | 'BE', string[]>;
      setCustomSections({
        FE: Array.isArray(parsed?.FE) ? parsed.FE : [],
        SE: Array.isArray(parsed?.SE) ? parsed.SE : [],
        TE: Array.isArray(parsed?.TE) ? parsed.TE : [],
        BE: Array.isArray(parsed?.BE) ? parsed.BE : []
      });
    } catch {
      setCustomSections({ FE: [], SE: [], TE: [], BE: [] });
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SLOT_MERGE_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as string[][];
      setMergedSlotGroups(Array.isArray(parsed) ? parsed.filter((group) => Array.isArray(group) && group.length > 1) : []);
    } catch {
      setMergedSlotGroups([]);
    }
  }, []);

  // Handle query parameters for faculty filtering
  useEffect(() => {
    const facultyParam = searchParams.get('faculty');
    const departmentParam = searchParams.get('department');

    if (facultyParam) {
      setActiveFacultyFilter(decodeURIComponent(facultyParam));
    }

    if (departmentParam) {
      const deptId = parseInt(departmentParam, 10);
      if (!Number.isNaN(deptId)) {
        setActiveDepartmentFilter(deptId);
      }
    }
  }, [searchParams]);

  const scheduleResources = useMemo(
    () => resources.filter((resource) => resource.type === 'CLASSROOM' || resource.type === 'LAB'),
    [resources]
  );

  const sectionOptions = useMemo(
    () => formState.type === 'LECTURE'
      ? [defaultSectionForLevel(formState.academicLevel)]
      : [
        ...sectionOptionsForLevel(formState.academicLevel),
        ...customSections[formState.academicLevel]
      ].filter((value, index, source) => source.indexOf(value) === index),
    [customSections, formState.academicLevel, formState.type]
  );

  const departmentFilteredEntries = useMemo(
    () => activeDepartmentFilter === null
      ? entries
      : entries.filter((entry) => entry.departmentId === activeDepartmentFilter),
    [activeDepartmentFilter, entries]
  );

  const facultyFilteredEntries = useMemo(
    () => activeFacultyFilter === null
      ? departmentFilteredEntries
      : departmentFilteredEntries.filter((entry) =>
        entry.facultyName.trim().toUpperCase() === activeFacultyFilter.trim().toUpperCase()
      ),
    [activeFacultyFilter, departmentFilteredEntries]
  );

  const visibleEntries = useMemo(
    () => activeAcademicLevel === 'ALL'
      ? facultyFilteredEntries
      : facultyFilteredEntries.filter((entry) => entry.academicLevel === activeAcademicLevel),
    [activeAcademicLevel, facultyFilteredEntries]
  );

  const activeDepartment = useMemo(
    () => departments.find((department) => department.id === activeDepartmentFilter) ?? null,
    [activeDepartmentFilter, departments]
  );

  const timeSlots = useMemo(() => {
    const slotMap = new Map<string, { start: string; end: string; label: string }>();

    visibleEntries.forEach((entry) => {
      const totalMinutes = toMinutes(entry.endTime) - toMinutes(entry.startTime);
      const slotDurationMinutes = Math.max(30, Math.floor(totalMinutes / Math.max(1, entry.duration)));

      for (let index = 0; index < Math.max(1, entry.duration); index += 1) {
        const slotStartMinutes = toMinutes(entry.startTime) + index * slotDurationMinutes;
        const slotEndMinutes = slotStartMinutes + slotDurationMinutes;
        const start = `${String(Math.floor(slotStartMinutes / 60)).padStart(2, '0')}:${String(slotStartMinutes % 60).padStart(2, '0')}`;
        const end = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;
        const key = `${start}-${end}`;
        if (!slotMap.has(key)) {
          slotMap.set(key, { start, end, label: `${start} - ${end}` });
        }
      }
    });

    if (slotMap.size === 0) {
      [
        ['09:00', '10:00'],
        ['10:00', '11:00'],
        ['11:00', '12:00'],
        ['12:00', '13:00'],
        ['14:00', '15:00'],
        ['15:00', '16:00']
      ].forEach(([start, end]) => {
        slotMap.set(`${start}-${end}`, { start, end, label: `${start} - ${end}` });
      });
    }

    customSlots.forEach((slot) => {
      const start = formatTime(slot.start);
      const end = formatTime(slot.end);
      slotMap.set(`${start}-${end}`, { start, end, label: `${start} - ${end}` });
    });

    return [...slotMap.values()]
      .filter((slot) => !hiddenSlotKeys.includes(slotKey(slot.start, slot.end)))
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  }, [customSlots, hiddenSlotKeys, visibleEntries]);

  const filteredResourceOptions = useMemo(
    () => scheduleResources.filter((resource) =>
      resource.type === formState.resourceType
      && (activeDepartmentFilter === null || resource.departmentId === activeDepartmentFilter)
    ),
    [activeDepartmentFilter, formState.resourceType, scheduleResources]
  );

  const availableStartSlots = useMemo(() => {
    return timeSlots.filter((slot, index, slots) => {
      if (index + formState.duration > slots.length) {
        return false;
      }

      for (let offset = 0; offset < formState.duration - 1; offset += 1) {
        if (formatTime(slots[index + offset].end) !== formatTime(slots[index + offset + 1].start)) {
          return false;
        }
      }

      return true;
    });
  }, [formState.duration, timeSlots]);

  useEffect(() => {
    setFormState((current) => {
      if (editingEntry) {
        return current;
      }

      const hasSelectedResource = filteredResourceOptions.some((resource) => resource.id === current.resourceId);
      if (hasSelectedResource) {
        return current;
      }

      return {
        ...current,
        resourceId: filteredResourceOptions[0]?.id ?? 0
      };
    });
  }, [editingEntry, filteredResourceOptions]);

  useEffect(() => {
    setFormState((current) => {
      const nextType = current.type === 'LAB' ? 'LAB' : 'LECTURE';
      const nextResourceType = nextType === 'LAB' ? 'LAB' : 'CLASSROOM';
      const nextDuration = nextType === 'LAB' ? Math.max(1, current.duration) : 1;
      const nextSectionCode = nextType === 'LECTURE'
        ? defaultSectionForLevel(current.academicLevel)
        : current.sectionCode;

      if (
        current.resourceType === nextResourceType
        && current.duration === nextDuration
        && current.sectionCode === nextSectionCode
      ) {
        return current;
      }

      return {
        ...current,
        resourceType: nextResourceType,
        duration: nextDuration,
        sectionCode: nextSectionCode
      };
    });
  }, [formState.type]);

  useEffect(() => {
    setFormState((current) => {
      const matchingStart = availableStartSlots.some((slot) => formatTime(slot.start) === formatTime(current.startTime));
      const nextStartTime = matchingStart
        ? formatTime(current.startTime)
        : formatTime(availableStartSlots[0]?.start ?? current.startTime);
      const nextRange = resolveSlotRange(timeSlots, nextStartTime, current.duration);

      if (
        formatTime(current.startTime) === nextRange.startTime
        && formatTime(current.endTime) === nextRange.endTime
      ) {
        return current;
      }

      return {
        ...current,
        startTime: nextRange.startTime,
        endTime: nextRange.endTime
      };
    });
  }, [availableStartSlots, timeSlots]);

  const normalizedMergedSlotGroups = useMemo(() => {
    const validSlotKeys = timeSlots.map((slot) => `${slot.start}-${slot.end}`);
    const validSlotKeySet = new Set(validSlotKeys);
    const normalized: string[][] = [];
    const claimedKeys = new Set<string>();

    mergedSlotGroups.forEach((group) => {
      const deduped = group.filter((key, index) => group.indexOf(key) === index && validSlotKeySet.has(key));
      if (deduped.length < 2) {
        return;
      }

      const indices = deduped
        .map((key) => validSlotKeys.indexOf(key))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b);

      if (indices.length < 2) {
        return;
      }

      const startIndex = indices[0];
      const endIndex = indices[indices.length - 1];
      const contiguousGroup = validSlotKeys.slice(startIndex, endIndex + 1);
      if (contiguousGroup.some((key) => claimedKeys.has(key))) {
        return;
      }

      contiguousGroup.forEach((key) => claimedKeys.add(key));
      normalized.push(contiguousGroup);
    });

    return normalized;
  }, [mergedSlotGroups, timeSlots]);

  useEffect(() => {
    localStorage.setItem(SLOT_MERGE_STORAGE_KEY, JSON.stringify(normalizedMergedSlotGroups));
    if (JSON.stringify(normalizedMergedSlotGroups) !== JSON.stringify(mergedSlotGroups)) {
      setMergedSlotGroups(normalizedMergedSlotGroups);
    }
  }, [mergedSlotGroups, normalizedMergedSlotGroups]);

  const slotDisplayGroups = useMemo(() => {
    const slotByKey = new Map(timeSlots.map((slot) => [`${slot.start}-${slot.end}`, slot]));
    const mergedLookup = new Map<string, string[]>();

    normalizedMergedSlotGroups.forEach((group) => {
      group.forEach((key) => mergedLookup.set(key, group));
    });

    const groups: Array<{ slots: typeof timeSlots; key: string; merged: boolean }> = [];
    const consumed = new Set<string>();

    timeSlots.forEach((slot) => {
      const key = `${slot.start}-${slot.end}`;
      if (consumed.has(key)) {
        return;
      }

      const mergedKeys = mergedLookup.get(key);
      if (mergedKeys) {
        const slots = mergedKeys
          .map((mergedKey) => slotByKey.get(mergedKey))
          .filter((value): value is (typeof timeSlots)[number] => Boolean(value));
        slots.forEach((item) => consumed.add(`${item.start}-${item.end}`));
        groups.push({
          slots,
          key: mergedKeys.join('|'),
          merged: true
        });
        return;
      }

      consumed.add(key);
      groups.push({
        slots: [slot],
        key,
        merged: false
      });
    });

    return groups;
  }, [normalizedMergedSlotGroups, timeSlots]);

  const entriesByDayAndSlot = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();

    dayOrder.forEach((day) => {
      timeSlots.forEach((slot) => {
        const matches = visibleEntries
          .filter((entry) => {
            const entryStart = toMinutes(entry.startTime);
            const entryEnd = toMinutes(entry.endTime);
            const slotStart = toMinutes(slot.start);
            const slotEnd = toMinutes(slot.end);

            return entry.dayOfWeek === day && entryStart < slotEnd && entryEnd > slotStart;
          })
          .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

        map.set(`${day}-${slot.label}`, matches);
      });
    });

    return map;
  }, [timeSlots, visibleEntries]);

  function openCreateModal() {
    setEditingEntry(null);
    setFormState({
      ...emptyForm,
      faculty: departmentFaculty[0]?.name ?? '',
      resourceId: filteredResourceOptions[0]?.id ?? 0,
      sectionCode: defaultSectionForLevel(emptyForm.academicLevel),
      ...resolveSlotRange(timeSlots, emptyForm.startTime, emptyForm.duration)
    });
    setIsModalOpen(true);
  }

  function openSlotModal() {
    const orderedSlots = [...timeSlots].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    const lastVisibleSlot = orderedSlots[orderedSlots.length - 1];
    const suggestedDuration = lastVisibleSlot
      ? Math.max(30, toMinutes(lastVisibleSlot.end) - toMinutes(lastVisibleSlot.start))
      : 60;
    const suggestedStartMinutes = lastVisibleSlot ? toMinutes(lastVisibleSlot.end) : toMinutes('10:00');
    const suggestedEndMinutes = suggestedStartMinutes + suggestedDuration;

    setSlotForm({
      startTime: toTimeText(suggestedStartMinutes),
      endTime: toTimeText(suggestedEndMinutes)
    });
    setEditingSlotKey(null);
    setError('');
    setIsSlotModalOpen(true);
  }

  function openEditSlotModal(startTime: string, endTime: string) {
    setSlotForm({ startTime: formatTime(startTime), endTime: formatTime(endTime) });
    setEditingSlotKey(`${formatTime(startTime)}-${formatTime(endTime)}`);
    setError('');
    setIsSlotModalOpen(true);
  }

  function updateSlotDuration(durationMinutes: number) {
    setSlotForm((prev) => ({
      ...prev,
      endTime: toTimeText(toMinutes(prev.startTime) + durationMinutes)
    }));
  }

  function openDeleteSlot(slotStart: string, slotEnd: string) {
    setEditingSlotKey(`${formatTime(slotStart)}-${formatTime(slotEnd)}`);
    setError('');
    handleDeleteSlot(`${formatTime(slotStart)}-${formatTime(slotEnd)}`);
  }

  function openCreateModalForSlot(dayOfWeek: TimetableFormEntry['dayOfWeek'], startTime: string, endTime: string) {
    setEditingEntry(null);
    setFormState({
      ...emptyForm,
      faculty: departmentFaculty[0]?.name ?? '',
      resourceId: filteredResourceOptions[0]?.id ?? 0,
      dayOfWeek,
      ...resolveSlotRange(timeSlots, startTime, emptyForm.duration)
    });
    setIsModalOpen(true);
  }

  function openEditModal(entry: TimetableEntry) {
    setEditingEntry(entry);
    setFormState({
      course: entry.courseCode,
      academicLevel: entry.academicLevel,
      sectionCode: entry.sectionCode,
      faculty: entry.facultyName,
      resourceId: entry.classroomId ?? entry.laboratoryId ?? 0,
      resourceType: entry.classroomId ? 'CLASSROOM' : 'LAB',
      type: entry.type,
      duration: entry.duration,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime.slice(0, 5),
      endTime: entry.endTime.slice(0, 5)
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setError('');
      if (!formState.course.trim()) {
        throw new Error('Course is required');
      }
      if (!formState.faculty.trim()) {
        throw new Error('Select a faculty member before creating the timetable entry');
      }
      if (!formState.resourceId || formState.resourceId <= 0) {
        throw new Error(`Select a ${formState.resourceType === 'LAB' ? 'lab' : 'classroom'} before creating the timetable entry`);
      }
      if (availableStartSlots.length === 0) {
        throw new Error('No continuous slot range is available for the selected duration');
      }
      if (toMinutes(formState.startTime) >= toMinutes(formState.endTime)) {
        throw new Error('Start time must be before end time');
      }
      if (editingEntry) {
        await updateManagedTimetableEntry(editingEntry.id, formState);
      } else {
        await createManagedTimetableEntry(formState);
      }
      setIsModalOpen(false);
      setEditingEntry(null);
      await loadTimetable();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save timetable entry');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setBulkUploading(true);
      const result = await bulkUploadTimetableEntries(file);
      alert(`Success: ${result.successCount} classes added. ${result.errors.length} errors.`);
      if (result.errors.length > 0) {
        console.table(result.errors);
      }
      await loadTimetable();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
      if (bulkUploadInputRef.current) {
        bulkUploadInputRef.current.value = '';
      }
    }
  }

  async function handleTemplateDownload() {
    try {
      setTemplateDownloading(true);
      await downloadTimetableTemplate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Template download failed');
    } finally {
      setTemplateDownloading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      setError('');
      await deleteManagedTimetableEntry(id);
      await loadTimetable();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete timetable entry');
    }
  }

  async function handleResetTimetable() {
    const scopeLabel = isDepartmentScoped
      ? `the ${activeDepartment?.name ?? 'current'} department`
      : 'all departments';
    const confirmed = window.confirm(
      `This will permanently delete all timetable classes for ${scopeLabel}. Do you want to continue?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setResettingTimetable(true);
      setError('');
      const result = await clearOperationalData('TIMETABLE');
      const deletedCount = result.deletedCounts.timetableEntries ?? 0;
      await loadTimetable();
      alert(`Timetable reset complete. Deleted ${deletedCount} class entries.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset timetable');
    } finally {
      setResettingTimetable(false);
    }
  }

  function toggleMergeSelection(slotKey: string) {
    setError('');
    setMergeSelectionKey((current) => (current === slotKey ? null : slotKey));
  }

  function handleMergeSlotGroup(targetSlotKey: string) {
    if (!mergeSelectionKey || mergeSelectionKey === targetSlotKey) {
      setError('Select one slot, then choose an adjacent slot to merge with it.');
      return;
    }

    const orderedKeys = timeSlots.map((slot) => `${slot.start}-${slot.end}`);
    const firstIndex = orderedKeys.indexOf(mergeSelectionKey);
    const secondIndex = orderedKeys.indexOf(targetSlotKey);

    if (firstIndex < 0 || secondIndex < 0) {
      setError('Selected slots could not be found.');
      return;
    }

    const startIndex = Math.min(firstIndex, secondIndex);
    const endIndex = Math.max(firstIndex, secondIndex);
    const proposedGroup = orderedKeys.slice(startIndex, endIndex + 1);

    const overlapsExistingGroup = normalizedMergedSlotGroups.some((group) =>
      group.some((key) => proposedGroup.includes(key))
    );
    if (overlapsExistingGroup) {
      setError('Unmerge the existing merged slot first before creating a new merge range.');
      return;
    }

    setMergedSlotGroups((current) => [...current, proposedGroup]);
    setMergeSelectionKey(null);
    setError('');
  }

  function handleUnmergeSlotGroup(groupKey: string) {
    setMergedSlotGroups((current) => current.filter((group) => group.join('|') !== groupKey));
    setMergeSelectionKey(null);
    setError('');
  }

  function handleAddSection() {
    const normalized = newSectionCode.trim().toUpperCase();
    const prefix = sectionPrefixForLevel(formState.academicLevel);

    if (!normalized) {
      setError('Enter a section code to add.');
      return;
    }

    if (!new RegExp(`^${prefix}[0-9]+$`).test(normalized)) {
      setError(`Section for ${formState.academicLevel} must look like ${prefix}1, ${prefix}2, etc.`);
      return;
    }

    if (sectionOptions.includes(normalized)) {
      setFormState((prev) => ({ ...prev, sectionCode: normalized }));
      setNewSectionCode('');
      setError('');
      return;
    }

    const updatedSections = {
      ...customSections,
      [formState.academicLevel]: [...customSections[formState.academicLevel], normalized]
        .sort((first, second) => first.localeCompare(second, undefined, { numeric: true }))
    };

    setCustomSections(updatedSections);
    localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(updatedSections));
    setFormState((prev) => ({ ...prev, sectionCode: normalized }));
    setNewSectionCode('');
    setError('');
  }

  async function handleAddSlot(event: FormEvent) {
    event.preventDefault();
    setError('');

    const start = formatTime(slotForm.startTime);
    const end = formatTime(slotForm.endTime);
    const nextSlotKey = `${start}-${end}`;

    if (toMinutes(start) >= toMinutes(end)) {
      setError('Slot start time must be before end time.');
      return;
    }

    const isHiddenExistingSlot = hiddenSlotKeys.includes(nextSlotKey);
    const exists = !isHiddenExistingSlot && (customSlots.some((slot) => {
      const slotKey = `${formatTime(slot.start)}-${formatTime(slot.end)}`;
      return slotKey !== editingSlotKey && formatTime(slot.start) === start && formatTime(slot.end) === end;
    }) || timeSlots.some((slot) => {
      const currentKey = `${formatTime(slot.start)}-${formatTime(slot.end)}`;
      return currentKey !== editingSlotKey && formatTime(slot.start) === start && formatTime(slot.end) === end;
    }));

    if (exists) {
      setError('That slot already exists.');
      return;
    }

    const affectedEntries = editingSlotKey
      ? entries.filter((entry) => {
        const [oldStart, oldEnd] = editingSlotKey.split('-');
        return formatTime(entry.startTime) === oldStart && formatTime(entry.endTime) === oldEnd;
      })
      : [];

    const multiSlotOverlap = editingSlotKey
      ? entries.some((entry) => {
        if (entry.duration <= 1) {
          return false;
        }
        const [oldStart, oldEnd] = editingSlotKey.split('-');
        const oldStartMinutes = toMinutes(oldStart);
        const oldEndMinutes = toMinutes(oldEnd);
        const entryStartMinutes = toMinutes(entry.startTime);
        const entryEndMinutes = toMinutes(entry.endTime);
        return entryStartMinutes < oldEndMinutes && entryEndMinutes > oldStartMinutes;
      })
      : false;

    if (multiSlotOverlap) {
      setError('This slot belongs to a merged lab block. Edit the lab entry instead of changing the slot column.');
      return;
    }

    const baseSlots = (customSlots.length > 0 ? customSlots : timeSlots.map((slot) => ({
      start: formatTime(slot.start),
      end: formatTime(slot.end)
    }))).map((slot) => ({
      start: formatTime(slot.start),
      end: formatTime(slot.end)
    }));

    const updatedSlots = editingSlotKey
      ? baseSlots
        .map((slot) => {
          const currentKey = `${formatTime(slot.start)}-${formatTime(slot.end)}`;
          return currentKey === editingSlotKey ? { start, end } : { start: formatTime(slot.start), end: formatTime(slot.end) };
        })
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
      : [...baseSlots, { start, end }]
        .filter((slot, index, source) =>
          source.findIndex((candidate) => candidate.start === slot.start && candidate.end === slot.end) === index
        )
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    try {
      if (editingSlotKey && affectedEntries.length > 0) {
        await Promise.all(
          affectedEntries.map((entry) =>
            updateManagedTimetableEntry(entry.id, {
              course: entry.courseCode,
              academicLevel: entry.academicLevel,
              sectionCode: entry.sectionCode,
              faculty: entry.facultyName,
              resourceId: entry.classroomId ?? entry.laboratoryId ?? 0,
              resourceType: entry.classroomId ? 'CLASSROOM' : 'LAB',
              type: entry.type,
              duration: entry.duration,
              dayOfWeek: entry.dayOfWeek,
              startTime: start,
              endTime: end
            })
          )
        );
      }

      setCustomSlots(updatedSlots);
      localStorage.setItem(SLOT_STORAGE_KEY, JSON.stringify(updatedSlots));

      const nextHiddenSlotKeys = hiddenSlotKeys.filter((key) => key !== nextSlotKey && key !== editingSlotKey);
      setHiddenSlotKeys(nextHiddenSlotKeys);
      localStorage.setItem(SLOT_HIDDEN_STORAGE_KEY, JSON.stringify(nextHiddenSlotKeys));

      if (editingSlotKey) {
        const replacementKey = `${start}-${end}`;
        const nextMergedGroups = mergedSlotGroups.map((group) =>
          group.map((key) => (key === editingSlotKey ? replacementKey : key))
        );
        setMergedSlotGroups(nextMergedGroups);
        localStorage.setItem(SLOT_MERGE_STORAGE_KEY, JSON.stringify(nextMergedGroups));
      }

      setIsSlotModalOpen(false);
      setEditingSlotKey(null);
      await loadTimetable();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update slot');
    }
  }

  function handleDeleteSlot(slotKeyOverride?: string) {
    const targetSlotKey = slotKeyOverride ?? editingSlotKey;
    if (!targetSlotKey) {
      return;
    }

    const [slotStart, slotEnd] = targetSlotKey.split('-');
    const hasExactEntries = entries.some((entry) =>
      formatTime(entry.startTime) === slotStart && formatTime(entry.endTime) === slotEnd
    );

    if (hasExactEntries) {
      setError('This slot is used by timetable entries. Delete or move those entries first.');
      return;
    }

    const isInsideMergedLab = entries.some((entry) => {
      if (entry.duration <= 1) {
        return false;
      }
      const slotStartMinutes = toMinutes(slotStart);
      const slotEndMinutes = toMinutes(slotEnd);
      const entryStartMinutes = toMinutes(entry.startTime);
      const entryEndMinutes = toMinutes(entry.endTime);
      return entryStartMinutes < slotEndMinutes && entryEndMinutes > slotStartMinutes;
    });

    if (isInsideMergedLab) {
      setError('This slot is part of a merged lab block. Edit the lab entry instead.');
      return;
    }

    const baseSlots = (customSlots.length > 0 ? customSlots : timeSlots.map((slot) => ({
      start: formatTime(slot.start),
      end: formatTime(slot.end)
    }))).map((slot) => ({
      start: formatTime(slot.start),
      end: formatTime(slot.end)
    }));

    const updatedSlots = baseSlots
      .filter((slot) => `${formatTime(slot.start)}-${formatTime(slot.end)}` !== targetSlotKey)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    const updatedMergedGroups = mergedSlotGroups
      .map((group) => group.filter((key) => key !== targetSlotKey))
      .filter((group) => group.length > 1);
    const updatedHiddenSlotKeys = [...hiddenSlotKeys, targetSlotKey]
      .filter((key, index, source) => source.indexOf(key) === index);

    setCustomSlots(updatedSlots);
    localStorage.setItem(SLOT_STORAGE_KEY, JSON.stringify(updatedSlots));
    setMergedSlotGroups(updatedMergedGroups);
    localStorage.setItem(SLOT_MERGE_STORAGE_KEY, JSON.stringify(updatedMergedGroups));
    setHiddenSlotKeys(updatedHiddenSlotKeys);
    localStorage.setItem(SLOT_HIDDEN_STORAGE_KEY, JSON.stringify(updatedHiddenSlotKeys));
    setIsSlotModalOpen(false);
    setEditingSlotKey(null);
    setError('');
  }

  const slotIndexMap = useMemo(
    () => new Map(timeSlots.map((slot, index) => [formatTime(slot.start), index])),
    [timeSlots]
  );

  const dayLaneLayouts = useMemo(() => {
    const layouts = new Map<string, Array<Array<TimetableEntry & { startIndex: number; span: number }>>>();

    dayOrder.forEach((day) => {
      const dayEntries = visibleEntries
        .filter((entry) => entry.dayOfWeek === day)
        .map((entry) => {
          const startIndex = slotIndexMap.get(formatTime(entry.startTime));
          if (startIndex == null) {
            return null;
          }

          const spanSlots = timeSlots.slice(startIndex, startIndex + Math.max(1, entry.duration));
          if (spanSlots.length < Math.max(1, entry.duration)) {
            return null;
          }

          const isContinuous = spanSlots.every((slot, index, slots) =>
            index === 0 || formatTime(slots[index - 1].end) === formatTime(slot.start)
          );
          if (!isContinuous) {
            return null;
          }

          const expectedEndTime = formatTime(spanSlots[spanSlots.length - 1].end);
          if (formatTime(entry.endTime) !== expectedEndTime) {
            return null;
          }

          return {
            ...entry,
            startIndex,
            span: Math.max(1, entry.duration)
          };
        })
        .filter((entry): entry is TimetableEntry & { startIndex: number; span: number } => Boolean(entry))
        .sort((first, second) => first.startIndex - second.startIndex || second.span - first.span || first.courseCode.localeCompare(second.courseCode));

      const lanes: Array<Array<TimetableEntry & { startIndex: number; span: number }>> = [];

      dayEntries.forEach((entry) => {
        const entryEnd = entry.startIndex + entry.span;
        const laneIndex = lanes.findIndex((lane) =>
          lane.every((placed) => {
            const placedEnd = placed.startIndex + placed.span;
            return entry.startIndex >= placedEnd || entryEnd <= placed.startIndex;
          })
        );

        if (laneIndex === -1) {
          lanes.push([entry]);
        } else {
          lanes[laneIndex].push(entry);
        }
      });

      layouts.set(day, lanes);
    });

    return layouts;
  }, [slotIndexMap, timeSlots, visibleEntries]);

  function resourceLabel(entry: TimetableEntry) {
    const resourceId = entry.classroomId ?? entry.laboratoryId;
    const resource = scheduleResources.find((item) => item.id === resourceId);
    return resource ? resource.name : 'Unassigned';
  }

  function departmentLabel(entry: TimetableEntry) {
    const department = departments.find((item) => item.id === entry.departmentId);
    return department ? `${department.code} · ${department.name}` : `Department #${entry.departmentId}`;
  }

  return (
    <div className="min-w-0 space-y-6 fade-up">
      <SectionCard title="Timetable Management" subtitle="Create, edit, and remove schedule entries with conflict detection">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Weekly grid view for timetable operations. Conflicts are checked when entries are created or updated.
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap justify-end gap-2">
              <input
                ref={bulkUploadInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleBulkUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleTemplateDownload}
                disabled={templateDownloading || bulkUploading || resettingTimetable}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download size={16} />
                {templateDownloading ? 'Downloading...' : 'Download Excel Template'}
              </button>
              <button
                type="button"
                onClick={() => bulkUploadInputRef.current?.click()}
                disabled={templateDownloading || bulkUploading || resettingTimetable}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              >
                <Upload size={16} />
                {bulkUploading ? 'Uploading...' : 'Bulk Upload Classes'}
              </button>
              <button
                type="button"
                onClick={openSlotModal}
                disabled={resettingTimetable}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/60 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
              >
                <Plus size={16} />
                Add Slot
              </button>
              <button
                type="button"
                onClick={handleResetTimetable}
                disabled={resettingTimetable || templateDownloading || bulkUploading || submitting}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                <Trash2 size={16} />
                {resettingTimetable ? 'Resetting...' : 'Reset Timetable'}
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                disabled={resettingTimetable}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                <Plus size={16} />
                Add Timetable Entry
              </button>
            </div>
          ) : null}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {isDepartmentScoped ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Department
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {activeDepartment?.code} - {activeDepartment?.name}
              </span>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Department
              <select
                value={activeDepartmentFilter ?? ''}
                onChange={(event) => {
                  setActiveDepartmentFilter(event.target.value ? Number(event.target.value) : null);
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.code} - {department.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
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
              {level === 'ALL' ? 'Master Timetable' : level}
            </button>
          ))}
        </div>

        {activeFacultyFilter && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              Faculty Filter
              <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
                {activeFacultyFilter}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveFacultyFilter(null);
                setSearchParams({});
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold lowercase text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Clear filter
            </button>
          </div>
        )}

        <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          {activeFacultyFilter
            ? `${activeFacultyFilter}'s timetable view.`
            : activeDepartment
              ? `${activeDepartment.name} timetable view.`
              : 'Department timetable view.'}
          {' '}
          {activeAcademicLevel === 'ALL'
            ? 'Showing FE, SE, TE, and BE together in one table.'
            : `Showing ${activeAcademicLevel} only.`}
        </p>

        {canManage ? (
          <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex flex-wrap items-start gap-3">
              <FileSpreadsheet className="mt-0.5 text-emerald-600 dark:text-emerald-300" size={20} />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">Bulk class upload is ready</p>
                <p className="text-emerald-800/80 dark:text-emerald-100/80">
                  Download the Excel template, fill only the rows under the headers in the <span className="font-semibold">Classes</span> sheet, then upload the same file here.
                </p>
                <p className="text-emerald-800/80 dark:text-emerald-100/80">
                  The template also includes a <span className="font-semibold">Reference</span> sheet with faculty names, HOD names, resource IDs, and allowed values.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-4 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/75 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/45">
          <div className="overflow-x-auto overscroll-x-contain pb-2">
            <div className="min-w-[1180px]">
              <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-100/90 px-4 py-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-500 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                  Day
                </div>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, timeSlots.length)}, minmax(${SLOT_COLUMN_MIN_WIDTH}px, 1fr))` }}
                >
                  {timeSlots.map((slot) => (
                    <div
                      key={slotKey(slot.start, slot.end)}
                      className="rounded-2xl border border-slate-200/80 bg-slate-100/90 px-3 py-4 text-center dark:border-slate-700 dark:bg-slate-800/90"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Slot</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-100">
                        {formatDisplayTime(slot.start)} - {formatDisplayTime(slot.end)}
                      </p>
                      {canManage ? (
                        <div className="mt-3 flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => openEditSlotModal(slot.start, slot.end)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Pencil size={11} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteSlot(slot.start, slot.end)}
                            className="mt-2 inline-flex items-center gap-1 rounded-full border border-rose-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {dayOrder.map((day) => {
                  const lanes = dayLaneLayouts.get(day) ?? [];

                  return (
                    <div key={day} className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)]">
                      <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-lg font-bold tracking-wide">{dayLabel(day)}</p>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{day}</p>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => openCreateModalForSlot(day, timeSlots[0]?.start ?? '09:00', timeSlots[0]?.end ?? '10:00')}
                            className="mt-4 inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-900/50 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-950/70"
                          >
                            <Plus size={12} />
                            Add
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                        <div
                          className="grid gap-2"
                          style={{ gridTemplateColumns: `repeat(${Math.max(1, timeSlots.length)}, minmax(${SLOT_COLUMN_MIN_WIDTH}px, 1fr))` }}
                        >
                          {timeSlots.map((slot) => (
                            <div
                              key={`${day}-${slotKey(slot.start, slot.end)}-ghost`}
                              className="min-h-[52px] rounded-xl border border-dashed border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/50"
                            />
                          ))}
                        </div>

                        {lanes.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                            No entries scheduled for {day}.
                          </div>
                        ) : (
                          lanes.map((lane, laneIndex) => (
                            <div
                              key={`${day}-lane-${laneIndex}`}
                              className="grid min-w-0 gap-1.5"
                              style={{ gridTemplateColumns: `repeat(${Math.max(1, timeSlots.length)}, minmax(${SLOT_COLUMN_MIN_WIDTH}px, 1fr))` }}
                            >
                              {lane.map((entry) => {
                                const hasConflict = conflicts.some(
                                  (conflict) => conflict.entryAId === entry.id || conflict.entryBId === entry.id
                                );

                                return (
                                  <article
                                    key={entry.id}
                                    style={{ gridColumn: `${entry.startIndex + 1} / span ${entry.span}` }}
                                    className={`min-w-0 overflow-hidden rounded-xl border px-2.5 py-2 shadow-sm transition ${cardTone(entry.type, entry.generatedByAi, hasConflict)}`}
                                  >
                                    <div className="flex min-w-0 items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="break-words text-[12px] font-extrabold uppercase leading-tight">
                                          {compactEntryCode(entry)}
                                        </p>
                                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                          {formatDisplayTime(entry.startTime)} - {formatDisplayTime(entry.endTime)}
                                        </p>
                                      </div>
                                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                        <Badge label={entry.type === 'LAB' ? `${entry.duration}H` : 'LEC'} tone={entry.type === 'LAB' ? 'warning' : 'neutral'} />
                                        <Badge label={entry.generatedByAi ? 'AI' : 'M'} tone={entry.generatedByAi ? 'success' : 'neutral'} />
                                      </div>
                                    </div>

                                    <div className="mt-2 min-w-0 space-y-1 text-[11px] leading-snug">
                                      <p className="break-words font-semibold text-slate-900 dark:text-slate-100">
                                        {entry.type === 'LECTURE' ? facultyShortLabel(entry.facultyName) : entry.facultyName}
                                      </p>
                                      <p className="break-words text-slate-600 dark:text-slate-300">
                                        {entry.resourceName || resourceLabel(entry)}
                                      </p>
                                      <p className="break-words text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                        {departmentLabel(entry)}
                                      </p>
                                    </div>

                                    {canManage ? (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => openEditModal(entry)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                          <Pencil size={12} />
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDelete(entry.id)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-300 dark:hover:bg-rose-900/20"
                                        >
                                          <Trash2 size={12} />
                                          Delete
                                        </button>
                                      </div>
                                    ) : null}
                                  </article>
                                );
                              })}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Conflict Warnings" subtitle="Detected clashes and double bookings">
        {conflicts.length === 0 ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-300">No conflicts detected in current schedule.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {conflicts
              .filter((conflict) => {
                if (activeAcademicLevel === 'ALL') {
                  return true;
                }
                const relatedEntries = visibleEntries.filter((entry) => entry.id === conflict.entryAId || entry.id === conflict.entryBId);
                return relatedEntries.length > 0;
              })
              .map((conflict) => (
                <li key={`${conflict.entryAId}-${conflict.entryBId}`} className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/20">
                  <AlertTriangle className="mt-0.5 text-red-600 dark:text-red-300" size={18} />
                  <div>
                    <p className="font-semibold text-red-700 dark:text-red-300">{conflict.conflictType}</p>
                    <p className="text-red-600 dark:text-red-200">{conflict.reason}</p>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold">{editingEntry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Manage course allocation with room and lab selection.</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span>Course</span>
                <input
                  value={formState.course}
                  onChange={(event) => setFormState((prev) => ({ ...prev, course: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>Academic level</span>
                <select
                  value={formState.academicLevel}
                  onChange={(event) => {
                    const academicLevel = event.target.value as TimetableFormEntry['academicLevel'];
                    setFormState((prev) => ({
                      ...prev,
                      academicLevel,
                      sectionCode: editingEntry && prev.academicLevel === academicLevel
                        ? prev.sectionCode
                        : prev.type === 'LECTURE'
                          ? defaultSectionForLevel(academicLevel)
                          : defaultSectionForLevel(academicLevel)
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                >
                  {academicLevels.filter((level) => level !== 'ALL').map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>Section</span>
                <div className="space-y-2">
                  <select
                    value={formState.sectionCode}
                    onChange={(event) => setFormState((prev) => ({ ...prev, sectionCode: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {sectionOptions.map((section) => (
                      <option key={section} value={section}>
                        {formatSectionCodeLabel(section, formState.type)}
                      </option>
                    ))}
                  </select>
                  {formState.type === 'LAB' ? (
                    <div className="flex gap-2">
                      <input
                        value={newSectionCode}
                        onChange={(event) => setNewSectionCode(event.target.value.toUpperCase())}
                        placeholder={`Add ${sectionPrefixForLevel(formState.academicLevel)}4`}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={handleAddSection}
                        className="rounded-xl border border-cyan-300 px-4 py-3 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-900/60 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Lecture entries apply to all sections in the selected academic level.
                    </p>
                  )}
                </div>
              </label>
              <label className="space-y-2 text-sm">
                <span>Faculty</span>
                <select
                  value={formState.faculty}
                  onChange={(event) => setFormState((prev) => ({ ...prev, faculty: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                  disabled={departmentFaculty.length === 0}
                >
                  {departmentFaculty.length === 0 ? (
                    <option value="">
                      {activeDepartment
                        ? `No faculty available for ${activeDepartment.code} - ${activeDepartment.name}`
                        : 'No faculty available for this department'}
                    </option>
                  ) : (
                    departmentFaculty.map((member) => (
                      <option key={member.id} value={member.name}>
                        {facultyOptionLabel(member.name)}
                      </option>
                    ))
                  )}
                </select>
                {departmentFaculty.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    {activeDepartment
                      ? `Faculty are loaded only from the selected department. Switch the department filter to the one where you created faculty, like IT if they were added there.`
                      : 'Select a department that has faculty assigned.'}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Faculty short codes are shown in brackets, like WDP, RPP, and SAK.
                  </p>
                )}
              </label>
              <label className="space-y-2 text-sm">
                <span>Entry type</span>
                <select
                  value={formState.type}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      type: event.target.value as TimetableFormEntry['type'],
                      resourceId: 0
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="LECTURE">Lecture</option>
                  <option value="LAB">Lab</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>Duration</span>
                <select
                  value={formState.duration}
                  onChange={(event) => {
                    const duration = Number(event.target.value);
                    setFormState((prev) => ({
                      ...prev,
                      duration,
                      ...resolveSlotRange(timeSlots, prev.startTime, duration)
                    }));
                  }}
                  disabled={formState.type === 'LECTURE'}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800"
                >
                  {formState.type === 'LECTURE' ? (
                    <option value={1}>1 slot</option>
                  ) : (
                    [1, 2, 3, 4].map((duration) => (
                      <option key={duration} value={duration}>
                        {duration} slots
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>{formState.resourceType === 'LAB' ? 'Lab' : 'Classroom'}</span>
                <select
                  value={formState.resourceId || ''}
                  onChange={(event) => setFormState((prev) => ({ ...prev, resourceId: Number(event.target.value) }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Select resource</option>
                  {filteredResourceOptions.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
                {filteredResourceOptions.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    No {formState.resourceType === 'LAB' ? 'labs' : 'classrooms'} are available for the selected department.
                  </p>
                ) : null}
              </label>
              <label className="space-y-2 text-sm">
                <span>Day</span>
                <select
                  value={formState.dayOfWeek}
                  onChange={(event) => setFormState((prev) => ({ ...prev, dayOfWeek: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                >
                  {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>Start slot</span>
                <select
                  value={formState.startTime}
                  onChange={(event) => {
                    const startTime = event.target.value;
                    setFormState((prev) => ({
                      ...prev,
                      ...resolveSlotRange(timeSlots, startTime, prev.duration)
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                >
                  {availableStartSlots.map((slot) => (
                    <option key={slotKey(slot.start, slot.end)} value={formatTime(slot.start)}>
                      {formatDisplayTime(slot.start)} - {formatDisplayTime(slot.end)}
                    </option>
                  ))}
                </select>
                {availableStartSlots.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    No continuous slot range is available for the selected duration.
                  </p>
                ) : null}
              </label>
              <label className="space-y-2 text-sm">
                <span>End time</span>
                <input
                  type="time"
                  value={formState.endTime}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 outline-none dark:border-slate-700 dark:bg-slate-800"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatEntryKindLabel(formState.type, formState.duration)} will occupy consecutive timetable slots.
                </p>
              </label>
              <div className="flex gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-70"
                >
                  {submitting ? 'Saving...' : editingEntry ? 'Update Entry' : 'Create Entry'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isSlotModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold">{editingSlotKey ? 'Edit Slot' : 'Add Slot'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {editingSlotKey ? 'Update this timetable time column.' : 'Create a new timetable time column.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSlotModalOpen(false);
                  setError('');
                }}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddSlot} className="mt-6 grid gap-4">
              {error ? (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </p>
              ) : null}
              <label className="space-y-2 text-sm">
                <span>Start time</span>
                <input
                  type="time"
                  value={slotForm.startTime}
                  onChange={(event) => setSlotForm((prev) => ({ ...prev, startTime: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{formatDisplayTime(slotForm.startTime)}</p>
              </label>
              <label className="space-y-2 text-sm">
                <span>Duration</span>
                <select
                  value={String(slotDurationInMinutes(slotForm.startTime, slotForm.endTime))}
                  onChange={(event) => updateSlotDuration(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span>End time</span>
                <input
                  type="time"
                  value={slotForm.endTime}
                  onChange={(event) => setSlotForm((prev) => ({ ...prev, endTime: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-800"
                />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{formatDisplayTime(slotForm.endTime)}</p>
              </label>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
                >
                  {editingSlotKey ? 'Update Slot' : 'Save Slot'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSlotModalOpen(false);
                    setError('');
                  }}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
