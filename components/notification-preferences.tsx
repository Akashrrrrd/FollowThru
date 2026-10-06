'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface NotificationPreferences {
  // Email notification toggles
  email_notifications_assignment: boolean;
  email_notifications_due_soon: boolean;
  email_notifications_due_1h: boolean;
  email_notifications_overdue: boolean;
  email_notifications_escalation: boolean;
  email_notifications_status_change: boolean;
  email_notifications_completion: boolean;
  // In-app notification toggles
  inapp_notifications_assignment: boolean;
  inapp_notifications_due_soon: boolean;
  inapp_notifications_due_1h: boolean;
  inapp_notifications_overdue: boolean;
  inapp_notifications_escalation: boolean;
  inapp_notifications_status_change: boolean;
  inapp_notifications_completion: boolean;
  // Email digest
  email_digest_enabled: boolean;
  email_digest_time: string;
  // Global settings
  notifications_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

interface NotificationPreferencesProps {
  onSave?: () => void;
}

const notificationTypes = [
  { key: 'assignment', label: 'New Assignment', description: 'When a commitment is assigned to you' },
  { key: 'due_soon', label: 'Due Soon', description: 'Reminder when a commitment is due within 24 hours' },
  { key: 'due_1h', label: 'Due in 1 Hour', description: 'Urgent reminder when a commitment is due within 1 hour' },
  { key: 'overdue', label: 'Overdue', description: 'Alert when a commitment becomes overdue' },
  { key: 'escalation', label: 'Escalation', description: 'When a commitment is escalated to you' },
  { key: 'status_change', label: 'Status Change', description: 'When a commitment status changes' },
  { key: 'completion', label: 'Commitment Completion', description: 'When someone completes a commitment you care about' },
];

export function NotificationPreferences({ onSave }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch('/api/user-preferences');
        if (!response.ok) {
          throw new Error('Failed to fetch preferences');
        }

        const data = await response.json();
        const prefs = data.preferences;

        // Set defaults for new users
        const defaults: NotificationPreferences = {
          email_notifications_assignment: true,
          email_notifications_due_soon: true,
          email_notifications_due_1h: true,
          email_notifications_overdue: true,
          email_notifications_escalation: true,
          email_notifications_status_change: false,
          email_notifications_completion: true,
          inapp_notifications_assignment: true,
          inapp_notifications_due_soon: true,
          inapp_notifications_due_1h: true,
          inapp_notifications_overdue: true,
          inapp_notifications_escalation: true,
          inapp_notifications_status_change: true,
          inapp_notifications_completion: true,
          email_digest_enabled: false,
          email_digest_time: '09:00',
          notifications_enabled: true,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
        };

        setPreferences({ ...defaults, ...prefs });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
        console.error('[NotificationPreferences] Error loading:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const handlePreferenceChange = useCallback(
    (key: keyof NotificationPreferences, value: boolean | string) => {
      setPreferences((prev) => {
        if (!prev) return prev;
        return { ...prev, [key]: value };
      });
      setSuccess(false);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!preferences) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/user-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save preferences');
      }

      setSuccess(true);
      onSave?.();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving preferences');
      console.error('[NotificationPreferences] Error saving:', err);
    } finally {
      setSaving(false);
    }
  }, [preferences, onSave]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || 'Failed to load preferences'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Notification preferences saved successfully
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="inapp">In-App</TabsTrigger>
          <TabsTrigger value="digest">Digest</TabsTrigger>
          <TabsTrigger value="quiet">Quiet Hours</TabsTrigger>
        </TabsList>

        {/* Email Notifications Tab */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose which notifications you want to receive via email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {notificationTypes.map((type) => (
                <div key={type.key} className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">{type.label}</Label>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>
                  <Switch
                    checked={
                      preferences[
                        `email_notifications_${type.key}` as keyof NotificationPreferences
                      ] as boolean
                    }
                    onCheckedChange={(checked) =>
                      handlePreferenceChange(
                        `email_notifications_${type.key}` as keyof NotificationPreferences,
                        checked
                      )
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* In-App Notifications Tab */}
        <TabsContent value="inapp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>In-App Notifications</CardTitle>
              <CardDescription>
                Choose which notifications appear in your notification center
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {notificationTypes.map((type) => (
                <div key={type.key} className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">{type.label}</Label>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>
                  <Switch
                    checked={
                      preferences[
                        `inapp_notifications_${type.key}` as keyof NotificationPreferences
                      ] as boolean
                    }
                    onCheckedChange={(checked) =>
                      handlePreferenceChange(
                        `inapp_notifications_${type.key}` as keyof NotificationPreferences,
                        checked
                      )
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Digest Tab */}
        <TabsContent value="digest" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Digest</CardTitle>
              <CardDescription>
                Instead of individual emails, receive all notifications in one daily digest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Enable Daily Digest</Label>
                  <p className="text-sm text-gray-600">
                    Consolidate all notifications into one email
                  </p>
                </div>
                <Switch
                  checked={preferences.email_digest_enabled}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange('email_digest_enabled', checked)
                  }
                />
              </div>

              {preferences.email_digest_enabled && (
                <>
                  <Separator />
                  <div>
                    <Label htmlFor="digest-time" className="text-base font-medium">
                      Send Digest At
                    </Label>
                    <p className="text-sm text-gray-600 mb-2">
                      Time each day to send your daily digest (24-hour format)
                    </p>
                    <Input
                      id="digest-time"
                      type="time"
                      value={preferences.email_digest_time}
                      onChange={(e) => handlePreferenceChange('email_digest_time', e.target.value)}
                      className="w-32"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quiet Hours Tab */}
        <TabsContent value="quiet" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiet Hours</CardTitle>
              <CardDescription>
                No notifications will be sent or shown during quiet hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Enable Quiet Hours</Label>
                  <p className="text-sm text-gray-600">
                    Temporarily mute all notifications during specified hours
                  </p>
                </div>
                <Switch
                  checked={preferences.quiet_hours_enabled}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange('quiet_hours_enabled', checked)
                  }
                />
              </div>

              {preferences.quiet_hours_enabled && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quiet-start" className="text-base font-medium">
                        Start Time
                      </Label>
                      <p className="text-sm text-gray-600 mb-2">When to start quiet hours</p>
                      <Input
                        id="quiet-start"
                        type="time"
                        value={preferences.quiet_hours_start}
                        onChange={(e) =>
                          handlePreferenceChange('quiet_hours_start', e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="quiet-end" className="text-base font-medium">
                        End Time
                      </Label>
                      <p className="text-sm text-gray-600 mb-2">When to end quiet hours</p>
                      <Input
                        id="quiet-end"
                        type="time"
                        value={preferences.quiet_hours_end}
                        onChange={(e) =>
                          handlePreferenceChange('quiet_hours_end', e.target.value)
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Global Settings</CardTitle>
          <CardDescription>Master controls for all notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">Enable All Notifications</Label>
              <p className="text-sm text-gray-600">
                Turn off to temporarily disable all notifications
              </p>
            </div>
            <Switch
              checked={preferences.notifications_enabled}
              onCheckedChange={(checked) =>
                handlePreferenceChange('notifications_enabled', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
