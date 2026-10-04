'use client';

import React, { Component, ReactNode } from 'react';
import MaintenancePage from '@/app/maintenance/page';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Store error info in session storage for maintenance page to display
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        'maintenance-info',
        JSON.stringify({
          title: this.props.fallbackTitle || 'Something Went Wrong',
          description: this.props.fallbackMessage || 'An unexpected error occurred. Please try again or contact support.',
          status: 'error',
          error: error.message,
        })
      );
    }
  }

  public render() {
    if (this.state.hasError) {
      return <MaintenancePage />;
    }

    return this.props.children;
  }
}
