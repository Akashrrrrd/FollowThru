'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BlockerLink {
  id: string;
  blocker_task_id: string;
  blocker_description: string;
  blocked_task_id: string;
  reason: string;
}

interface BlockerLinkingProps {
  taskId: string;
  taskDescription: string;
}

export function BlockerLinking({ taskId, taskDescription }: BlockerLinkingProps) {
  const [blockers, setBlockers] = useState<BlockerLink[]>([]);
  const [availableTasks, setAvailableTasks] = useState<Array<{ id: string; description: string }>>([]);
  const [selectedBlockerId, setSelectedBlockerId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch blocker relationships and available tasks
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [blockersRes, tasksRes] = await Promise.all([
          fetch(`/api/commitments/${taskId}/blockers`),
          fetch('/api/tasks'),
        ]);

        if (!blockersRes.ok || !tasksRes.ok) throw new Error('Failed to fetch data');

        const blockersData = await blockersRes.json();
        const tasksData = await tasksRes.json();

        setBlockers(blockersData.blockers || []);
        setAvailableTasks(
          (tasksData.tasks || [])
            .filter((t: any) => t.id !== taskId && t.status !== 'done')
            .slice(0, 20) // Limit to prevent dropdown overflow
        );
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to load blocker data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [taskId]);

  const handleAddBlocker = async () => {
    if (!selectedBlockerId || !reason) {
      setError('Please select a blocker and enter a reason');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/commitments/${taskId}/blockers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocker_task_id: selectedBlockerId,
          reason,
        }),
      });

      if (!res.ok) throw new Error('Failed to add blocker');

      const data = await res.json();
      setBlockers([...blockers, data.blocker]);
      setSelectedBlockerId('');
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding blocker');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBlocker = async (blockerId: string) => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/commitments/${taskId}/blockers/${blockerId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to remove blocker');

      setBlockers(blockers.filter((b) => b.id !== blockerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error removing blocker');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading blockers...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Blocking Dependencies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded border border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Current Blockers */}
        {blockers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              This commitment is blocked by:
            </p>
            {blockers.map((blocker) => (
              <div key={blocker.id} className="flex items-start justify-between p-3 bg-red-50 rounded border border-red-200">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{blocker.blocker_description}</p>
                  <p className="text-xs text-gray-600 mt-1">{blocker.reason}</p>
                </div>
                <Button
                  onClick={() => handleRemoveBlocker(blocker.id)}
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  className="ml-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Blocker */}
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Add a blocking dependency:</p>

          <Select value={selectedBlockerId} onValueChange={setSelectedBlockerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a task that blocks this one" />
            </SelectTrigger>
            <SelectContent>
              {availableTasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.description.substring(0, 50)}...
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why does this block you?"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />

          <Button onClick={handleAddBlocker} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Blocker
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
