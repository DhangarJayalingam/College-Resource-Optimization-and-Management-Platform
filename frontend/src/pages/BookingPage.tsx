import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bell, CalendarClock, Lightbulb, Send } from 'lucide-react';
import { Badge } from '../components/Badge';
import { SectionCard } from '../components/SectionCard';
import { getBookingNotifications, getBookingRecommendations, getResources, requestBooking } from '../services/api';
import type { BookingNotification, BookingRecommendation, ResourceItem } from '../types';
import { getCurrentUserRoles } from '../utils/auth';

export function BookingPage() {
  const roles = getCurrentUserRoles();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [recommendations, setRecommendations] = useState<BookingRecommendation[]>([]);
  const [notifications, setNotifications] = useState<BookingNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    resourceId: 0,
    resourceType: 'CLASSROOM' as 'CLASSROOM' | 'LAB' | 'EQUIPMENT',
    date: '',
    startTime: '10:00:00',
    endTime: '11:00:00',
    purpose: '',
    remarks: '',
    expectedCapacity: 30,
    recurring: false,
    recurringPattern: '',
    priorityOverride: false
  });

  useEffect(() => {
    Promise.all([getResources(), getBookingNotifications()])
      .then(([resourceData, notificationData]) => {
        setResources(resourceData);
        if (resourceData[0]) {
          setForm((current) => ({
            ...current,
            resourceId: resourceData[0].id,
            resourceType: resourceData[0].type
          }));
        }
        setNotifications(notificationData.slice(0, 4));
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredResources = useMemo(
    () => resources.filter((resource) => resource.type === form.resourceType),
    [resources, form.resourceType]
  );

  const selectedResource = useMemo(
    () => filteredResources.find((resource) => resource.id === form.resourceId) ?? null,
    [filteredResources, form.resourceId]
  );
  const canSubmitBooking = Boolean(selectedResource) && Boolean(form.date) && Boolean(form.purpose.trim());

  useEffect(() => {
    if (filteredResources[0] && !filteredResources.some((resource) => resource.id === form.resourceId)) {
      setForm((current) => ({ ...current, resourceId: filteredResources[0].id }));
    }
  }, [filteredResources, form.resourceId]);

  async function handleRecommend() {
    if (!selectedResource || !form.date) return;
    const result = await getBookingRecommendations({
      resourceType: form.resourceType,
      expectedCapacity: form.expectedCapacity,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime
    });
    setRecommendations(result);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedResource) {
      alert('Select a valid resource before submitting the booking.');
      return;
    }
    if (!form.date || !form.purpose.trim()) {
      alert('Choose a date and enter a purpose before submitting the booking.');
      return;
    }
    setSubmitting(true);
    try {
      await requestBooking(form);
      alert('Booking submitted successfully');
      setForm((current) => ({ ...current, purpose: '', remarks: '', recurringPattern: '' }));
      await handleRecommend();
    } catch (error: any) {
      alert(error.message || 'Booking request failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">Loading booking engine...</div>;
  }

  return (
    <div className="space-y-6 fade-up">
      <SectionCard title="Advanced Booking" subtitle="Enterprise workflow for classrooms, laboratories, and equipment">
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>Resource Type</span>
              <select value={form.resourceType} onChange={(event) => setForm((current) => ({ ...current, resourceType: event.target.value as typeof current.resourceType }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                <option value="CLASSROOM">Classroom</option>
                <option value="LAB">Laboratory</option>
                <option value="EQUIPMENT">Equipment</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>Resource</span>
              <select value={form.resourceId} onChange={(event) => {
                const resource = filteredResources.find((item) => item.id === Number(event.target.value));
                setForm((current) => ({ ...current, resourceId: Number(event.target.value), resourceType: resource?.type ?? current.resourceType }));
              }} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                {filteredResources.length === 0 ? (
                  <option value={0}>No resources available</option>
                ) : filteredResources.map((resource) => (
                  <option key={resource.id} value={resource.id}>{resource.name}</option>
                ))}
              </select>
              {selectedResource ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedResource.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {selectedResource.building} | Capacity {selectedResource.capacity} | {selectedResource.status.replace(/_/g, ' ')}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  No matching resources are available for the selected type.
                </div>
              )}
            </label>
            <label className="space-y-2 text-sm">
              <span>Date</span>
              <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Expected Capacity</span>
              <input type="number" value={form.expectedCapacity} onChange={(event) => setForm((current) => ({ ...current, expectedCapacity: Number(event.target.value) }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900" />
            </label>
            <label className="space-y-2 text-sm">
              <span>Start Time</span>
              <input type="time" value={form.startTime.slice(0, 5)} onChange={(event) => setForm((current) => ({ ...current, startTime: `${event.target.value}:00` }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900" />
            </label>
            <label className="space-y-2 text-sm">
              <span>End Time</span>
              <input type="time" value={form.endTime.slice(0, 5)} onChange={(event) => setForm((current) => ({ ...current, endTime: `${event.target.value}:00` }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900" />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Purpose</span>
              <input value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900" placeholder="Seminar, workshop, equipment reservation..." />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>Remarks</span>
              <textarea rows={3} value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900" />
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={form.recurring} onChange={(event) => setForm((current) => ({ ...current, recurring: event.target.checked }))} />
              Recurring booking
            </label>
            {form.recurring ? (
              <label className="space-y-2 text-sm">
                <span>Recurring Pattern</span>
                <input value={form.recurringPattern} onChange={(event) => setForm((current) => ({ ...current, recurringPattern: event.target.value }))} placeholder="Every Monday 10-11 for semester" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900" />
              </label>
            ) : null}
            {roles.includes('SUPER_ADMIN') ? (
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={form.priorityOverride} onChange={(event) => setForm((current) => ({ ...current, priorityOverride: event.target.checked }))} />
                Priority override
              </label>
            ) : null}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Lightbulb size={18} className="text-amber-500" />
              <p className="font-semibold">Smart Recommendations</p>
            </div>
            <button type="button" onClick={handleRecommend} disabled={!selectedResource || !form.date} className="w-full rounded-xl border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-700 disabled:opacity-60 dark:border-amber-900/40 dark:text-amber-300">
              Find Best Alternatives
            </button>
            <div className="space-y-3">
              {recommendations.map((item) => (
                <article key={`${item.resourceId}-${item.suggestedStartTime}`} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{item.resourceName}</p>
                    <Badge label={item.resourceType} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.building}</p>
                  <p className="mt-2 text-sm">{item.reason}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.suggestedStartTime} - {item.suggestedEndTime}</p>
                </article>
              ))}
            </div>
            <button type="submit" disabled={submitting || !canSubmitBooking} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              <Send size={16} />
              {submitting ? 'Submitting...' : 'Submit Booking'}
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Workflow Rules" subtitle="Validation, approval, and priority rules currently active">
          <div className="space-y-3 text-sm">
            <p>`STUDENT` users are limited to 2 bookings per day.</p>
            <p>Lab and equipment bookings route through final resource-manager approval.</p>
            <p>Admins can create higher-priority requests. Superadmin can use override priority.</p>
            <p>Approved bookings auto-transition to `IN_PROGRESS` and `COMPLETED` based on time.</p>
          </div>
        </SectionCard>

        <SectionCard title="Notifications" subtitle="Real-time booking events and policy reminders">
          <div className="space-y-3">
            {notifications.map((notification) => (
              <article key={notification.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-cyan-600" />
                  <p className="font-semibold">{notification.title}</p>
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{notification.message}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <CalendarClock size={12} className="mr-1 inline" />
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
