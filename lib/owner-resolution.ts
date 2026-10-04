/**
 * Owner Resolution Service
 *
 * Resolves AI-extracted owner names to actual organization users.
 * Never searches globally; always scoped to authenticated organization.
 * Uses conservative matching: prioritizes exact matches over fuzzy guessing.
 *
 * Matching hierarchy:
 * 1. Exact full-name match (case-insensitive, normalized)
 * 2. First name + last name initial match
 * 3. Unique partial match (only if unambiguous)
 * 4. Fuzzy match (only when confidence sufficiently high)
 *
 * Returns structured result instead of simple UUID.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type OwnerResolutionStatus = 'resolved' | 'ambiguous' | 'unresolved';

export interface OwnerCandidate {
  userId: string;
  displayName: string;
  fullName?: string;
  jobTitle?: string;
  matchConfidence: number; // 0.0-1.0
  matchReason: string; // e.g., "exact_full_name", "fuzzy_first_name"
}

export interface OwnerResolutionResult {
  status: OwnerResolutionStatus;
  userId?: string; // Set if resolved
  displayName?: string; // Set if resolved
  candidates?: OwnerCandidate[]; // Set if ambiguous
  confidence?: number; // 0.0-1.0, set if resolved
  reason?: string; // Explanation of result
}

// Normalize names for comparison
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/[.,\-]/g, ''); // remove harmless punctuation
}

// Extract first and last name components
interface NameComponents {
  first: string;
  last: string;
  full: string;
}

function parseNameComponents(fullName: string): NameComponents {
  const parts = fullName.trim().split(/\s+/);
  return {
    first: parts[0] || '',
    last: parts[parts.length - 1] || '',
    full: fullName.trim(),
  };
}

// Score exact match
function scoreExactMatch(extracted: string, candidate: string): number {
  const extNorm = normalizeName(extracted);
  const candNorm = normalizeName(candidate);

  if (extNorm === candNorm) return 1.0; // Perfect match
  return 0.0;
}

// Score first name + last initial match (e.g., "Akash R" vs "Akash Kumar")
function scoreFirstPlusLastInitial(extracted: string, candidate: string): number {
  const extParts = parseNameComponents(extracted);
  const candParts = parseNameComponents(candidate);

  const extFirstNorm = normalizeName(extParts.first);
  const extLastNorm = normalizeName(extParts.last);
  const candFirstNorm = normalizeName(candParts.first);
  const candLastNorm = normalizeName(candParts.last);

  // Check if first names match exactly
  if (extFirstNorm !== candFirstNorm) return 0.0;

  // Check if last initial matches (or last name matches)
  const extLastInitial = extLastNorm.charAt(0);
  const candLastInitial = candLastNorm.charAt(0);

  if (extLastInitial && extLastInitial === candLastInitial) {
    // Strong match: first name + last initial
    return 0.95;
  }

  return 0.0;
}

// Score first name only match
function scoreFirstNameOnly(extracted: string, candidate: string): number {
  const extParts = parseNameComponents(extracted);
  const candParts = parseNameComponents(candidate);

  const extFirstNorm = normalizeName(extParts.first);
  const candFirstNorm = normalizeName(candParts.first);

  if (extFirstNorm && extFirstNorm === candFirstNorm) {
    return 0.7; // Moderate match, but could be ambiguous
  }

  return 0.0;
}

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const aNorm = normalizeName(a);
  const bNorm = normalizeName(b);

  if (aNorm === bNorm) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= bNorm.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= aNorm.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bNorm.length; i++) {
    for (let j = 1; j <= aNorm.length; j++) {
      const cost = aNorm[j - 1] === bNorm[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j] + 1, // deletion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[bNorm.length][aNorm.length];
}

// Score fuzzy match based on Levenshtein distance
function scoreFuzzyMatch(extracted: string, candidate: string): number {
  const maxLen = Math.max(extracted.length, candidate.length);
  if (maxLen === 0) return 1.0; // Both empty

  const distance = levenshteinDistance(extracted, candidate);
  const similarity = 1.0 - distance / maxLen;

  // Only consider fuzzy match if similarity > 0.75
  if (similarity > 0.75) {
    return similarity * 0.6; // Reduce confidence for fuzzy matches
  }

  return 0.0;
}

// Score a candidate against extracted owner
function scoreCandidate(
  extractedOwner: string,
  candidateFullName: string,
  candidateDisplayName: string,
): { score: number; reason: string } {
  // Try exact match on full name
  let score = scoreExactMatch(extractedOwner, candidateFullName);
  if (score > 0.9) return { score, reason: 'exact_full_name' };

  // Try exact match on display name
  score = scoreExactMatch(extractedOwner, candidateDisplayName);
  if (score > 0.9) return { score, reason: 'exact_display_name' };

  // Try first + last initial
  score = scoreFirstPlusLastInitial(extractedOwner, candidateFullName);
  if (score > 0.9) return { score, reason: 'first_plus_last_initial' };

  // Try first name only
  score = scoreFirstNameOnly(extractedOwner, candidateFullName);
  if (score > 0.6) return { score, reason: 'first_name_match' };

  // Try fuzzy match as last resort
  score = scoreFuzzyMatch(extractedOwner, candidateFullName);
  if (score > 0.0) return { score, reason: 'fuzzy_match' };

  return { score: 0.0, reason: 'no_match' };
}

/**
 * Resolve extracted owner name to organization user.
 * Returns structured result; never silently assigns on ambiguous match.
 *
 * @param supabase - Authenticated Supabase client
 * @param extractedOwner - Owner name extracted by AI
 * @param organizationId - Organization to search within
 * @returns Structured resolution result
 */
export async function resolveOwnerToUser(
  supabase: SupabaseClient,
  extractedOwner: string,
  organizationId: string,
): Promise<OwnerResolutionResult> {
  // Validate inputs
  if (!extractedOwner || !extractedOwner.trim()) {
    return {
      status: 'unresolved',
      reason: 'Empty owner name provided',
    };
  }

  if (!organizationId) {
    return {
      status: 'unresolved',
      reason: 'No organization context provided',
    };
  }

  const cleanOwner = extractedOwner.trim();

  // Special case: "Unassigned" collective commitments
  if (cleanOwner.toLowerCase() === 'unassigned') {
    return {
      status: 'unresolved',
      reason: 'Collective commitment (Unassigned); requires manual owner selection',
    };
  }

  try {
    // Fetch all organization members with their profiles
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select(
        `
        id,
        user_id,
        user_profiles!inner(
          id,
          display_name,
          full_name,
          job_title
        )
      `,
      )
      .eq('organization_id', organizationId)
      .eq('user_profiles.id', 'user_id'); // Join hint

    if (membersError) {
      console.error('[owner-resolution] Failed to fetch org members:', membersError);
      return {
        status: 'unresolved',
        reason: 'Failed to search organization members',
      };
    }

    if (!members || members.length === 0) {
      return {
        status: 'unresolved',
        reason: 'Organization has no members',
      };
    }

    // Score all candidates
    const scoredCandidates: OwnerCandidate[] = [];

    for (const member of members) {
      const profiles = member.user_profiles as Array<{ id: string; display_name: string; full_name: string; job_title: string }>;
      const profile = profiles && profiles.length > 0 ? profiles[0] : null;
      if (!profile) continue;

      const { score, reason } = scoreCandidate(
        cleanOwner,
        profile.full_name || '',
        profile.display_name || '',
      );

      if (score > 0.0) {
        scoredCandidates.push({
          userId: member.user_id,
          displayName: profile.display_name || profile.full_name || 'Unknown',
          fullName: profile.full_name,
          jobTitle: profile.job_title,
          matchConfidence: score,
          matchReason: reason,
        });
      }
    }

    // Sort by confidence descending
    scoredCandidates.sort((a, b) => b.matchConfidence - a.matchConfidence);

    // Analyze results
    if (scoredCandidates.length === 0) {
      return {
        status: 'unresolved',
        reason: `No organization members match owner name "${cleanOwner}"`,
      };
    }

    if (scoredCandidates.length === 1) {
      // Single clear match
      const candidate = scoredCandidates[0];
      return {
        status: 'resolved',
        userId: candidate.userId,
        displayName: candidate.displayName,
        confidence: candidate.matchConfidence,
        reason: `Resolved to ${candidate.displayName} (${candidate.matchReason})`,
      };
    }

    // Multiple candidates: check if there's a clear leader
    const topConfidence = scoredCandidates[0].matchConfidence;
    const secondConfidence = scoredCandidates[1].matchConfidence;

    // If top candidate is clearly better (gap > 0.15), resolve to it
    if (topConfidence > 0.9 && topConfidence - secondConfidence > 0.15) {
      const candidate = scoredCandidates[0];
      return {
        status: 'resolved',
        userId: candidate.userId,
        displayName: candidate.displayName,
        confidence: candidate.matchConfidence,
        reason: `Resolved to ${candidate.displayName} (clear best match)`,
      };
    }

    // Otherwise, ambiguous: require human review
    return {
      status: 'ambiguous',
      candidates: scoredCandidates.slice(0, 5), // Top 5 candidates
      reason: `${scoredCandidates.length} possible matches for "${cleanOwner}"; human review required`,
    };
  } catch (err) {
    console.error('[owner-resolution] Unexpected error:', err);
    return {
      status: 'unresolved',
      reason: 'Unexpected error during owner resolution',
    };
  }
}

/**
 * Search organization members by name fragment.
 * Used for manual owner selection UI.
 *
 * @param supabase - Authenticated Supabase client
 * @param organizationId - Organization to search within
 * @param nameFragment - Name fragment to search for
 * @returns Matching members
 */
export async function searchOrgMembersByName(
  supabase: SupabaseClient,
  organizationId: string,
  nameFragment: string,
): Promise<
  Array<{
    userId: string;
    displayName: string;
    fullName: string;
    jobTitle?: string;
  }>
> {
  if (!nameFragment || !nameFragment.trim()) {
    return [];
  }

  try {
    const { data: members, error } = await supabase
      .from('organization_members')
      .select(
        `
        user_id,
        user_profiles!inner(
          id,
          display_name,
          full_name,
          job_title
        )
      `,
      )
      .eq('organization_id', organizationId);

    if (error || !members) {
      console.error('[owner-resolution] Search error:', error);
      return [];
    }

    const fragment = nameFragment.toLowerCase().trim();
    const results = [];

    for (const member of members) {
      const profiles = member.user_profiles as Array<{ id: string; display_name: string; full_name: string; job_title: string }>;
      const profile = profiles && profiles.length > 0 ? profiles[0] : null;
      if (!profile) continue;

      const displayLower = (profile.display_name || '').toLowerCase();
      const fullLower = (profile.full_name || '').toLowerCase();

      if (displayLower.includes(fragment) || fullLower.includes(fragment)) {
        results.push({
          userId: member.user_id,
          displayName: profile.display_name || profile.full_name || 'Unknown',
          fullName: profile.full_name || '',
          jobTitle: profile.job_title,
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[owner-resolution] Search error:', err);
    return [];
  }
}
