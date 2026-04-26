import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '../components/Badge';
import { SectionCard } from '../components/SectionCard';
import { approveBooking, getPendingBookingApprovals, rejectBooking } from '../services/api';
import type { BookingItem } from '../types';

export function BookingApprovalPage() {
  const [items, setItems] = useState<BookingItem[]>([]);

  async function load() {
    const data = await getPendingBookingApprovals();
    setItems(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: number) {
    await approveBooking(id, 'Approved from approval dashboard');
    await load();
  }

  async function handleReject(id: number) {
    await rejectBooking(id, 'Rejected from approval dashboard');
    await load();
  }

  return (
    <SectionCard title="Approval Dashboard" subtitle="Review pending booking workflow items">
      <div className="space-y-4">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{item.resourceName}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.userName} · {item.date} · {item.startTime.slice(0, 5)} - {item.endTime.slice(0, 5)}</p>
                <p className="mt-2 text-sm">{item.purpose}</p>
              </div>
              <div className="flex gap-2">
                <Badge label={item.currentApprovalStage} tone="warning" />
                <Badge label={item.priority} />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => handleApprove(item.id)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                <CheckCircle2 size={16} />
                Approve
              </button>
              <button onClick={() => handleReject(item.id)} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
                <XCircle size={16} />
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
