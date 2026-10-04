'use client';

import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface MaintenanceInfo {
  title?: string;
  description?: string;
  status?: 'maintenance' | 'error' | 'success';
}

export default function MaintenancePage() {
  const router = useRouter();
  const [maintenanceInfo, setMaintenanceInfo] = useState<MaintenanceInfo>({
    title: 'Under Maintenance',
    description: 'We\'re performing scheduled maintenance. We\'ll be back online shortly.',
    status: 'maintenance',
  });

  useEffect(() => {
    // Try to read maintenance info from session storage
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('maintenance-info');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setMaintenanceInfo(prev => ({
            ...prev,
            title: parsed.title || prev.title,
            description: parsed.description || prev.description,
            status: parsed.status || prev.status,
          }));
        } catch (e) {
          console.error('Failed to parse maintenance info:', e);
        }
      }
    }
  }, []);

  const title = maintenanceInfo.title || 'Under Maintenance';
  const description = maintenanceInfo.description || 'We\'re performing scheduled maintenance. We\'ll be back online shortly.';
  const status = maintenanceInfo.status || 'maintenance';
  const showRefresh = status !== 'maintenance';

  const getIcon = () => {
    switch (status) {
      case 'error':
        return <AlertTriangle className="h-16 w-16 text-red-500" />;
      case 'success':
        return <CheckCircle2 className="h-16 w-16 text-green-500" />;
      default:
        return <RefreshCw className="h-16 w-16 text-blue-500 animate-spin" />;
    }
  };

  const getBackgroundGradient = () => {
    switch (status) {
      case 'error':
        return 'from-red-50 to-red-100';
      case 'success':
        return 'from-green-50 to-green-100';
      default:
        return 'from-blue-50 to-indigo-50';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'error':
        return 'text-red-700';
      case 'success':
        return 'text-green-700';
      default:
        return 'text-blue-700';
    }
  };

  const getButtonColor = () => {
    switch (status) {
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    router.push('/dashboard');
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${getBackgroundGradient()} px-4`}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {getIcon()}
          </div>

          {/* Title */}
          <h1 className={`text-3xl font-bold mb-3 ${getStatusColor()}`}>
            {title}
          </h1>

          {/* Description */}
          <p className="text-gray-600 mb-8 text-lg leading-relaxed">
            {description}
          </p>

          {/* Status Indicator */}
          <div className="mb-8 inline-block">
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor()} ${getStatusColor() === 'text-blue-700' ? 'bg-blue-100' : getStatusColor() === 'text-red-700' ? 'bg-red-100' : 'bg-green-100'}`}>
              {status === 'maintenance' && 'Scheduled Maintenance'}
              {status === 'error' && 'Error Occurred'}
              {status === 'success' && 'Operation Complete'}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {showRefresh && (
              <Button
                onClick={handleRefresh}
                className={`w-full ${getButtonColor()} text-white gap-2`}
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            <Button
              onClick={handleGoHome}
              variant="outline"
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>

          {/* Footer Message */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              If the problem persists, please contact support at support@followthru.com
            </p>
          </div>
        </div>

        {/* Background Elements */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-10 left-10 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl"></div>
          <div className="absolute -bottom-8 right-10 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl"></div>
        </div>
      </div>
    </div>
  );
}
