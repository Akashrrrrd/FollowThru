/**
 * Centralized Zod validation schemas for request bodies and critical inputs.
 * Use these in API routes to validate incoming data before processing.
 */

import { z } from 'zod';

// ============================================================================
// TEAM MANAGEMENT SCHEMAS
// ============================================================================

export const TeamNameSchema = z
  .string()
  .min(1, 'Team name is required')
  .max(100, 'Team name must be 100 characters or less')
  .trim()
  .regex(/^[a-zA-Z0-9\s\-_&()]+$/, 'Team name contains invalid characters');

export const CreateTeamSchema = z.object({
  name: TeamNameSchema,
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
});

export const UpdateTeamMemberSchema = z.object({
  role: z.enum(['team_lead', 'member'], {
    errorMap: () => ({ message: 'Role must be team_lead or member' }),
  }),
});

export const AddTeamMemberSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or less')
    .toLowerCase()
    .optional(),
  userId: z
    .string()
    .uuid('Invalid user ID format')
    .optional(),
  role: z.enum(['team_lead', 'member'], {
    errorMap: () => ({ message: 'Role must be team_lead or member' }),
  }),
}).refine(
  (data) => data.email || data.userId,
  { message: 'Either email or userId is required' }
);

// ============================================================================
// TASK & COMMITMENT SCHEMAS
// ============================================================================

export const TaskDescriptionSchema = z
  .string()
  .min(1, 'Task description is required')
  .max(2000, 'Task description must be 2000 characters or less')
  .trim();

export const CreateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),
  description: TaskDescriptionSchema.optional(),
  dueDate: z
    .string()
    .datetime()
    .optional(),
  assigneeId: z
    .string()
    .uuid('Invalid assignee ID')
    .optional(),
  teamId: z
    .string()
    .uuid('Invalid team ID'),
});

export const UpdateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim()
    .optional(),
  description: TaskDescriptionSchema.optional(),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'archived'])
    .optional(),
  dueDate: z
    .string()
    .datetime()
    .optional(),
  assigneeId: z
    .string()
    .uuid('Invalid assignee ID')
    .nullable()
    .optional(),
});

export const BulkUpdateTasksSchema = z.object({
  taskIds: z
    .array(z.string().uuid('Invalid task ID'))
    .min(1, 'At least one task ID is required')
    .max(100, 'Cannot update more than 100 tasks at once'),
  updates: z.object({
    status: z.enum(['pending', 'in_progress', 'completed', 'archived']).optional(),
    assigneeId: z.string().uuid('Invalid assignee ID').nullable().optional(),
  }),
});

export const CreateCommitmentSchema = z.object({
  title: z
    .string()
    .min(1, 'Commitment title is required')
    .max(300, 'Title must be 300 characters or less')
    .trim(),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .trim()
    .optional(),
  dueDate: z.string().datetime('Invalid date format').optional(),
  assigneeIds: z
    .array(z.string().uuid('Invalid assignee ID'))
    .optional(),
});

// ============================================================================
// SEARCH & QUERY SCHEMAS
// ============================================================================

export const SearchUserSchema = z.object({
  q: z
    .string()
    .min(2, 'Search query must be at least 2 characters')
    .max(100, 'Search query must be 100 characters or less')
    .trim()
    .regex(
      /^[\w\s\-@.]+$/,
      'Search contains invalid characters'
    ),
  limit: z
    .coerce.number()
    .min(1)
    .max(50)
    .default(10),
});

export const PaginationSchema = z.object({
  page: z
    .number()
    .min(1)
    .optional()
    .default(1),
  pageSize: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(20),
});

// ============================================================================
// USER PROFILE SCHEMAS
// ============================================================================

export const UpdateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be 100 characters or less')
    .trim()
    .optional(),
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(255, 'Full name must be 255 characters or less')
    .trim()
    .optional(),
  jobTitle: z
    .string()
    .max(100, 'Job title must be 100 characters or less')
    .trim()
    .nullable()
    .optional(),
  bio: z
    .string()
    .max(500, 'Bio must be 500 characters or less')
    .trim()
    .nullable()
    .optional(),
  phone: z
    .string()
    .max(20, 'Phone must be 20 characters or less')
    .regex(/^[\d\-\s\+\(\)]+$/, 'Invalid phone format')
    .nullable()
    .optional(),
});

// ============================================================================
// USER PREFERENCES SCHEMAS
// ============================================================================

export const TimeFormatSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
  .refine(
    (time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
    },
    { message: 'Invalid time value' }
  );

export const UpdateUserPreferencesSchema = z.object({
  emailNotificationsEnabled: z.boolean().optional(),
  emailDigestEnabled: z.boolean().optional(),
  emailDigestTime: TimeFormatSchema.optional(),
  notificationFrequency: z
    .enum(['instant', 'daily', 'weekly'])
    .optional(),
  theme: z
    .enum(['light', 'dark', 'auto'])
    .optional(),
});

// ============================================================================
// MEETING SCHEMAS
// ============================================================================

export const CreateMeetingSchema = z.object({
  title: z
    .string()
    .min(1, 'Meeting title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),
  description: z
    .string()
    .max(2000, 'Description must be 2000 characters or less')
    .trim()
    .optional(),
  startTime: z.string().datetime('Invalid start time'),
  endTime: z.string().datetime('Invalid end time').optional(),
  participantIds: z
    .array(z.string().uuid('Invalid participant ID'))
    .optional(),
  teamId: z.string().uuid('Invalid team ID').optional(),
});

// ============================================================================
// NOTIFICATION SCHEMAS
// ============================================================================

export const EmailNotificationSchema = z.object({
  recipientEmail: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or less'),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be 200 characters or less')
    .trim(),
  html: z
    .string()
    .max(50000, 'Email body is too large'),
  text: z
    .string()
    .max(50000, 'Email text is too large')
    .optional(),
});

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

export const WebhookPayloadSchema = z.object({
  event: z
    .string()
    .min(1)
    .max(100),
  timestamp: z.string().datetime().optional(),
  data: z.record(z.any()).optional(),
});

// ============================================================================
// UTILITY FUNCTION: Validation wrapper
// ============================================================================

/**
 * Validate request body against a Zod schema.
 * Returns { valid: true, data } or { valid: false, error: string }
 */
export function validateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { valid: true; data: z.infer<T> } | { valid: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  const errors = result.error.errors
    .map((err) => `${err.path.join('.')}: ${err.message}`)
    .join('; ');
  
  return { valid: false, error: errors };
}
