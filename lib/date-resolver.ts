/**
 * Date Resolution Utility for FollowThru
 * 
 * Resolves relative date expressions based on a meeting date.
 * All dates are calculated in local time without timezone conversions.
 */

export type RelativeDateExpression = 
  | 'tomorrow'
  | 'day after tomorrow'
  | 'end of week'
  | string; // Weekday names, "next Monday", "in N days", etc.

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Get the date for a specific day of week, moving forward from the reference date
 */
function getNextWeekday(referenceDate: Date, targetDay: number): Date {
  const current = getDayOfWeek(referenceDate);
  let daysToAdd = targetDay - current;
  
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Move to next week if target day has passed
  }
  
  return addDays(referenceDate, daysToAdd);
}

/**
 * Get the date for a specific weekday in the FOLLOWING calendar week
 * "next Monday" from Tuesday means the Monday of next week (at least 6 days away)
 * "next Monday" from Friday means the Monday after next (at least 10 days away)
 * Rule: "next <weekday>" must be at least 6 days in the future
 */
function getFollowingWeekday(referenceDate: Date, targetDay: number): Date {
  // Find next Sunday (start of next week)
  const currentDay = getDayOfWeek(referenceDate);
  const daysUntilNextSunday = 7 - currentDay;
  const nextSunday = addDays(referenceDate, daysUntilNextSunday);
  
  // From next Sunday, get to the target weekday
  const candidateDate = addDays(nextSunday, targetDay);
  
  // Calculate days between reference and candidate
  const daysDiff = Math.round((candidateDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // If the candidate is less than 6 days away, add another week
  if (daysDiff < 6) {
    return addDays(candidateDate, 7);
  }
  
  return candidateDate;
}

/**
 * Add days to a date (in local time, no timezone shifts)
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get Friday of the current week (or next Friday if meeting is on/after Friday)
 */
function getEndOfWeek(referenceDate: Date): Date {
  const dayOfWeek = getDayOfWeek(referenceDate);
  const friday = 5; // Friday
  
  let daysToAdd = friday - dayOfWeek;
  
  if (daysToAdd <= 0) {
    // If it's Friday, Saturday, or Sunday, return next Friday
    daysToAdd += 7;
  }
  
  return addDays(referenceDate, daysToAdd);
}

/**
 * Map weekday names to numbers (0 = Sunday, 6 = Saturday)
 */
const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Map spelled-out numbers to digits
 * Supports "one", "two", "three", etc.
 */
const NUMBER_WORDS: Record<string, number> = {
  'zero': 0,
  'one': 1,
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'nine': 9,
  'ten': 10,
  'eleven': 11,
  'twelve': 12,
  'thirteen': 13,
  'fourteen': 14,
  'fifteen': 15,
  'sixteen': 16,
  'seventeen': 17,
  'eighteen': 18,
  'nineteen': 19,
  'twenty': 20,
  'thirty': 30,
};

/**
 * Convert a number string (digit or word) to a number
 * @param numStr - "3", "three", etc.
 * @returns The numeric value or null if unrecognized
 */
function parseNumberString(numStr: string): number | null {
  // Try parsing as digit first
  const digit = parseInt(numStr, 10);
  if (!isNaN(digit)) {
    return digit;
  }
  
  // Try parsing as word
  const word = numStr.toLowerCase();
  if (word in NUMBER_WORDS) {
    return NUMBER_WORDS[word];
  }
  
  return null;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Main resolver function
 * 
 * @param expression - The relative date expression (e.g., "tomorrow", "next Monday", "in 2 weeks")
 * @param meetingDate - The meeting date to use as reference
 * @returns YYYY-MM-DD string or null if expression cannot be resolved
 */
export function resolveDateExpression(
  expression: string | null | undefined,
  meetingDate: Date
): string | null {
  if (!expression || expression.trim() === '') {
    return null;
  }
  
  const normalized = expression.toLowerCase().trim();
  
  // Handle "tomorrow"
  if (normalized === 'tomorrow') {
    return formatDate(addDays(meetingDate, 1));
  }
  
  // Handle "day after tomorrow"
  if (normalized === 'day after tomorrow') {
    return formatDate(addDays(meetingDate, 2));
  }
  
  // Handle "end of week" or "end of the week"
  if (normalized.includes('end of') && normalized.includes('week')) {
    return formatDate(getEndOfWeek(meetingDate));
  }
  
  // Handle "in N days" (supports both numeric: "in 3 days" and spelled-out: "in three days")
  const inDaysMatch = normalized.match(/^in\s+(\d+|\w+)\s+days?$/);
  if (inDaysMatch) {
    const numValue = parseNumberString(inDaysMatch[1]);
    if (numValue !== null) {
      return formatDate(addDays(meetingDate, numValue));
    }
  }
  
  // Handle "in N weeks" (supports both numeric: "in 2 weeks" and spelled-out: "in two weeks")
  const inWeeksMatch = normalized.match(/^in\s+(\d+|\w+)\s+weeks?$/);
  if (inWeeksMatch) {
    const numValue = parseNumberString(inWeeksMatch[1]);
    if (numValue !== null) {
      return formatDate(addDays(meetingDate, numValue * 7));
    }
  }
  
  // Handle "in a week" or "in a day"
  if (normalized === 'in a week') {
    return formatDate(addDays(meetingDate, 7));
  }
  if (normalized === 'in a day') {
    return formatDate(addDays(meetingDate, 1));
  }
  
  // Handle "in a couple of days"
  if (normalized.includes('couple') && normalized.includes('days')) {
    return formatDate(addDays(meetingDate, 2));
  }
  
  // Handle "in a couple of weeks"
  if (normalized.includes('couple') && normalized.includes('weeks')) {
    return formatDate(addDays(meetingDate, 14));
  }
  
  // Handle "next <weekday>" (e.g., "next Monday", "next Friday")
  const nextWeekdayMatch = normalized.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (nextWeekdayMatch) {
    const weekdayName = nextWeekdayMatch[1];
    const targetDay = WEEKDAY_MAP[weekdayName];
    return formatDate(getFollowingWeekday(meetingDate, targetDay));
  }
  
  // Handle plain weekday (e.g., "Monday", "Friday")
  const plainWeekdayMatch = normalized.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (plainWeekdayMatch) {
    const weekdayName = plainWeekdayMatch[1];
    const targetDay = WEEKDAY_MAP[weekdayName];
    return formatDate(getNextWeekday(meetingDate, targetDay));
  }
  
  // Handle "by <weekday>" or "before <weekday>"
  const byWeekdayMatch = normalized.match(/^(?:by|before)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (byWeekdayMatch) {
    const weekdayName = byWeekdayMatch[1];
    const targetDay = WEEKDAY_MAP[weekdayName];
    return formatDate(getNextWeekday(meetingDate, targetDay));
  }
  
  // Handle "by next <weekday>" or "before next <weekday>"
  const byNextWeekdayMatch = normalized.match(/^(?:by|before)\s+next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (byNextWeekdayMatch) {
    const weekdayName = byNextWeekdayMatch[1];
    const targetDay = WEEKDAY_MAP[weekdayName];
    return formatDate(getFollowingWeekday(meetingDate, targetDay));
  }
  
  // Handle "by end of month" or "end of month"
  if (normalized.includes('end of') && normalized.includes('month')) {
    // Check if it's "end of next month"
    if (normalized.includes('next month')) {
      const currentYear = meetingDate.getFullYear();
      const currentMonth = meetingDate.getMonth();
      // Get last day of next month (month + 2 because we want the month AFTER next)
      const lastDay = new Date(currentYear, currentMonth + 2, 0);
      return formatDate(lastDay);
    } else {
      // Regular "end of month"
      const currentYear = meetingDate.getFullYear();
      const currentMonth = meetingDate.getMonth();
      // Get last day of current month
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      return formatDate(lastDay);
    }
  }

  // Handle "by next month" or similar (defaults to 1st of next month)
  if (normalized.includes('next month') && !normalized.includes('end of')) {
    const currentYear = meetingDate.getFullYear();
    const currentMonth = meetingDate.getMonth();
    const nextMonth = new Date(currentYear, currentMonth + 1, 1);
    return formatDate(nextMonth);
  }

  // Handle "by end of next month" (redundant check, but kept for clarity)
  if (normalized.includes('end of next month')) {
    const currentYear = meetingDate.getFullYear();
    const currentMonth = meetingDate.getMonth();
    // Get last day of next month
    const lastDay = new Date(currentYear, currentMonth + 2, 0);
    return formatDate(lastDay);
  }

  // Handle month names with "by" prefix (e.g., "by October 15", "by December 25")
  // Supports: "by Month Day", "by October 15", "by December 25", "Friday, October 5", "October 7"
  const monthNameMatch = normalized.match(/^(?:by|before)?\s*(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})$/);
  if (monthNameMatch) {
    const monthName = monthNameMatch[1];
    const day = parseInt(monthNameMatch[2], 10);
    
    const monthMap: Record<string, number> = {
      january: 0,
      february: 1,
      march: 2,
      april: 3,
      may: 4,
      june: 5,
      july: 6,
      august: 7,
      september: 8,
      october: 9,
      november: 10,
      december: 11,
    };
    
    const month = monthMap[monthName];
    if (month !== undefined && day >= 1 && day <= 31) {
      const year = meetingDate.getFullYear();
      // Create the target date and validate it's real (e.g., not Feb 30)
      const targetDate = new Date(year, month, day);
      // Validate the date actually exists (JS auto-wraps invalid dates)
      if (targetDate.getMonth() !== month) {
        // Invalid date like Feb 30
        return null;
      }
      // If the date has already passed this year, use next year
      if (targetDate < meetingDate) {
        targetDate.setFullYear(year + 1);
      }
      return formatDate(targetDate);
    }
  }

  // Handle numeric date formats (e.g., "by 10/15", "10/20", "by 10/20/2026")
  // Supports: M/D, MM/DD, MM/DD/YYYY, "by" prefix optional
  const numericDateMatch = normalized.match(/^(?:by|before)?\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (numericDateMatch) {
    const month = parseInt(numericDateMatch[1], 10) - 1; // JS months are 0-indexed
    const day = parseInt(numericDateMatch[2], 10);
    const year = numericDateMatch[3] ? parseInt(numericDateMatch[3], 10) : meetingDate.getFullYear();
    
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const targetDate = new Date(year, month, day);
      // Validate the date actually exists
      if (targetDate.getMonth() !== month) {
        // Invalid date like Feb 30
        return null;
      }
      // If no year specified and date has passed, use next year
      if (!numericDateMatch[3] && targetDate < meetingDate) {
        targetDate.setFullYear(year + 1);
      }
      return formatDate(targetDate);
    }
  }

  // Handle ISO date format if not already caught (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  
  // Cannot resolve - return null
  return null;
}

/**
 * Validate a due date string
 * 
 * @param dateString - The date string to validate (YYYY-MM-DD)
 * @returns true if valid, false otherwise
 */
export function isValidDateString(dateString: string | null): boolean {
  if (!dateString) return false;
  
  const date = new Date(dateString + 'T00:00:00');
  return !isNaN(date.getTime());
}

/**
 * Check if a date expression indicates a dependency (no fixed date)
 */
export function isDependencyExpression(expression: string | null | undefined): boolean {
  if (!expression) return false;
  
  const normalized = expression.toLowerCase();
  
  // Dependency indicators
  const dependencyKeywords = [
    'once',
    'after',
    'when',
    'pending',
    'waiting for',
    'depends on',
  ];
  
  return dependencyKeywords.some(keyword => normalized.includes(keyword));
}
