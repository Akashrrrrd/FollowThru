-- Phase 5: Meeting Recordings & Transcription
-- Support for Zoom/Teams recording metadata, transcription service integration

-- Extend meetings table with recording and transcription fields
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS teams_meeting_id TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS recording_provider TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS recording_duration_ms INTEGER;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT 'pending'; -- pending, processing, completed, failed
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS transcription_service TEXT; -- 'groq', 'assemblyai', 'rev', etc.
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS transcription_job_id TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS transcription_error TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP;

-- Create recordings table for detailed metadata
CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'zoom', 'teams'
  provider_recording_id TEXT NOT NULL,
  download_url TEXT,
  file_size_bytes INTEGER,
  duration_ms INTEGER,
  format TEXT DEFAULT 'mp4', -- 'mp4', 'webm', 'wav', etc.
  download_status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed, expired
  download_error TEXT,
  downloaded_at TIMESTAMP,
  storage_path TEXT, -- local or S3 path if stored
  transcription_job_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create transcription_jobs table to track async transcription work
CREATE TABLE IF NOT EXISTS public.transcription_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  service TEXT NOT NULL, -- 'groq', 'assemblyai', 'rev'
  service_job_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, queued, processing, completed, failed
  input_format TEXT,
  output_transcript TEXT,
  confidence FLOAT,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create meeting_app_events table to track bot interactions and state
CREATE TABLE IF NOT EXISTS public.meeting_app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_bot_interaction_id uuid REFERENCES public.meeting_bot_interactions(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'zoom', 'teams'
  event_type TEXT NOT NULL, -- 'joined', 'left', 'recording_started', 'recording_stopped', 'error'
  event_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_app_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view recordings for their meetings"
  ON public.recordings FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view transcription jobs for their recordings"
  ON public.transcription_jobs FOR SELECT
  USING (
    recording_id IN (
      SELECT id FROM public.recordings 
      WHERE meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can view meeting app events for their meetings"
  ON public.meeting_app_events FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_recordings_meeting_id ON public.recordings(meeting_id);
CREATE INDEX idx_recordings_provider_recording_id ON public.recordings(provider, provider_recording_id);
CREATE INDEX idx_recordings_download_status ON public.recordings(download_status);
CREATE INDEX idx_transcription_jobs_recording_id ON public.transcription_jobs(recording_id);
CREATE INDEX idx_transcription_jobs_meeting_id ON public.transcription_jobs(meeting_id);
CREATE INDEX idx_transcription_jobs_status ON public.transcription_jobs(status);
CREATE INDEX idx_transcription_jobs_service ON public.transcription_jobs(service);
CREATE INDEX idx_meeting_app_events_meeting_id ON public.meeting_app_events(meeting_id);
CREATE INDEX idx_meeting_app_events_provider ON public.meeting_app_events(provider);
CREATE INDEX idx_meeting_app_events_type ON public.meeting_app_events(event_type);
