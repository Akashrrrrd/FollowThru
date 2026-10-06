/**
 * Rate Limiter
 *
 * Simple in-memory rate limiting for sensitive endpoints.
 * Tracks requests per IP/user to prevent abuse.
 *
 * For production, consider: Redis-based rate limiting, distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request should be allowed
   * Returns: { allowed: boolean, retryAfter?: number }
   */
  check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    // No entry or window expired
    if (!entry || now > entry.resetAt) {
      this.limits.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return { allowed: true };
    }

    // Increment counter
    entry.count++;

    // Check if limit exceeded
    if (entry.count > this.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  /**
   * Reset a key (e.g., after successful auth)
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.limits.entries());
    for (const [key, entry] of entries) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Get current stats (for testing)
   */
  getStats(key: string): RateLimitEntry | null {
    return this.limits.get(key) || null;
  }
}

// Create singleton instances for different endpoints
export const userSearchLimiter = new RateLimiter(60000, 10); // 10 requests/min
export const invitationAcceptLimiter = new RateLimiter(60000, 5); // 5 attempts/min
export const profileUpdateLimiter = new RateLimiter(60000, 30); // 30 updates/min
export const authLimiter = new RateLimiter(300000, 5); // 5 attempts/5 min (brute-force protection)

/**
 * Extract client IP from request
 */
export function getClientIp(request: Request): string {
  // Try common header patterns
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback - this won't work in serverless but better than nothing
  return 'unknown';
}

/**
 * Create a rate limit key: ip + endpoint
 */
export function makeRateLimitKey(ip: string, endpoint: string): string {
  return `${ip}:${endpoint}`;
}

/**
 * Create a rate limit key for authenticated user
 */
export function makeUserRateLimitKey(userId: string, endpoint: string): string {
  return `user:${userId}:${endpoint}`;
}
