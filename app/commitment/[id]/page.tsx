'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { PageLoading } from '@/components/page-loading';
import { EvidencePlayback } from '@/components/evidence-playback';
import { BlockerLinking } from '@/components/blocker-linking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, AlertCircle } from 'lucide-react';

interface Commitment {
  id: string;
  description: string;
  owner: string;
  due_date: string;
  status: string;
  meeting_id: string;
  meeting_title: string;
  audio_url?: string;
  days_outstanding?: number;
  blocker?: boolean;
}

function CommitmentDetailContent() {
  const params = useParams();
  const taskId = params?.id as string;
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommitment = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setCommitment(data.task);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load commitment');
      } finally {
        setLoading(false);
      }
    };

    if (taskId) fetchCommitment();
  }, [taskId]);

  if (loading) return <PageLoading />;

  if (error || !commitment) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-2 p-4 bg-red-50 rounded border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">{error || 'Commitment not found'}</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    blocked: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
    overdue: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{commitment.description}</h1>
        
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Badge className={statusColors[commitment.status] || 'bg-gray-100 text-gray-800'}>
            {commitment.status.replace('_', ' ').toUpperCase()}
          </Badge>
          
          {commitment.blocker && (
            <Badge variant="destructive">BLOCKED</Badge>
          )}
          
          {commitment.days_outstanding && commitment.days_outstanding > 0 && (
            <Badge variant="outline" className="text-red-700">
              {commitment.days_outstanding} days overdue
            </Badge>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Owner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <p className="font-medium">{commitment.owner}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Due Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <p className="font-medium">
                {commitment.due_date ? new Date(commitment.due_date).toLocaleDateString() : 'No deadline'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evidence & Timeline */}
      <div className="mb-8">
        <EvidencePlayback taskId={taskId} audioUrl={commitment.audio_url} />
      </div>

      {/* Blocker Dependencies */}
      <div className="mb-8">
        <BlockerLinking taskId={taskId} taskDescription={commitment.description} />
      </div>
    </div>
  );
}

export default function CommitmentDetailPage() {
  return (
    <ProtectedRoute>
      <CommitmentDetailContent />
    </ProtectedRoute>
  );
}
