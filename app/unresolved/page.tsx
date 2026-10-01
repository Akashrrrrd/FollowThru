'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { UnresolvedCommitmentsScreen } from '@/components/unresolved-commitments-screen';
import { PageLoading } from '@/components/page-loading';
import { useCallback, useState } from 'react';
import type { Task } from '@/lib/types';

function UnresolvedContent() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleRefresh = useCallback(async () => {
    window.location.reload();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Unresolved Commitments</h1>
        <p className="mt-2 text-gray-600">
          Track all outstanding action items and commitments that haven't been completed yet.
        </p>
      </div>

      <UnresolvedCommitmentsScreen onRefresh={handleRefresh} />

      {selectedTask && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-bold text-gray-900">{selectedTask.description}</h2>
          <p className="mt-2 text-sm text-gray-600">Owner: {selectedTask.owner}</p>
        </div>
      )}
    </div>
  );
}

export default function UnresolvedPage() {
  return (
    <ProtectedRoute>
      <UnresolvedContent />
    </ProtectedRoute>
  );
}
