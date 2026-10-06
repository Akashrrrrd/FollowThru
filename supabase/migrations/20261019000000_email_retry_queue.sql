-- Email Retry Queue
-- Stores outgoing emails for reliable delivery with exponential backoff retry logic
-- Decouples email sending from request handling to improve reliability and performance

CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email details
  recipient_email text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  
  -- Queue status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  
  -- Retry logic
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  next_retry_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Tracking
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at timestamp with time zone,
  failed_at timestamp with time zone,
  last_error text,
  
  -- Idempotency: prevent duplicate sends
  idempotent_key text UNIQUE,
  
  -- Metadata for debugging
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- RLS: Service role (cron jobs) can manage queue; users can't directly access
CREATE POLICY "service_role_manage_email_queue" ON public.email_queue
  USING (auth.role() = 'service_role');

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_next_retry_at ON public.email_queue(next_retry_at) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_recipient_email ON public.email_queue(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON public.email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_idempotent_key ON public.email_queue(idempotent_key) 
  WHERE idempotent_key IS NOT NULL;

-- Composite index for common queue query (status + retry time)
CREATE INDEX IF NOT EXISTS idx_email_queue_pending_retry ON public.email_queue(next_retry_at) 
  WHERE status = 'pending' AND next_retry_at <= CURRENT_TIMESTAMP;

-- Bounced Email Tracking
-- Tracks permanently bounced/invalid email addresses to prevent retry attempts
CREATE TABLE IF NOT EXISTS public.bounced_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  bounce_type text CHECK (bounce_type IN ('permanent', 'transient')),
  bounce_reason text,
  bounced_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.bounced_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_bounced" ON public.bounced_emails
  USING (auth.role() = 'service_role');

-- Index for fast bounce lookups
CREATE INDEX IF NOT EXISTS idx_bounced_emails_email ON public.bounced_emails(email);

-- Comments
COMMENT ON TABLE public.email_queue IS 'Reliable email delivery queue with exponential backoff retry logic';
COMMENT ON COLUMN public.email_queue.status IS 'pending (waiting to send), sent (delivered), failed (max retries exceeded), bounced (invalid address)';
COMMENT ON COLUMN public.email_queue.next_retry_at IS 'Next scheduled retry time; uses exponential backoff: 60s * 2^retry_count';
COMMENT ON COLUMN public.email_queue.idempotent_key IS 'Optional deduplication key to prevent duplicate sends (unique constraint)';
