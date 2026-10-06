# Observability & Error Tracking Guide

## Overview

This document describes how to use Sentry for error tracking, performance monitoring, and debugging in FollowThru.

## Setup

### 1. Environment Variables

Add to `.env.local` or deployment environment:

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=$(git rev-parse --short HEAD)  # Git commit SHA
```

### 2. Initialize on Server Startup

In `app/api/[...]/route.ts` or your entry point:

```typescript
import { initSentry, setUserContext } from '@/lib/sentry-init';

// Initialize Sentry once
initSentry();

// After user authentication
setUserContext(user.id, user.email, user.name);
```

## Usage Examples

### Basic Error Capturing

```typescript
import { captureException, captureMessage } from '@/lib/sentry-init';

try {
  // Your code
} catch (err) {
  captureException(err, { userId: 'user123', operation: 'create-team' });
}
```

### Instrumenting API Routes

Use `withObservability` wrapper for automatic error handling and performance monitoring:

```typescript
import { withObservability } from '@/lib/observability-middleware';
import { successResponse } from '@/lib/api-response';

export const GET = withObservability('GET /api/teams', async (request) => {
  // Your handler code
  // Errors are automatically captured, requests are logged, performance is tracked
  return successResponse({ teams: [] });
});
```

### Performance Monitoring

```typescript
import { monitorDatabaseQuery } from '@/lib/observability-middleware';

const profile = await monitorDatabaseQuery('fetch-profile', async () => {
  const { data } = await supabase.from('user_profiles').select('*').single();
  return data;
}, { slowThresholdMs: 500 });
```

### Tracking Custom Events

```typescript
import { trackEvent } from '@/lib/observability-middleware';

// Track important user actions
trackEvent('team-created', { teamId: 'team123', name: 'Engineering' });
trackEvent('invitation-accepted', { invitationId: 'inv456' });
```

### Adding Context to Errors

```typescript
import { addBreadcrumb } from '@/lib/sentry-init';

// Add breadcrumbs for debugging
addBreadcrumb('User logged in', { userId: 'user123' }, 'info');
addBreadcrumb('Processing payment', { amount: 100, currency: 'USD' }, 'info');
addBreadcrumb('Payment failed', { error: 'Card declined' }, 'error');
```

## Key Metrics to Monitor

### 1. Error Rate

- API endpoint error rates
- Database connection failures
- Email delivery failures
- OAuth failures

### 2. Performance Metrics

- API response times (p50, p95, p99)
- Database query times
- Email processing time
- Slow requests (>1s)

### 3. Business Metrics

- Team invitations sent/accepted
- Commitments completed
- User registration/onboarding
- Feature usage

## Sentry Dashboard

1. **Issues**: Grouped errors with stack traces
2. **Performance**: Response times, slow endpoints
3. **Releases**: Track errors per git release
4. **Alerts**: Automatic alerts for high error rates

## Integration Points

### Critical Routes to Instrument

1. **Authentication**
   - `/api/auth/me`
   - `/api/profile`

2. **Team Management**
   - `/api/teams` (POST)
   - `/api/teams/[id]/members` (POST)
   - `/api/teams/invitations/accept` (POST)

3. **Data Operations**
   - `/api/tasks` (CRUD)
   - `/api/commitments/bulk` (batch update)
   - `/api/meetings` (POST)

4. **Email/Notifications**
   - `/api/email/send`
   - `/api/cron/email-queue`
   - `/api/cron/reminders`

5. **Integrations**
   - `/api/integrations/sync`
   - `/api/integrations/oauth/callback`

## Best Practices

### ✅ DO

- Capture exceptions with context
- Add breadcrumbs for important state changes
- Monitor slow queries (>500ms for DB, >1s for API)
- Track user actions for user analytics
- Use `setUserContext` after authentication

### ❌ DON'T

- Log sensitive data (passwords, tokens, PII) in Sentry
- Capture every single request (sample at 10% in production)
- Add too many breadcrumbs (limit to ~50 before send)
- Capture frontend errors in the same DSN (use separate key)

## Sample Configuration

```typescript
// app/api/teams/route.ts
import { withObservability } from '@/lib/observability-middleware';
import { successResponse, createdResponse, validationError } from '@/lib/api-response';
import { CreateTeamSchema, validateRequest } from '@/lib/validation-schemas';

export const POST = withObservability(
  'POST /api/teams',
  async (request) => {
    const body = await request.json();
    
    // Validation
    const validation = validateRequest(CreateTeamSchema, body);
    if (!validation.valid) {
      return validationError(validation.error);
    }

    // Your business logic
    const team = await createTeam(validation.data);

    return createdResponse(team);
  },
  {
    captureErrors: true,
    capturePerformance: true,
    slowThresholdMs: 1000,
  }
);
```

## Troubleshooting

### Sentry Not Capturing Errors

1. Check `NEXT_PUBLIC_SENTRY_DSN` is set
2. Verify DNS is valid format: `https://<key>@<org>.ingest.sentry.io/<project>`
3. Check network tab for requests to `*.ingest.sentry.io`
4. Ensure `initSentry()` is called on startup

### Too Many Events

- Increase `tracesSampleRate` to 10% or 5% in production
- Use `beforeSend` to filter noise
- Check for error loops (catch-rethrow patterns)

### Missing User Context

- Call `setUserContext()` after authentication
- Include user ID in error context
- Use breadcrumbs to track user journey

## References

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Breadcrumbs](https://docs.sentry.io/platforms/javascript/enriching-events/breadcrumbs/)
