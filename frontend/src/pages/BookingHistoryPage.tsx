import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { Badge } from '../components/Badge';
import { SectionCard } from '../components/SectionCard';
import { cancelBooking, getBookingAnalytics, getBookingHistory } from '../services/api';
import type { BookingAnalytics, BookingItem } from '../types';

export function BookingHistoryPage() {
  const [items, setItems] = useState<BookingItem[]>([]);
  const [analytics, setAnalytics] = useState<BookingAnalytics | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');

  async function load() {
    const [historyData, analyticsData] = await Promise.all([getBookingHistory(), getBookingAnalytics().catch(() => null)]);
    setItems(historyData);
    setAnalytics(analyticsData);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => statusFilter === 'ALL' ? items : items.filter((item) => item.status === statusFilter),
    [items, statusFilter]
  );

  async function handleCancel(id: number) {
    await cancelBooking(id, 'Cancelled from booking history');
    await load();
  }

  return (
    <div className="space-y-6 fade-up">
      <SectionCard title="Booking History" subtitle="Track requests, approvals, completions, and cancellations">
        <div className="mb-4 flex gap-2">
          {['ALL', 'PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'].map((status) => (
            <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${statusFilter === status ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
              {status}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{item.resourceName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{item.date} · {item.startTime.slice(0, 5)} - {item.endTime.slice(0, 5)} · {item.userName}</p>
                  <p className="mt-2 text-sm">{item.purpose}</p>
                </div>
                <div className="flex gap-2">
                  <Badge label={item.status} tone={item.status === 'APPROVED' || item.status === 'COMPLETED' ? 'success' : item.status === 'PENDING' ? 'warning' : item.status === 'REJECTED' || item.status === 'CANCELLED' ? 'danger' : 'neutral'} />
                  <Badge label={item.currentApprovalStage} />
                </div>
              </div>
              {item.status === 'PENDING' || item.status === 'APPROVED' ? (
                <button onClick={() => handleCancel(item.id)} className="mt-4 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 dark:border-rose-900/40 dark:text-rose-300">
                  Cancel Booking
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </SectionCard>

      {analytics ? (
        <SectionCard title="Booking Analytics" subtitle="Usage, peak hours, and trends">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Totals</p>
              <p className="mt-3 text-3xl font-bold">{analytics.totalBookings}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge label={`Pending ${analytics.pendingBookings}`} tone="warning" />
                <Badge label={`Approved ${analytics.approvedBookings}`} tone="success" />
                <Badge label={`Completed ${analytics.completedBookings}`} />
              </div>
            </div>
            <div className="lg:col-span-2 h-72 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.bookingTrends}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={false} />
                  <Bar dataKey="count" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
