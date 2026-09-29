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

interface ProfileData {
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitials(email: string): string {
  const username = email.split('@')[0];
  return username.slice(0, 2).toUpperCase();
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

  // Form state for editing
  const [formData, setFormData] = useState({
    full_name: '',
    display_name: '',
    job_title: '',
    avatar_url: '',
  });

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

  // Populate form when currentUser is loaded
  useEffect(() => {
    if (currentUser) {
      setFormData({
        full_name: currentUser.full_name || '',
        display_name: currentUser.display_name || '',
        job_title: currentUser.job_title || '',
        avatar_url: currentUser.avatar_url || '',
      });
    }
  }, [currentUser]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setSaveError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveError(null);
    // Reset form to current values
    if (currentUser) {
      setFormData({
        full_name: currentUser.full_name || '',
        display_name: currentUser.display_name || '',
        job_title: currentUser.job_title || '',
        avatar_url: currentUser.avatar_url || '',
      });
    }
  };

  const handleSaveProfile = async () => {
    setSaveError(null);

    if (!formData.full_name.trim()) {
      setSaveError('Full name is required.');
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
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      // Refresh user context to update everywhere
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

  const { stats, recentMeetings, upcomingTasks } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Profile Header - Editable */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {!isEditing ? (
          // Display Mode
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20 border-2 border-blue-100">
              {currentUser?.avatar_url && (
                <AvatarImage src={currentUser.avatar_url} alt={currentUser?.display_name || 'User'} />
              )}
              <AvatarFallback className="bg-blue-600 text-xl font-semibold text-white">
                {currentUser?.display_name
                  ? currentUser.display_name.slice(0, 2).toUpperCase()
                  : user?.email
                  ? user.email.slice(0, 2).toUpperCase()
                  : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {currentUser?.full_name || user?.email?.split('@')[0] || 'User'}
              </h1>
              {currentUser?.display_name && (
                <div className="text-sm text-gray-500">Display name: {currentUser.display_name}</div>
              )}
              {currentUser?.job_title && (
                <div className="text-sm text-gray-600 font-medium">{currentUser.job_title}</div>
              )}
              <div className="mt-2 flex flex-col gap-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user?.email}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Member since {formatDate(data.user.created_at)}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={handleEditClick}
                className="gap-2"
              >
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
          // Edit Mode
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit Profile</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
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
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  disabled={isSaving}
                  className="border-gray-300"
                />
                <p className="text-xs text-gray-500">
                  Leave blank to auto-generate from first name
                </p>
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
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  disabled={isSaving}
                  className="border-gray-300"
                />
              </div>

              {saveError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
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
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
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
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Tasks
            </CardTitle>
            <Briefcase className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {stats.totalTasks}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Across {stats.totalMeetings} meetings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Completed
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.doneTasks}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {stats.efficiency}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Open Tasks
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.openTasks}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              In progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Overdue
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.overdueTasks}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Needs attention
            </p>
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
                <span className="font-semibold text-gray-900">
                  {stats.myEfficiency}%
                </span>
              </div>
              <Progress value={stats.myEfficiency} className="h-3" />
            </div>
            <div className="grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.myTasks}
                </div>
                <div className="text-xs text-gray-500">My Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.myDoneTasks}
                </div>
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
                    <Link
                      key={meeting.id}
                      href={`/meetings/${meeting.id}`}
                      className="group block"
                    >
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
                            <div className="text-sm font-medium text-gray-900">
                              {completion}%
                            </div>
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
                    <div
                      key={task.id}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex-1 text-sm text-gray-900">
                          {task.description}
                        </div>
                        <Badge
                          variant={isOverdue ? 'destructive' : 'secondary'}
                          className="ml-2"
                        >
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
