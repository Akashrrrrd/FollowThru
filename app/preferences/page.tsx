'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationPreferences } from '@/components/notification-preferences';
import { useToast } from '@/hooks/use-toast';

export default function PreferencesPage() {
  const { toast } = useToast();

  const handleSave = useCallback(() => {
    toast({
      title: 'Success',
      description: 'Your notification preferences have been saved.',
    });
  }, [toast]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-gray-600 mt-2">
            Customize how and when you receive notifications
          </p>
        </div>

        {/* Preferences Component */}
        <NotificationPreferences onSave={handleSave} />
      </div>
    </div>
  );
}
