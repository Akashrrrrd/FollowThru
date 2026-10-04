'use client';

import { AlertTriangle, CheckCircle2, Wrench, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Status = 'maintenance' | 'error' | 'success';

interface MaintenanceInfo {
  title?: string;
  description?: string;
  status?: Status;
}

const DEFAULTS = {
  title: 'Scheduled maintenance',
  description:
    "We're making improvements to FollowThru. The service will be back online shortly.",
  status: 'maintenance' as Status,
};

// One place for everything that varies by status.
const THEME: Record<
  Status,
  {
    label: string;
    icon: typeof Wrench;
    rule: string; // top accent rule
    ring: string; // icon ring + tint
    iconColor: string;
    dot: string;
    button: string;
  }
> = {
  maintenance: {
    label: 'Maintenance in progress',
    icon: Wrench,
    rule: 'bg-[#1F3A5F]',
    ring: 'border-[#C9D4E3] bg-[#EEF2F8]',
    iconColor: 'text-[#1F3A5F]',
    dot: 'bg-[#1F3A5F]',
    button: 'bg-[#1F3A5F] hover:bg-[#182E4B] focus-visible:ring-[#1F3A5F]',
  },
  error: {
    label: 'Service interruption',
    icon: AlertTriangle,
    rule: 'bg-[#8E2A2A]',
    ring: 'border-[#E6C7C7] bg-[#FAF0F0]',
    iconColor: 'text-[#8E2A2A]',
    dot: 'bg-[#8E2A2A]',
    button: 'bg-[#8E2A2A] hover:bg-[#762222] focus-visible:ring-[#8E2A2A]',
  },
  success: {
    label: 'Completed',
    icon: CheckCircle2,
    rule: 'bg-[#2F6B4F]',
    ring: 'border-[#C5DDD0] bg-[#EFF6F2]',
    iconColor: 'text-[#2F6B4F]',
    dot: 'bg-[#2F6B4F]',
    button: 'bg-[#2F6B4F] hover:bg-[#265741] focus-visible:ring-[#2F6B4F]',
  },
};

export default function MaintenancePage() {
  const router = useRouter();
  const [info, setInfo] = useState<MaintenanceInfo>(DEFAULTS);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('maintenance-info');
      if (!stored) return;
      const parsed = JSON.parse(stored) as MaintenanceInfo;
      setInfo((prev) => ({
        title: parsed.title || prev.title,
        description: parsed.description || prev.description,
        status: parsed.status && parsed.status in THEME ? parsed.status : prev.status,
      }));
    } catch (e) {
      console.error('Failed to read maintenance info:', e);
    }
  }, []);

  const title = info.title || DEFAULTS.title;
  const description = info.description || DEFAULTS.description;
  const status: Status = info.status || DEFAULTS.status;
  const theme = THEME[status];
  const Icon = theme.icon;
  const showRefresh = status !== 'maintenance';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <p className="mb-6 text-center font-serif text-lg font-semibold tracking-tight text-[#1B2433]">
          FollowThru
        </p>

        <section
          role="status"
          aria-live="polite"
          className="overflow-hidden rounded-md border border-[#DCE1E8] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
        >
          {/* Accent rule */}
          <div className={`h-1 w-full ${theme.rule}`} />

          <div className="px-8 pb-8 pt-10 text-center sm:px-12">
            {/* Icon */}
            <div
              className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border ${theme.ring}`}
            >
              <Icon className={`h-7 w-7 ${theme.iconColor}`} strokeWidth={1.75} aria-hidden="true" />
            </div>

            {/* Status */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#DCE1E8] bg-[#F6F7F9] px-3 py-1 text-xs font-medium text-[#4A5568]">
              <span className={`h-1.5 w-1.5 rounded-full ${theme.dot}`} aria-hidden="true" />
              {theme.label}
            </div>

            {/* Title */}
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight text-[#1B2433] sm:text-[2rem]">
              {title}
            </h1>

            {/* Description */}
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-[#4A5568]">
              {description}
            </p>

            {/* Actions */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {showRefresh && (
                <Button
                  onClick={() => window.location.reload()}
                  className={`gap-2 text-white focus-visible:ring-2 focus-visible:ring-offset-2 ${theme.button}`}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </Button>
              )}
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="gap-2 border-[#C5CCD6] text-[#1B2433] hover:bg-[#F6F7F9]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Home
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[#E8EBF0] bg-[#FAFBFC] px-8 py-4 text-center">
            <p className="text-sm text-[#667085]">
              Need help? Contact{' '}
              <a
                href="mailto:support@followthru.com"
                className="font-medium text-[#1F3A5F] underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F3A5F]"
              >
                followthruai@gmail.com
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}