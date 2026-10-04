'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { UserProfile } from '@/lib/types';

interface ProfileData {
  profile: UserProfile | null;
  user: {
    email: string;
    id: string;
    created_at: string;
  };
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
  recentMeetings: Array<{
    id: string;
    title: string;
    created_at: string;
    total_tasks: number;
    done_tasks: number;
  }>;
  upcomingTasks: Array<{
    id: string;
    description: string;
    owner: string;
    due_date: string;
    meeting_id: string;
  }>;
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
  full_name: '',
  display_name: '',
  job_title: '',
  avatar_url: '',
  phone: '',
  email: '',
  company: '',
  bio: '',
  location: '',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Build the edit-form values. The profile row returned by /api/profile is the source of
 * truth (its `email` is the optional CONTACT email). currentUser is only a fallback for
 * name fields — its `email` is the auth email and must not be copied into the contact email.
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

  useEffect(() => {
    authFetch('/api/profile')
      .then((res) => res.json())
      .then((d: ProfileData | { error: string }) => {
        if ('error' in d) {
          setError(d.error);
        } else {
          setData(d);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Network error. Please try again.');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the form in sync when data loads (but never clobber edits in progress)
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

    if (!formData.full_name.trim()) {
      setSaveError('Full name is required.');
      return;
    }
    if (formData.phone.trim() && !/^[0-9\s\-+()]+$/.test(formData.phone.trim())) {
      setSaveError('Please enter a valid phone number.');
      return;
    }
    if (formData.phone.trim().length > 20) {
      setSaveError('Phone number must be at most 20 characters.');
      return;
    }
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setSaveError('Please enter a valid contact email address.');
      return;
    }

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
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save profile');
      }

      // Update local profile so the form/display reflect the saved values immediately
      if (result.profile) {
        setData((prev) => (prev ? { ...prev, profile: result.profile } : prev));
      }

      // Refresh user context so the name/avatar update everywhere
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

  const { stats, recentMeetings, upcomingTasks, profile } = data;

  // Prefer the freshly-fetched profile for display; fall back to context
  const shownName = profile?.full_name || currentUser?.full_name || user?.email?.split('@')[0] || 'User';
  const shownDisplayName = profile?.display_name || currentUser?.display_name;
  const shownJobTitle = profile?.job_title || currentUser?.job_title;
  const shownAvatar = profile?.avatar_url || currentUser?.avatar_url;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Profile Header - Editable */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {!isEditing ? (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20 border-2 border-blue-100">
              {shownAvatar && <AvatarImage src={shownAvatar} alt={shownDisplayName || 'User'} />}
              <AvatarFallback className="bg-blue-600 text-xl font-semibold text-white">
                {shownDisplayName
                  ? shownDisplayName.slice(0, 2).toUpperCase()
                  : user?.email
                  ? user.email.slice(0, 2).toUpperCase()
                  : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{shownName}</h1>
              {shownDisplayName && (
                <div className="text-sm text-gray-500">Display name: {shownDisplayName}</div>
              )}
              {shownJobTitle && (
                <div className="text-sm font-medium text-gray-600">{shownJobTitle}</div>
              )}
              <div className="mt-2 flex flex-col gap-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user?.email}
                </div>
                {profile?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {profile.email} <span className="text-xs">(contact)</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {profile.phone}
                  </div>
                )}
                {profile?.company && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {profile.company}
                  </div>
                )}
                {profile?.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Member since {formatDate(data.user.created_at)}
                </div>
              </div>
              {profile?.bio && (
                <p className="mt-3 whitespace-pre-line text-sm text-gray-600">{profile.bio}</p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handleEditClick} className="gap-2">
                <Edit2 className="h-4 w-4" />
                Edit Profile
              </Button>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit Profile</h2>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-sm font-medium">
                  Full Name *
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  placeholder="Your full name"
                  value={formData.full_name}
                  onChange={(e) => setField('full_name', e.target.value)}
                  disabled={isSaving}
                  className="border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name" className="text-sm font-medium">
                  Display Name (how you appear to others)
                </Label>
                <Input
                  id="display_name"
                  type="text"
                  placeholder="e.g., Akash, Alex, etc."
                  value={formData.display_name}
                  onChange={(e) => setField('display_name', e.target.value)}
                  disabled={isSaving}
                  className="border-gray-300"
                />
                <p className="text-xs text-gray-500">Leave blank to auto-generate from first name</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_title" className="text-sm font-medium">
                  Job Title
                </Label>
                <Input
                  id="job_title"
                  type="text"
                  placeholder="e.g., Product Manager, Engineer, etc."
                  value={formData.job_title}
                  onChange={(e) => setField('job_title', e.target.value)}
                  disabled={isSaving}
                  className="border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar_url" className="text-sm font-medium">
                  Avatar URL
                </Label>
                <Input
                  id="avatar_url"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={formData.avatar_url}
                  onChange={(e) => setField('avatar_url', e.target.value)}
                  disabled={isSaving}
                  className="border-gray-300"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">Professional Information</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-sm font-medium">
                      Company
                    </Label>
                    <Input
                      id="company"
                      type="text"
                      placeholder="Your company name"
                      value={formData.company}
                      onChange={(e) => setField('company', e.target.value)}
                      disabled={isSaving}
                      className="border-gray-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm font-medium">
                      Location
                    </Label>
                    <Input
                      id="location"
                      type="text"
                      placeholder="City, Country"
                      value={formData.location}
                      onChange={(e) => setField('location', e.target.value)}
                      disabled={isSaving}
                      className="border-gray-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio" className="text-sm font-medium">
                      Bio
                    </Label>
                    <textarea
                      id="bio"
                      placeholder="Tell us about yourself..."
                      value={formData.bio}
                      onChange={(e) => setField('bio', e.target.value)}
                      disabled={isSaving}
                      rows={3}
                      maxLength={2000}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">Contact Information</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Contact Email (Optional)
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Alternative email address"
                      value={formData.email}
                      onChange={(e) => setField('email', e.target.value)}
                      disabled={isSaving}
                      className="border-gray-300"
                    />
                    <p className="text-xs text-gray-500">Can be different from your account email</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      Phone Number (Optional)
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      maxLength={20}
                      value={formData.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      disabled={isSaving}
                      className="border-gray-300"
                    />
                  </div>
                </div>
              </div>

              {saveError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {saveError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Tasks</CardTitle>
            <Briefcase className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.totalTasks}</div>
            <p className="mt-1 text-xs text-gray-500">Across {stats.totalMeetings} meetings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.doneTasks}</div>
            <p className="mt-1 text-xs text-gray-500">{stats.efficiency}% completion rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Open Tasks</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.openTasks}</div>
            <p className="mt-1 text-xs text-gray-500">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdueTasks}</div>
            <p className="mt-1 text-xs text-gray-500">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* My Work Efficiency */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            My Work Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Tasks assigned to me: {stats.myDoneTasks} / {stats.myTasks} completed
                </span>
                <span className="font-semibold text-gray-900">{stats.myEfficiency}%</span>
              </div>
              <Progress value={stats.myEfficiency} className="h-3" />
            </div>
            <div className="grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.myTasks}</div>
                <div className="text-xs text-gray-500">My Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.myDoneTasks}</div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.myTasks - stats.myDoneTasks}
                </div>
                <div className="text-xs text-gray-500">Remaining</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Meetings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMeetings.length === 0 ? (
              <p className="text-sm text-gray-500">No meetings yet</p>
            ) : (
              <div className="space-y-3">
                {recentMeetings.map((meeting) => {
                  const completion =
                    meeting.total_tasks > 0
                      ? Math.round((meeting.done_tasks / meeting.total_tasks) * 100)
                      : 0;
                  return (
                    <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="group block">
                      <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 group-hover:text-blue-600">
                            {meeting.title}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {formatDate(meeting.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">{completion}%</div>
                            <div className="text-xs text-gray-500">
                              {meeting.done_tasks}/{meeting.total_tasks}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming tasks</p>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map((task) => {
                  const dueDate = new Date(task.due_date);
                  const isOverdue = dueDate < new Date();
                  const daysUntil = Math.ceil(
                    (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );

                  return (
                    <div key={task.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex-1 text-sm text-gray-900">{task.description}</div>
                        <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="ml-2">
                          {isOverdue
                            ? 'Overdue'
                            : daysUntil === 0
                            ? 'Today'
                            : daysUntil === 1
                            ? 'Tomorrow'
                            : `${daysUntil}d`}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {task.owner}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(task.due_date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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