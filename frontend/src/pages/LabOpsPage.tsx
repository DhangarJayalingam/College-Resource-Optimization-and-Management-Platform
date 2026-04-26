import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { SectionCard } from '../components/SectionCard';
import { getCurrentUser, getDepartments, getFacilityBookings, getMaintenanceRecords, getResources } from '../services/api';
import type { Department } from '../services/api';
import type { FacilityBooking, MaintenanceItem, ResourceItem } from '../types';
import { getCurrentUserRoles } from '../utils/auth';

function toneForStatus(status: string) {
  if (status === 'AVAILABLE') return 'success' as const;
  if (status === 'BOOKED' || status === 'IN_USE' || status === 'APPROVED') return 'warning' as const;
  return 'danger' as const;
}

export function LabOpsPage() {
  const roles = getCurrentUserRoles();
  const isDepartmentScoped = roles.includes('COLLEGE_ADMIN') && !roles.includes('SUPER_ADMIN');
  const [labs, setLabs] = useState<ResourceItem[]>([]);
  const [equipment, setEquipment] = useState<ResourceItem[]>([]);
  const [bookings, setBookings] = useState<FacilityBooking[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadLabData() {
      try {
        const [resourceData, bookingData, maintenanceData, departmentData, currentUser] = await Promise.all([
          getResources(),
          getFacilityBookings(),
          getMaintenanceRecords(),
          getDepartments(),
          getCurrentUser()
        ]);

        const scopedDepartmentId = currentUser.departmentId;
        const visibleDepartments = isDepartmentScoped
          ? departmentData.filter((item) => item.id === scopedDepartmentId)
          : departmentData;
        const visibleDepartment = visibleDepartments.find((item) => item.id === scopedDepartmentId) ?? visibleDepartments[0] ?? null;
        const departmentResources = visibleDepartment
          ? resourceData.filter((resource) => resource.departmentId === visibleDepartment.id)
          : resourceData;

        setDepartment(visibleDepartment);
        setLabs(departmentResources.filter((resource) => resource.type === 'LAB'));
        setEquipment(departmentResources.filter((resource) => resource.type === 'EQUIPMENT'));
        setBookings(bookingData);
        setMaintenance(maintenanceData);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load laboratory data.');
      }
    }

    loadLabData();
  }, [isDepartmentScoped]);

  const labSlots = useMemo(() => labs.map((lab) => {
    const activeBooking = bookings.find((booking) => booking.resourceId === lab.id);
    const maintenanceRecord = maintenance.find((item) => item.resourceId === lab.id);

    return {
      id: lab.id,
      lab: lab.name,
      slot: activeBooking
        ? `${activeBooking.bookingDate} ${activeBooking.startTime.slice(0, 5)} - ${activeBooking.endTime.slice(0, 5)}`
        : 'No booking scheduled',
      status: maintenanceRecord?.status ?? activeBooking?.status ?? lab.status
    };
  }), [bookings, labs, maintenance]);

  const maintenanceRows = useMemo(() => maintenance.filter((item) =>
    equipment.some((asset) => asset.id === item.equipmentId) || labs.some((lab) => lab.id === item.resourceId)
  ), [equipment, labs, maintenance]);

  return (
    <div className="space-y-6 fade-up">
      <SectionCard
        title="Laboratory Availability Calendar"
        subtitle={department ? `${department.name} labs and maintenance windows` : 'Track booking windows and maintenance blocks'}
      >
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {labSlots.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No laboratories available in this department.</p>
            ) : labSlots.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-semibold">{item.lab}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.slot}</p>
                <div className="mt-2">
                  <Badge label={item.status} tone={toneForStatus(item.status)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Equipment Maintenance Tracker" subtitle="Monitor devices in your department labs">
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Issue</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Linked Resource</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceRows.length === 0 ? (
                <tr className="border-t border-slate-200 dark:border-slate-800">
                  <td colSpan={4} className="px-4 py-4 text-slate-500 dark:text-slate-400">
                    No maintenance records for this department.
                  </td>
                </tr>
              ) : maintenanceRows.map((item) => {
                const asset = equipment.find((entry) => entry.id === item.equipmentId);
                const linkedLab = labs.find((entry) => entry.id === item.resourceId)
                  ?? labs.find((entry) => entry.id === asset?.assignedLabId);

                return (
                  <tr key={item.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-3">{asset?.name ?? `Resource #${item.resourceId ?? item.equipmentId}`}</td>
                    <td className="px-4 py-3">{item.issueDescription}</td>
                    <td className="px-4 py-3"><Badge label={item.status} tone={toneForStatus(item.status)} /></td>
                    <td className="px-4 py-3">{linkedLab?.name ?? 'Not linked'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
