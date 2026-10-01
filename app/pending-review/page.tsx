'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { CommitmentReviewPanel } from '@/components/commitment-review-panel';
import { PageLoading } from '@/components/page-loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface ReviewTask {
  id: string;
  description: string;
  owner: string;
  meeting_title: string;
  source_quote: string;
  flag_reason: string;
  confidence: number;
  grace_period_ends_at: string;
}

function PendingReviewContent() {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPendingReview = async () => {
      try {
        const res = await fetch('/api/commitments/pending-review');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setTasks(data.tasks || []);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingReview();
  }, []);

  if (loading) {
    return <PageLoading />;
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pending Review</h1>
        <p className="mt-2 text-gray-600">
          Commitments flagged by AI as potential hallucinations. Review and take action within 5 minutes.
        </p>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No commitments pending review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Task List */}
          <div className="lg:col-span-1">
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className={`cursor-pointer transition ${
                    selectedTaskId === task.id
                      ? 'ring-2 ring-blue-500'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <CardContent className="p-4">
                    <p className="font-medium text-sm line-clamp-2">{task.description}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {task.owner}
                      </Badge>
                      <Badge
                        variant={task.confidence > 0.6 ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {(task.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Review Panel */}
          <div className="lg:col-span-2">
            {selectedTask ? (
              <CommitmentReviewPanel
                taskId={selectedTask.id}
                taskDescription={selectedTask.description}
                owner={selectedTask.owner}
                meetingTitle={selectedTask.meeting_title}
                sourceQuote={selectedTask.source_quote}
                hallucinationReason={selectedTask.flag_reason}
                confidence={selectedTask.confidence}
                graceUntil={new Date(selectedTask.grace_period_ends_at)}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">Select a commitment to review</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PendingReviewPage() {
  return (
    <ProtectedRoute>
      <PendingReviewContent />
    </ProtectedRoute>
  );
}
