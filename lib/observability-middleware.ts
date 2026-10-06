/**
 * Observability Middleware for API Routes
 *
 * Provides unified error handling, request logging, and performance tracking.
 * Wraps API route handlers to add observability without boilerplate.
 *
 * Usage:
 *  export const GET = withObservability('GET /api/teams', async (req) => {
 *    // Your handler code
 *    return successResponse(data);
 *  });
 */

import { NextRequest, NextResponse } from 'next/server';
import { addBreadcrumb, captureException, captureMessage } from '@/lib/sentry-init';
import { internalError } from '@/lib/api-response';

let Sentry: any = null;
try {
  Sentry = require('@sentry/nextjs');
} catch {
  // Sentry not installed, will skip transaction tracking
}

interface ObservabilityOptions {
  captureErrors?: boolean;
  capturePerformance?: boolean;
  captureRequestBody?: boolean;
  slowThresholdMs?: number;
}

/**
 * Wrap an API route handler with observability (error tracking, logging, performance).
 */
export function withObservability<T extends (...args: any[]) => any>(
  operationName: string,
  handler: T,
  options: ObservabilityOptions = {}
): T {
  const {
    captureErrors = true,
    capturePerformance = true,
    captureRequestBody = false,
    slowThresholdMs = 1000,
  } = options;

  return (async (...args: any[]) => {
    const request: NextRequest | undefined = args[0];
    const startTime = performance.now();

    const method = request?.method || 'UNKNOWN';
    const path = request?.nextUrl?.pathname || 'unknown';
    const url = request?.nextUrl?.href || 'unknown';

    try {
      let transaction = null;
      if (Sentry && process.env.NEXT_PUBLIC_SENTRY_DSN) {
        try {
          transaction = Sentry.startTransaction({
            name: operationName,
            op: 'http.request',
          });
        } catch {
          // ignore
        }
      }

      if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        addBreadcrumb(`${method} ${path}`, { url, method, path }, 'info');
      }

      const response = await handler(...args);
      const duration = performance.now() - startTime;

      if (capturePerformance && duration > slowThresholdMs) {
        captureMessage(`Slow API request: ${operationName}`, 'warning', {
          method,
          path,
          duration: `${duration.toFixed(2)}ms`,
        });
      }

      if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        addBreadcrumb(`${operationName} completed`, {
          duration: `${duration.toFixed(2)}ms`,
          status: response?.status,
        });
      }

      if (transaction && Sentry) {
        try {
          transaction.setHttpStatus(response?.status || 200);
          transaction.finish();
        } catch {
          // ignore
        }
      }

      return response;
    } catch (err: any) {
      const duration = performance.now() - startTime;
      console.error(`[${operationName}] Error:`, err);

      if (captureErrors && process.env.NEXT_PUBLIC_SENTRY_DSN) {
        captureException(err, {
          operation: operationName,
          method,
          path,
          duration: `${duration.toFixed(2)}ms`,
        });
      }

      return internalError();
    }
  }) as T;
}

/**
 * Log all incoming requests.
 */
export function createRequestLogger() {
  return (request: NextRequest) => {
    const method = request.method;
    const path = request.nextUrl.pathname;
    const timestamp = new Date().toISOString();

    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      addBreadcrumb(`${method} ${path}`, { timestamp, url: request.nextUrl.href }, 'debug');
    }

    console.debug(`[${timestamp}] ${method} ${path}`);
  };
}

/**
 * Custom error handler for integration with Sentry.
 */
export function handleError(
  error: Error | unknown,
  context: {
    route?: string;
    userId?: string;
    operation?: string;
  } = {}
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.error('[Error Handler]', {
    message: errorMessage,
    context,
  });

  if (process.env.NEXT_PUBLIC_SENTRY_DSN && Sentry) {
    try {
      Sentry.setContext('error_context', context);
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(`Non-Error exception: ${errorMessage}`, 'error');
      }
    } catch {
      // ignore
    }
  }

  return internalError(errorMessage);
}

/**
 * Monitor database query performance.
 */
export async function monitorDatabaseQuery<T>(
  queryName: string,
  query: () => Promise<T>,
  options: { slowThresholdMs?: number } = {}
): Promise<T> {
  const { slowThresholdMs = 500 } = options;
  const startTime = performance.now();

  try {
    const result = await query();
    const duration = performance.now() - startTime;

    if (duration > slowThresholdMs) {
      captureMessage(`Slow database query: ${queryName}`, 'warning', {
        query: queryName,
        duration: `${duration.toFixed(2)}ms`,
      });
    }

    return result;
  } catch (err) {
    const duration = performance.now() - startTime;
    captureException(err, { query: queryName, duration: `${duration.toFixed(2)}ms` });
    throw err;
  }
}

/**
 * Track custom events (business metrics).
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    addBreadcrumb(`Event: ${eventName}`, properties, 'info');
  }
  console.info(`[Event] ${eventName}`, properties);
}
