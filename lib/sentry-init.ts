/**
 * Sentry Error Tracking & Performance Monitoring
 *
 * Initializes Sentry for error tracking, performance monitoring, and debugging.
 * Captures server-side errors, unhandled exceptions, and performance metrics.
 *
 * Environment Variables:
 *  NEXT_PUBLIC_SENTRY_DSN: Sentry project DSN (required for Sentry)
 *  SENTRY_ENVIRONMENT: Environment (development, staging, production)
 *  SENTRY_RELEASE: Release version (e.g., git commit SHA)
 *
 * Note: Requires @sentry/nextjs package to be installed
 */

let Sentry: any = null;
let sentryInitialized = false;

// Try to import Sentry, but don't fail if not installed
try {
  Sentry = require('@sentry/nextjs');
} catch (err) {
  console.debug('[Sentry] Not installed or import failed');
}

export interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  debug: boolean;
}

/**
 * Initialize Sentry for server-side use.
 * Call this once on application startup.
 */
export function initSentry(): SentryConfig | null {
  if (!Sentry) {
    console.info('[Sentry] Package not installed (@sentry/nextjs). Error tracking disabled.');
    return null;
  }

  if (sentryInitialized) {
    return null; // Already initialized
  }

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    console.info('[Sentry] Not configured (NEXT_PUBLIC_SENTRY_DSN not set)');
    return null;
  }

  const environment = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';

  try {
    // Initialize Sentry
    Sentry.init({
      dsn,
      environment,
      release: process.env.SENTRY_RELEASE || undefined,

      // Performance monitoring: capture traces
      tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in prod, 100% in dev
      tracePropagationTargets: [
        'localhost',
        /^\//,
        /^https:\/\/yourserver\.io\/api/,
      ],

      // Error handling
      attachStacktrace: true,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.OnUncaughtException(),
        new Sentry.Integrations.OnUnhandledRejection(),
      ],

      // Debugging
      debug: !isProduction,
      beforeSend(event: any, hint: any) {
        // Filter out certain errors in development
        if (!isProduction && hint.originalException instanceof SyntaxError) {
          return null; // Ignore syntax errors in dev
        }
        return event;
      },
    });

    sentryInitialized = true;

    console.info('[Sentry] Initialized', {
      dsn: dsn.split('@')[0] + '/@***',
      environment,
      sampleRate: isProduction ? '10%' : '100%',
    });

    return {
      dsn,
      environment,
      tracesSampleRate: isProduction ? 0.1 : 1.0,
      debug: !isProduction,
    };
  } catch (err) {
    console.error('[Sentry] Failed to initialize:', err);
    return null;
  }
}

/**
 * Capture an exception with context.
 */
export function captureException(error: Error | unknown, context?: Record<string, any>) {
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  try {
    if (context) {
      Sentry.setContext('custom', context);
    }

    Sentry.captureException(error);
  } catch (err) {
    console.error('[Sentry] Failed to capture exception:', err);
  }
}

/**
 * Capture a message (info, warning, error level).
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
) {
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  try {
    if (context) {
      Sentry.setContext('custom', context);
    }

    Sentry.captureMessage(message, level);
  } catch (err) {
    console.error('[Sentry] Failed to capture message:', err);
  }
}

/**
 * Set user context for error tracking.
 * Call after user authentication.
 */
export function setUserContext(userId: string, email?: string, name?: string) {
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  try {
    Sentry.setUser({
      id: userId,
      email,
      username: name,
    });
  } catch (err) {
    console.error('[Sentry] Failed to set user context:', err);
  }
}

/**
 * Clear user context (e.g., on logout).
 */
export function clearUserContext() {
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  try {
    Sentry.setUser(null);
  } catch (err) {
    console.error('[Sentry] Failed to clear user context:', err);
  }
}

/**
 * Set custom breadcrumb for debugging.
 * Breadcrumbs appear before errors in Sentry dashboard.
 */
export function addBreadcrumb(
  message: string,
  data?: Record<string, any>,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
) {
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  try {
    Sentry.addBreadcrumb({
      message,
      data,
      level,
      timestamp: Date.now() / 1000,
    });
  } catch (err) {
    console.error('[Sentry] Failed to add breadcrumb:', err);
  }
}

/**
 * Start a transaction for performance monitoring.
 * Returns a transaction object that can be finished manually.
 */
export function startTransaction(name: string, op: string = 'http.request') {
  if (!Sentry || !process.env.NEXT_PUBLIC_SENTRY_DSN) return null;

  try {
    return Sentry.startTransaction({
      name,
      op,
    });
  } catch (err) {
    console.error('[Sentry] Failed to start transaction:', err);
    return null;
  }
}
