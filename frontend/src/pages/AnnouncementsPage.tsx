import { useState, useEffect, useRef } from 'react';
import { Badge } from '../components/Badge';
import { SectionCard } from '../components/SectionCard';
import { FileText, Image as ImageIcon, Download, Paperclip, X, Loader2 } from 'lucide-react';
import { getAnnouncements, createAnnouncement, uploadAnnouncementAttachment, getDepartments, Department, getCurrentUser, listUsers } from '../services/api';
import type { AppUser, DepartmentAnnouncement } from '../types';

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<DepartmentAnnouncement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; fileName: string; type: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [annData, deptData, profile, userData] = await Promise.all([
        getAnnouncements(),
        getDepartments(),
        getCurrentUser(),
        listUsers()
      ]);
      setAnnouncements(annData);
      setDepartments(deptData);
      setCurrentUserId(profile.id);
      setUsers(userData);
    } catch (error) {
      console.error('Failed to load announcements', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      const result = await uploadAnnouncementAttachment(file);
      setAttachment(result);
    } catch (error: any) {
      alert(error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish() {
    if (!title.trim() || !content.trim()) return;
    if (audience === 'SPECIFIC_USER' && !recipientEmail.trim()) {
      alert('Select a specific recipient email.');
      return;
    }
    if (!currentUserId) {
      alert('Current user profile is not available.');
      return;
    }

    try {
      const payload = {
        title,
        content,
        audience,
        departmentId: selectedDept ? parseInt(selectedDept) : null,
        createdByUserId: currentUserId,
        recipientEmail: audience === 'SPECIFIC_USER' ? recipientEmail.trim().toLowerCase() : null,
        attachmentUrl: attachment?.url,
        attachmentType: attachment?.type,
        fileName: attachment?.fileName
      };

      await createAnnouncement(payload);
      setTitle('');
      setContent('');
      setRecipientEmail('');
      setAttachment(null);
      loadData();
    } catch (error) {
      alert('Failed to publish announcement');
    }
  }

  return (
    <div className="space-y-6 fade-up">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Announcements Feed" subtitle="Latest campus and department updates">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-cyan-600" size={32} />
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((item) => (
                  <article key={item.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:bg-slate-50/50 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                        <div className="mt-1 flex gap-2">
                          <Badge label={item.audience} tone="neutral" />
                          {item.departmentId && (
                            <Badge
                              label={departments.find(d => d.id === item.departmentId)?.code || 'Dept'}
                              tone="neutral"
                            />
                          )}
                          {item.recipientEmail && <Badge label="Private" tone="warning" />}
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(item.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.content}</p>
                    {item.recipientEmail && (
                      <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-300">
                        Recipient: {item.recipientEmail} {item.emailDeliveryStatus ? ` - Email ${item.emailDeliveryStatus}` : ''}
                      </p>
                    )}

                    {item.attachmentUrl && (
                      <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                        <div className="flex items-center gap-3">
                          {item.attachmentType?.includes('image') ? (
                            <ImageIcon size={18} className="text-cyan-600" />
                          ) : (
                            <FileText size={18} className="text-rose-600" />
                          )}
                          <span className="text-sm font-medium truncate max-w-[200px]">{item.fileName}</span>
                        </div>
                        <a
                          href={`http://localhost:8080${item.attachmentUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:underline"
                        >
                          <Download size={14} />
                          Download
                        </a>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Publish New" subtitle="For Admin & Faculty use">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Exam Schedule Update"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Audience</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="ALL">All</option>
                    <option value="STUDENTS">Students</option>
                    <option value="FACULTY">Faculty</option>
                    <option value="SPECIFIC_USER">Specific User</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Department</label>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="">None (Global)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share details here..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              {audience === 'SPECIFIC_USER' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Recipient Email</label>
                  <input
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    list="announcement-user-emails"
                    placeholder="Select or type a user email"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <datalist id="announcement-user-emails">
                    {users.map((user) => (
                      <option key={user.id} value={user.email}>
                        {user.fullName}
                      </option>
                    ))}
                  </datalist>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    This announcement will be visible only to that user and admins, and will be emailed through Gmail if SMTP is configured.
                  </p>
                </div>
              )}

              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="*/*"
                />
                {!attachment ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-4 text-sm font-medium text-slate-500 transition hover:border-cyan-500 hover:bg-cyan-50/50 hover:text-cyan-600 dark:border-slate-800 dark:hover:bg-cyan-900/20"
                  >
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                    {uploading ? 'Uploading...' : 'Attach File'}
                  </button>
                ) : (
                  <div className="flex items-center justify-between rounded-xl bg-cyan-50 p-3 text-cyan-700 dark:bg-cyan-900/30">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={18} />
                      <span className="text-sm font-medium truncate">{attachment.fileName}</span>
                    </div>
                    <button onClick={() => setAttachment(null)} className="rounded-full p-1 hover:bg-cyan-100">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handlePublish}
                className="w-full rounded-xl bg-cyan-600 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 hover:shadow-cyan-500/30"
              >
                Publish Announcement
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
