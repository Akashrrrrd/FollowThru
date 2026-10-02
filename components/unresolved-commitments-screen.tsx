'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, RefreshCw, Calendar, Loader2, ChevronDown, ChevronUp, Flag, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UnresolvedCommitment {
  id: string;
  description: string;
  owner: string;
  due_date: string;
  status: string;
  days_outstanding?: number;
  blocker?: boolean;
  blocker_text?: string;
  is_circular?: boolean;
  meeting_title?: string;
}

interface UnresolvedCommitmentsScreenProps {
  onTaskSelect?: (task: UnresolvedCommitment) => void;
  onRefresh?: () => void;
  className?: string;
}

export function UnresolvedCommitmentsScreen({
  onTaskSelect,
  onRefresh,
  className,
}: UnresolvedCommitmentsScreenProps) {
  const [commitments, setCommitments] = useState<UnresolvedCommitment[]>([]);
  const [filteredCommitments, setFilteredCommitments] = useState<UnresolvedCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [blockerFilter, setBlockerFilter] = useState<string>('all');

  const [owners, setOwners] = useState<string[]>([]);
  const [circularDependencies, setCircularDependencies] = useState<Set<string>>(new Set());

  const fetchUnresolved = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tasks?status=open&status=in_progress&status=blocked&status=overdue');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load unresolved commitments.');
        setCommitments([]);
        return;
      }

      const tasks: UnresolvedCommitment[] = data.tasks ?? [];
      
      const unresolved = tasks.filter(
        (t) =>
          t.status !== 'done' &&
          t.status !== 'completed' &&
          t.status !== 'dismissed'
      );

      setCommitments(unresolved);

      const uniqueOwners = Array.from(
        new Set(unresolved.map((t) => t.owner))
      ).sort();
      setOwners(uniqueOwners);

      // Detect circular dependencies
      detectCircularDeps(unresolved);
    } catch (err) {
      console.error('Fetch unresolved error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load unresolved commitments.',
      );
      setCommitments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const detectCircularDeps = useCallback((tasks: UnresolvedCommitment[]) => {
    // Simple cycle detection: check if any blocker creates a cycle
    const circularSet = new Set<string>();
    
    for (const task of tasks) {
      if (task.blocker_text) {
        // Check if the blocker points back to this task (simple cycle)
        for (const otherTask of tasks) {
          if (otherTask.id !== task.id && 
              otherTask.blocker_text &&
              (otherTask.blocker_text.includes(task.description) || 
               otherTask.blocker_text.includes(task.id))) {
            // Potential cycle detected
            circularSet.add(task.id);
            circularSet.add(otherTask.id);
          }
        }
      }
    }

    setCircularDependencies(circularSet);
  }, []);

  useEffect(() => {
    let filtered = [...commitments];

    if (ownerFilter !== 'all') {
      filtered = filtered.filter((c) => c.owner === ownerFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (blockerFilter === 'blocked') {
      filtered = filtered.filter((c) => c.blocker || c.status === 'blocked');
    } else if (blockerFilter === 'unblocked') {
      filtered = filtered.filter((c) => !c.blocker && c.status !== 'blocked');
    }

    // Sort: circular first, then by urgency
    filtered.sort((a, b) => {
      const aCircular = circularDependencies.has(a.id) ? 1 : 0;
      const bCircular = circularDependencies.has(b.id) ? 1 : 0;
      if (aCircular !== bCircular) return bCircular - aCircular;
      
      return (b.days_outstanding || 0) - (a.days_outstanding || 0);
    });
    
    setFilteredCommitments(filtered);
  }, [commitments, ownerFilter, statusFilter, blockerFilter, circularDependencies]);

  useEffect(() => {
    fetchUnresolved();
  }, [fetchUnresolved]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUnresolved();
    setRefreshing(false);
    onRefresh?.();
  }, [fetchUnresolved, onRefresh]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const circularCount = circularDependencies.size;

  return (
    <div className={className}>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {circularCount > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ {circularCount} commitment(s) have circular dependencies. These need to be resolved to unblock work.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {filteredCommitments.length} Unresolved
          </h2>
          <p className="text-sm text-gray-600">
            {commitments.length} total commitments tracked
            {circularCount > 0 && ` • ${circularCount} circular`}
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="mb-6 flex gap-4 flex-wrap">
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="all">All Owners</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="overdue">Overdue</option>
        </select>

        <select
          value={blockerFilter}
          onChange={(e) => setBlockerFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="all">All Items</option>
          <option value="blocked">Blocked Only</option>
          <option value="unblocked">Unblocked Only</option>
        </select>
      </div>

      {filteredCommitments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No unresolved commitments match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCommitments.map((commitment) => {
            const isCircular = circularDependencies.has(commitment.id);
            
            return (
              <Card
                key={commitment.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  isCircular ? 'border-red-300 bg-red-50' : ''
                }`}
                onClick={() => onTaskSelect?.(commitment)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{commitment.description}</CardTitle>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="outline">{commitment.owner}</Badge>
                        <Badge>{commitment.status}</Badge>
                        {commitment.blocker && <Badge variant="destructive">Blocked</Badge>}
                        {isCircular && (
                          <Badge variant="destructive" className="bg-red-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Circular
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expandedId === commitment.id ? null : commitment.id);
                      }}
                      className="ml-2"
                    >
                      {expandedId === commitment.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </CardHeader>

                {expandedId === commitment.id && (
                  <CardContent className="pt-0 border-t">
                    <div className="space-y-3 mt-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          Due: {commitment.due_date || 'No deadline'}
                        </span>
                      </div>
                      {commitment.days_outstanding && commitment.days_outstanding > 0 && (
                        <div className="flex items-center gap-2 text-red-600">
                          <Flag className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {commitment.days_outstanding} days overdue
                          </span>
                        </div>
                      )}
                      {commitment.blocker_text && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                          <p className="text-xs font-medium text-yellow-900">Blocked by:</p>
                          <p className="text-xs text-yellow-800 mt-1">{commitment.blocker_text}</p>
                        </div>
                      )}
                      {isCircular && (
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-xs font-medium text-red-900 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Circular Dependency Detected
                          </p>
                          <p className="text-xs text-red-700 mt-1">This commitment has circular blockers. Resolve dependencies to unblock.</p>
                        </div>
                      )}
                      {commitment.meeting_title && (
                        <div className="text-sm text-gray-600">
                          From: {commitment.meeting_title}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
