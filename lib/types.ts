export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'overdue' | 'done';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type CommitmentType = 'explicit' | 'collective' | 'acceptance';
export type HistoryChangeType = 'created' | 'status_changed' | 'date_changed' | 'blocked' | 'unblocked' | 'completed' | 'updated';

// Phase 4: Commitment Continuity Types
export type ContinuityStatus = 'new' | 'continued' | 'completed' | 'blocked' | 'rescheduled' | 'updated' | 'overdue';
export type ContinuityEventType = 'linked' | 'updated' | 'completed' | 'rescheduled' | 'blocked' | 'unblocked' | 'progress';

// Phase 3: User Identity & Profile
export interface UserProfile {
  id: string; // UUID from auth.users
  full_name: string;
  display_name: string;
  job_title?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurrentUser extends UserProfile {
  email: string; // From auth.users
}

export interface CommitmentContinuity {
  parent_commitment_id: string | null;
  continuity_status: ContinuityStatus | null;
  continuity_confidence: ConfidenceLevel | null;
  merged_with_task_id: string | null;
}

export interface ContinuityEvidence {
  signals: string[]; // ["same_owner", "similar_description", "follow_up_language"]
  signal_scores: Record<string, number>; // {"same_owner": 0.9, ...}
  final_score: number; // 0.0 to 1.0
  reasoning: string;
}

export interface ContinuityEvent {
  id: string;
  parent_task_id: string;
  child_task_id: string;
  event_type: ContinuityEventType;
  confidence: ConfidenceLevel;
  evidence: ContinuityEvidence;
  source_quote_original: string;
  source_quote_followup: string;
  meeting_original_id: string;
  meeting_followup_id: string;
  created_at: string;
}

export interface Task {
  id: string;
  meeting_id: string;
  user_id: string;
  description: string;
  owner: string;
  owner_user_id?: string | null; // Phase 3: UUID of the authenticated user who owns this commitment
  due_date: string | null;
  source_quote: string;
  status: TaskStatus;
  created_at: string;
  // Phase 1: Commitment Accountability fields
  confidence?: ConfidenceLevel | null;
  dependency?: string | null;
  blocker?: string | null;
  needs_review: boolean;
  approved: boolean;
  completed_at?: string | null;
  updated_at: string;
  request_quote?: string | null;
  commitment_type?: CommitmentType | null;
  // Phase 4: Commitment Continuity fields
  parent_commitment_id?: string | null;
  continuity_status?: ContinuityStatus | null;
  continuity_confidence?: ConfidenceLevel | null;
  merged_with_task_id?: string | null;
}

export interface TaskWithContinuity extends Task {
  continuity?: CommitmentContinuity;
  continuity_history?: ContinuityEvent[];
}

export interface CommitmentHistory {
  id: string;
  task_id: string;
  user_id: string;
  change_type: HistoryChangeType;
  old_value?: string | null;
  new_value?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  transcript: string;
  created_at: string;
}

export interface MeetingWithStats extends Meeting {
  total_tasks: number;
  done_tasks: number;
  completed_tasks?: number;
  needs_review_count?: number;
}

export interface MeetingDetail extends Meeting {
  tasks: Task[];
}

export interface ExtractedCommitment {
  owner: string;
  description: string;
  due_date: string | null;
  source_quote: string;
  // Phase 1: Add confidence and dependency extraction
  confidence?: ConfidenceLevel;
  dependency?: string | null;
  commitment_type?: CommitmentType;
}

export interface CarriedOverTask extends Task {
  meeting_title: string;
}

// Phase 1: New interfaces for commitment accountability

export interface CommitmentSummary {
  total: number;
  high_confidence: number;
  medium_confidence: number;
  low_confidence: number;
  needs_review: number;
  approved: number;
  with_dependencies: number;
  blocked: number;
}

export interface PersonCommitments {
  owner: string;
  open: number;
  in_progress: number;
  blocked: number;
  completed: number;
  overdue: number;
  total: number;
  completion_rate: number;
  recent_commitments: Task[];
}

export interface NeedsAttention {
  due_today: Task[];
  due_soon: Task[];
  overdue: Task[];
  blocked: Task[];
  needs_review: Task[];
}


// Phase 4.5: Completion Notifications
export interface CommitmentResponsiblePerson {
  id: string;
  taskId: string;
  name: string;
  email: string;
  isFollowthruMember: boolean;
  userId?: string;
  createdAt: string;
}

export interface CompletionNotification {
  id: string;
  taskId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  emailBody: string;
  status: 'draft' | 'sent' | 'failed';
  sentAt?: string;
  openedAt?: string;
  createdAt: string;
}
