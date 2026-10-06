/**
 * Cached Query Helpers
 *
 * High-level helpers for caching common queries.
 * These handle cache invalidation patterns and provide consistent TTLs.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CacheService } from '@/lib/cache-service';
import { getUserTeamContext } from '@/lib/team-context';

export interface CachedQueryHelpers {
  getProfile: (userId: string) => Promise<any>;
  getTeamContext: (userId: string, orgId: string) => Promise<any>;
  getTeams: (orgId: string) => Promise<any[]>;
  invalidateProfileCache: (userId: string) => Promise<void>;
  invalidateTeamContextCache: (userId: string, orgId: string) => Promise<void>;
  invalidateTeamsCache: (orgId: string) => Promise<void>;
}

export function createCachedQueryHelpers(
  supabase: SupabaseClient,
  cache: CacheService
): CachedQueryHelpers {
  return {
    /**
     * Get user profile with 5-minute cache.
     * Invalidate on profile update.
     */
    async getProfile(userId: string) {
      return cache.getOrFetch(
        `profile:${userId}`,
        async () => {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (error) throw error;
          return data;
        },
        300 // 5 minutes
      );
    },

    /**
     * Get user's team context (teams in org) with 5-minute cache.
     * Invalidate when user joins/leaves team or org.
     */
    async getTeamContext(userId: string, orgId: string) {
      return cache.getOrFetch(
        `team-context:${userId}:${orgId}`,
        async () => {
          return await getUserTeamContext(supabase, userId, orgId);
        },
        300 // 5 minutes
      );
    },

    /**
     * Get all teams in org with 5-minute cache.
     * Invalidate when team is created/deleted.
     */
    async getTeams(orgId: string) {
      return cache.getOrFetch(
        `teams:${orgId}`,
        async () => {
          const { data, error } = await supabase
            .from('teams')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: true });

          if (error) throw error;
          return data || [];
        },
        300 // 5 minutes
      );
    },

    /**
     * Invalidate user's profile cache.
     * Call this after profile update.
     */
    async invalidateProfileCache(userId: string) {
      await cache.invalidate(`profile:${userId}`);
    },

    /**
     * Invalidate user's team context cache.
     * Call this after team membership changes.
     */
    async invalidateTeamContextCache(userId: string, orgId: string) {
      await cache.invalidate(`team-context:${userId}:${orgId}`);
    },

    /**
     * Invalidate organization's teams cache.
     * Call this after team create/delete.
     */
    async invalidateTeamsCache(orgId: string) {
      await cache.invalidate(`teams:${orgId}`);
    },
  };
}
