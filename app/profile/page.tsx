'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Briefcase,
  ArrowRight,
  LogOut,
  Edit2,
  Save,
  X,
  Building2,
  MapPin,
  Phone,
  User as UserIcon,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoading, PageError } from '@/components/page-loading';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuthFetch } from '@/hooks/use-auth-fetch';
import { useAuth } from '@/components/auth-provider';
import { useCurrentUser } from '@/lib/current-user-context';
import { useRealtimeCommitments } from '@/hooks/use-realtime-commitments';
import { useRealtimeTeamMembers } from '@/hooks/use-realtime-team-members';
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications';
import type { UserProfile } from '@/lib/types';

/* ------------------------------ Types ------------------------------ */

interface ProfileData {
  profile: UserProfile | null;
  user: { email: string; id: string; created_at: string };
  organization?: { id: string; role: 'owner' | 'manager' | 'member' } | null;
  teams?: {
    organizationId: string;
    teams: Array<{ teamId: string; teamName: string; role: 'team_lead' | 'member' }>;
    defaultTeamId?: string;
    defaultTeamName?: string;
  } | null;
  stats: {
    totalTasks: number;
    doneTasks: number;
    openTasks: number;
    overdueTasks: number;
    efficiency: number;
    myTasks: number;
    myDoneTasks: number;
    myEfficiency: number;
    totalMeetings: number;
  };
  recentMeetings: Array<{ id: string; title: string; created_at: string; total_tasks: number; done_tasks: number }>;
  upcomingTasks: Array<{ id: string; description: string; owner: string; due_date: string; meeting_id: string }>;
}

interface ProfileFormData {
  full_name: string;
  display_name: string;
  job_title: string;
  avatar_url: string;
  phone: string;
  email: string;
  company: string;
  bio: string;
  location: string;
}

const EMPTY_FORM: ProfileFormData = {
  full_name: '', display_name: '', job_title: '', avatar_url: '',
  phone: '', email: '', company: '', bio: '', location: '',
};

interface FieldDef {
  name: keyof ProfileFormData;
  label: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  full?: boolean;
  textarea?: boolean;
  maxLength?: number;
}

const FORM_SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: 'Basic information',
    fields: [
      { name: 'full_name', label: 'Full name *', placeholder: 'Your full name' },
      { name: 'display_name', label: 'Display name', placeholder: 'e.g., Akash', hint: 'Leave blank to use your first name' },
      { name: 'job_title', label: 'Job title', placeholder: 'e.g., Product Manager' },
      { name: 'avatar_url', label: 'Avatar URL', type: 'url', placeholder: 'https://example.com/avatar.jpg' },
    ],
  },
  {
    title: 'Professional',
    fields: [
      { name: 'company', label: 'Company', placeholder: 'Your company name' },
      { name: 'location', label: 'Location', placeholder: 'City, Country' },
      { name: 'bio', label: 'Bio', placeholder: 'Tell us about yourself...', full: true, textarea: true, maxLength: 2000 },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { name: 'email', label: 'Contact email', type: 'email', placeholder: 'Alternative email address', hint: 'Can differ from your account email' },
      { name: 'phone', label: 'Phone number', type: 'tel', placeholder: '+1 (555) 123-4567', maxLength: 20 },
    ],
  },
];

const ORG_ROLE: Record<string, string> = { owner: 'Owner', manager: 'Manager', member: 'Member' };

/* ----------------------------- Helpers ----------------------------- */

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * The profile row from /api/profile is the source of truth (its `email` is the optional
 * CONTACT email). currentUser is only a fallback for name fields.
 */
function toFormData(
  profile: UserProfile | null | undefined,
  fallback: Partial<UserProfile> | null | undefined,
): ProfileFormData {
  const p = profile ?? null;
  const f = fallback ?? null;
  return {
    full_name: p?.full_name ?? f?.full_name ?? '',
    display_name: p?.display_name ?? f?.display_name ?? '',
    job_title: p?.job_title ?? f?.job_title ?? '',
    avatar_url: p?.avatar_url ?? f?.avatar_url ?? '',
    phone: p?.phone ?? '',
    email: p?.email ?? '',
    company: p?.company ?? '',
    bio: p?.bio ?? '',
    location: p?.location ?? '',
  };
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 className="font-serif text-lg font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

const inputClass = 'border-slate-300 focus-visible:ring-blue-600';

/* ------------------------------ Content ------------------------------ */

function ProfileContent() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { user: currentUser, loading: userLoading, refreshUser } = useCurrentUser();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>(EMPTY_FORM);

  /* Subscribe to team member changes to refresh team context */
  useRealtimeTeamMembers((event, member) => {
    // When team membership changes, refetch profile to get updated teams
    if (event === 'insert' || event === 'delete') {
      authFetch('/api/profile')
        .then((res) => res.json())
        .then((d: ProfileData | { error: string }) => {
          if (!('error' in d) && d.teams) {
            setData((prev) => (prev ? { ...prev, teams: d.teams } : prev));
          }
        })
        .catch(() => {
          // Silently fail; not critical for profile display
        });
    }
  });

  /* Subscribe to upcoming task changes to show live status updates */
  useRealtimeCommitments((event, commitment) => {
    setData((prev) => {
      if (!prev || !prev.upcomingTasks) return prev;
      // Update upcoming tasks if the commitment is in the list
      const found = prev.upcomingTasks.some((t) => t.id === commitment.id);
      if (!found) return prev;
      
      const upcomingTasks = prev.upcomingTasks.map((task) => {
        if (task.id !== commitment.id) return task;
        return {
          ...task,
          description: commitment.description,
          owner: commitment.owner,
          due_date: commitment.due_date || task.due_date,
        };
      });
      return { ...prev, upcomingTasks };
    });
  });

  useEffect(() => {
    authFetch('/api/profile')
      .then((res) => res.json())
      .then((d: ProfileData | { error: string }) => {
        if ('error' in d) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError('Network error. Please try again.');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEditing) return;
    setFormData(toFormData(data?.profile, currentUser));
  }, [data?.profile, currentUser, isEditing]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleEditClick = () => {
    setFormData(toFormData(data?.profile, currentUser));
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveError(null);
    setFormData(toFormData(data?.profile, currentUser));
  };

  const setField = (field: keyof ProfileFormData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSaveProfile = async () => {
    setSaveError(null);
    const phone = formData.phone.trim();
    const email = formData.email.trim();

    if (!formData.full_name.trim()) return setSaveError('Full name is required.');
    if (phone && !/^[0-9\s\-+()]+$/.test(phone)) return setSaveError('Please enter a valid phone number.');
    if (phone.length > 20) return setSaveError('Phone number must be at most 20 characters.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setSaveError('Please enter a valid contact email address.');

    setIsSaving(true);
    try {
      const res = await authFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.full_name,
          display_name: formData.display_name,
          job_title: formData.job_title || null,
          avatar_url: formData.avatar_url || null,
          phone: formData.phone || null,
          email: formData.email || null,
          company: formData.company || null,
          bio: formData.bio || null,
          location: formData.location || null,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Failed to save profile');

      if (result.profile) setData((prev) => (prev ? { ...prev, profile: result.profile } : prev));
      await refreshUser();
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || userLoading) return <PageLoading />;
  if (error) return <PageError message={error} />;
  if (!data) return <PageError message="No profile data available." />;

  const { stats, recentMeetings, upcomingTasks, profile, organization, teams } = data;

  const shownName = profile?.full_name || currentUser?.full_name || user?.email?.split('@')[0] || 'User';
  const shownDisplayName = profile?.display_name || currentUser?.display_name;
  const shownJobTitle = profile?.job_title || currentUser?.job_title;
  const shownAvatar = profile?.avatar_url || currentUser?.avatar_url;
  const initials = (shownDisplayName || shownName || user?.email || 'U').slice(0, 2).toUpperCase();

  const details: Array<{ icon: LucideIcon; label: string; value?: string | null }> = [
    { icon: Mail, label: 'Account email', value: user?.email },
    { icon: Mail, label: 'Contact email', value: profile?.email },
    { icon: Phone, label: 'Phone', value: profile?.phone },
    { icon: Building2, label: 'Company', value: profile?.company },
    { icon: MapPin, label: 'Location', value: profile?.location },
    { icon: Calendar, label: 'Member since', value: formatDate(data.user.created_at) },
  ];

  const statCards: Array<{ label: string; value: number; note: string; icon: LucideIcon; color: string }> = [
    { label: 'Total commitments', value: stats.totalTasks, note: `Across ${stats.totalMeetings} meetings`, icon: Briefcase, color: 'text-slate-900' },
    { label: 'Completed', value: stats.doneTasks, note: `${stats.efficiency}% completion rate`, icon: CheckCircle2, color: 'text-green-700' },
    { label: 'Open', value: stats.openTasks, note: 'In progress', icon: Clock, color: 'text-blue-700' },
    { label: 'Overdue', value: stats.overdueTasks, note: 'Needs attention', icon: AlertTriangle, color: 'text-red-700' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        {/* ---------------- Profile header ---------------- */}
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <div className="h-1 bg-blue-600" />

          {!isEditing ? (
            <>
              <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
                <Avatar className="h-20 w-20 border border-slate-200 ring-4 ring-slate-50">
                  {shownAvatar && <AvatarImage src={shownAvatar} alt={shownDisplayName || 'User'} />}
                  <AvatarFallback className="bg-[#1F3A5F] text-xl font-semibold text-white">{initials}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <h1 className="truncate font-serif text-3xl font-semibold tracking-tight text-slate-900">{shownName}</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {[shownJobTitle, profile?.company].filter(Boolean).join(' at ') || 'No job title added'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {organization && (
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 font-medium text-blue-700">
                        {ORG_ROLE[organization.role] ?? organization.role}
                      </Badge>
                    )}
                    {shownDisplayName && shownDisplayName !== shownName && (
                      <span className="text-xs text-slate-500">Goes by {shownDisplayName}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link href="/preferences">
                    <Button variant="outline" className="gap-2 border-slate-300 text-slate-800">
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      Notification Preferences
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={handleEditClick} className="gap-2 border-slate-300 text-slate-800">
                    <Edit2 className="h-4 w-4" aria-hidden="true" />
                    Edit profile
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="gap-2 border-slate-300 text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </Button>
                </div>
              </div>

              <dl className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
                {details.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 bg-white px-6 py-4">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} aria-hidden="true" />
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-slate-500">{label}</dt>
                      <dd className={`mt-0.5 truncate text-sm ${value ? 'text-slate-900' : 'text-slate-400'}`}>
                        {value || 'Not provided'}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>

              {profile?.bio && (
                <div className="border-t border-slate-200 px-6 py-5 sm:px-8">
                  <h2 className="text-xs font-medium text-slate-500">About</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{profile.bio}</p>
                </div>
              )}
            </>
          ) : (
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-slate-900">Edit profile</h2>
                <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving} aria-label="Cancel editing">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-6 space-y-8">
                {FORM_SECTIONS.map((section) => (
                  <fieldset key={section.title} className="border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
                    <legend className="mb-4 text-sm font-semibold text-slate-900">{section.title}</legend>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {section.fields.map((f) => (
                        <div key={f.name} className={`space-y-1.5 ${f.full ? 'sm:col-span-2' : ''}`}>
                          <Label htmlFor={f.name} className="text-sm font-medium text-slate-700">
                            {f.label}
                          </Label>
                          {f.textarea ? (
                            <textarea
                              id={f.name}
                              rows={4}
                              maxLength={f.maxLength}
                              placeholder={f.placeholder}
                              value={formData[f.name]}
                              onChange={(e) => setField(f.name, e.target.value)}
                              disabled={isSaving}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            />
                          ) : (
                            <Input
                              id={f.name}
                              type={f.type ?? 'text'}
                              maxLength={f.maxLength}
                              placeholder={f.placeholder}
                              value={formData[f.name]}
                              onChange={(e) => setField(f.name, e.target.value)}
                              disabled={isSaving}
                              className={inputClass}
                            />
                          )}
                          {f.hint && <p className="text-xs text-slate-500">{f.hint}</p>}
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ))}

                {saveError && (
                  <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {saveError}
                  </div>
                )}

                <div className="flex gap-2 border-t border-slate-200 pt-6">
                  <Button onClick={handleSaveProfile} disabled={isSaving} className="gap-2 bg-blue-600 text-white hover:bg-blue-700">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="border-slate-300">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ---------------- Organization & teams ---------------- */}
        {(organization || (teams?.teams && teams.teams.length > 0)) && (
          <div className="grid gap-6 lg:grid-cols-3">
            {organization && (
              <Panel title="Organization">
                <dl className="space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Role</dt>
                    <dd>
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                        {ORG_ROLE[organization.role] ?? organization.role}
                      </Badge>
                    </dd>
                  </div>
                  {teams?.defaultTeamName && (
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Default team</dt>
                      <dd className="font-medium text-slate-900">{teams.defaultTeamName}</dd>
                    </div>
                  )}
                </dl>
              </Panel>
            )}

            {teams?.teams && teams.teams.length > 0 && (
              <div className={organization ? 'lg:col-span-2' : 'lg:col-span-3'}>
                <Panel title="Teams">
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {teams.teams.map((team) => (
                      <li
                        key={team.teamId}
                        className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <span className="truncate text-sm font-medium text-slate-900">{team.teamName}</span>
                        <Badge variant="outline" className="ml-3 shrink-0 border-slate-300 text-slate-700">
                          {team.role === 'team_lead' ? 'Team lead' : 'Member'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            )}
          </div>
        )}

        {/* ---------------- Stats ---------------- */}
        <div className="grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ label, value, note, icon: Icon, color }) => (
            <div key={label} className="bg-white p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <Icon className={`h-4 w-4 ${color}`} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <p className={`mt-3 font-serif text-4xl font-semibold ${color}`}>{value}</p>
              <p className="mt-1 text-xs text-slate-500">{note}</p>
            </div>
          ))}
        </div>

        {/* ---------------- My work efficiency ---------------- */}
        <Panel
          title="My work efficiency"
          action={<TrendingUp className="h-5 w-5 text-blue-600" strokeWidth={1.75} aria-hidden="true" />}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {stats.myDoneTasks} of {stats.myTasks} assigned tasks completed
            </span>
            <span className="font-semibold text-slate-900">{stats.myEfficiency}%</span>
          </div>
          <Progress value={stats.myEfficiency} className="h-2.5" />
          <dl className="mt-6 grid grid-cols-3 divide-x divide-slate-200 rounded-md border border-slate-200 bg-slate-50 text-center">
            {[
              { label: 'My commitments', value: stats.myTasks, color: 'text-slate-900' },
              { label: 'Completed', value: stats.myDoneTasks, color: 'text-green-700' },
              { label: 'Remaining', value: stats.myTasks - stats.myDoneTasks, color: 'text-blue-700' },
            ].map((s) => (
              <div key={s.label} className="px-4 py-4">
                <dd className={`font-serif text-2xl font-semibold ${s.color}`}>{s.value}</dd>
                <dt className="mt-0.5 text-xs text-slate-500">{s.label}</dt>
              </div>
            ))}
          </dl>
        </Panel>

        {/* ---------------- Meetings & tasks ---------------- */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Recent meetings">
            {recentMeetings.length === 0 ? (
              <p className="text-sm text-slate-500">No meetings yet.</p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
                {recentMeetings.map((meeting) => {
                  const completion =
                    meeting.total_tasks > 0 ? Math.round((meeting.done_tasks / meeting.total_tasks) * 100) : 0;
                  return (
                    <li key={meeting.id}>
                      <Link
                        href={`/meetings/${meeting.id}`}
                        className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 group-hover:text-blue-700">
                            {meeting.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatDate(meeting.created_at)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-slate-900">{completion}%</p>
                            <p className="text-xs text-slate-500">
                              {meeting.done_tasks}/{meeting.total_tasks} done
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600" aria-hidden="true" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Upcoming commitments">
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming commitments.</p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
                {upcomingTasks.map((task) => {
                  const dueDate = new Date(task.due_date);
                  const isOverdue = dueDate < new Date();
                  const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const label = isOverdue ? 'Overdue' : daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`;

                  return (
                    <li key={task.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-slate-900">{task.description}</p>
                        <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="shrink-0">
                          {label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" aria-hidden="true" />
                          {task.owner}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          {formatDate(task.due_date)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}