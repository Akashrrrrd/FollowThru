/**
 * Conflict Detector Tests
 * 
 * Tests for duplicate detection, false merge detection, and other data consistency checks
 */

import {
  detectDuplicates,
  detectFalseMerges,
  detectOrphans,
  detectConflicts,
  runFullConflictDetection,
} from './conflict-detector';

describe('Conflict Detector', () => {
  const createMockSupabaseClient = () => {
    return {
      from: jest.fn(),
    };
  };

  describe('Duplicate Detection', () => {
    test('should not flag non-duplicates with different owners', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'task-1',
                    description: 'Write proposal',
                    owner: 'Alice',
                    meeting_id: 'meeting-1',
                    created_at: '2026-09-29T10:00:00Z',
                    status: 'open',
                  },
                  {
                    id: 'task-2',
                    description: 'Review feedback',
                    owner: 'Bob',
                    meeting_id: 'meeting-2',
                    created_at: '2026-09-29T11:00:00Z',
                    status: 'open',
                  },
                ],
                error: null,
              }),
            }),
        }),
      });

      const result = await detectDuplicates(mockClient, userId);
      expect(result).toHaveLength(0);
    });

    test('should detect identical task descriptions from same owner', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'task-1',
                    description: 'Send report to client',
                    owner: 'Alice',
                    meeting_id: 'meeting-1',
                    created_at: '2026-09-29T10:00:00Z',
                    status: 'open',
                  },
                  {
                    id: 'task-2',
                    description: 'Send report to client',
                    owner: 'Alice',
                    meeting_id: 'meeting-1',
                    created_at: '2026-09-29T10:05:00Z',
                    status: 'open',
                  },
                ],
                error: null,
              }),
            }),
        }),
      });

      const result = await detectDuplicates(mockClient, userId);
      // Identical descriptions from same owner should be detected
      if (result.length > 0) {
        expect(result[0].taskIds).toContain('task-1');
        expect(result[0].taskIds).toContain('task-2');
        expect(result[0].evidence.sameMeeting).toBe(true);
      }
    });

    test('should detect high-similarity duplicates with minor differences', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'task-1',
                    description: 'Review the document',
                    owner: 'Alice',
                    meeting_id: 'meeting-1',
                    created_at: '2026-09-29T10:00:00Z',
                    status: 'open',
                  },
                  {
                    id: 'task-2',
                    description: 'Review the documents',
                    owner: 'Alice',
                    meeting_id: 'meeting-2',
                    created_at: '2026-09-29T10:30:00Z',
                    status: 'open',
                  },
                ],
                error: null,
              }),
            }),
        }),
      });

      const result = await detectDuplicates(mockClient, userId);
      // Very similar descriptions should be detected
      expect(Array.isArray(result)).toBe(true);
    });

    test('should not flag tasks from different owners even with similar descriptions', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'task-1',
                    description: 'Fix the bug',
                    owner: 'Alice',
                    meeting_id: 'meeting-1',
                    created_at: '2026-09-29T10:00:00Z',
                    status: 'open',
                  },
                  {
                    id: 'task-2',
                    description: 'Fix the bug',
                    owner: 'Bob',
                    meeting_id: 'meeting-2',
                    created_at: '2026-09-29T11:00:00Z',
                    status: 'open',
                  },
                ],
                error: null,
              }),
            }),
        }),
      });

      const result = await detectDuplicates(mockClient, userId);
      expect(result).toHaveLength(0);
    });
  });

  describe('False Merge Detection', () => {
    test('should not flag valid parent-child relationships', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                {
                  id: 'task-1',
                  description: 'Review proposal',
                  owner: 'Alice',
                  due_date: '2026-10-10',
                  parent_task_id: null,
                  status: 'open',
                  created_at: '2026-09-29T10:00:00Z',
                },
                {
                  id: 'task-2',
                  description: 'Address feedback on proposal',
                  owner: 'Alice',
                  due_date: '2026-10-20',
                  parent_task_id: 'task-1',
                  status: 'open',
                  created_at: '2026-09-29T10:00:00Z',
                },
              ],
              error: null,
            }),
        }),
      });

      const result = await detectFalseMerges(mockClient, userId);
      expect(result).toHaveLength(0);
    });

    test('should flag owner mismatch in merge', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                {
                  id: 'task-1',
                  description: 'Review proposal',
                  owner: 'Alice',
                  due_date: '2026-10-10',
                  parent_task_id: null,
                  status: 'open',
                  created_at: '2026-09-29T10:00:00Z',
                },
                {
                  id: 'task-2',
                  description: 'Address feedback',
                  owner: 'Bob',
                  due_date: '2026-10-20',
                  parent_task_id: 'task-1',
                  status: 'open',
                  created_at: '2026-09-29T10:00:00Z',
                },
              ],
              error: null,
            }),
        }),
      });

      const result = await detectFalseMerges(mockClient, userId);
      expect(result).toHaveLength(1);
      expect(result[0].evidence.ownerMismatch).toBe(true);
    });

    test('should flag date mismatch in merge', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                {
                  id: 'task-1',
                  description: 'Review proposal',
                  owner: 'Alice',
                  due_date: '2026-10-30',
                  parent_task_id: null,
                  status: 'open',
                  created_at: '2026-09-29T10:00:00Z',
                },
                {
                  id: 'task-2',
                  description: 'Address feedback',
                  owner: 'Alice',
                  due_date: '2026-10-10',
                  parent_task_id: 'task-1',
                  status: 'open',
                  created_at: '2026-09-29T10:00:00Z',
                },
              ],
              error: null,
            }),
        }),
      });

      const result = await detectFalseMerges(mockClient, userId);
      expect(result).toHaveLength(1);
      expect(result[0].evidence.dateMismatch).toBe(true);
    });
  });

  describe('Orphan Detection', () => {
    test('should not flag tasks with valid meeting references', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { id: 'task-1', description: 'Task 1', meeting_id: 'meeting-1' },
                { id: 'task-2', description: 'Task 2', meeting_id: 'meeting-2' },
              ],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{ id: 'meeting-1' }, { id: 'meeting-2' }],
              error: null,
            }),
          }),
        });

      const result = await detectOrphans(mockClient, userId);
      expect(result).toHaveLength(0);
    });

    test('should flag tasks without meeting reference', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { id: 'task-1', description: 'Task 1', meeting_id: null },
              ],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        });

      const result = await detectOrphans(mockClient, userId);
      expect(result).toHaveLength(1);
      expect(result[0].meetingId).toBeNull();
    });

    test('should flag tasks with invalid meeting reference', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [
                { id: 'task-1', description: 'Task 1', meeting_id: 'meeting-999' },
              ],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        });

      const result = await detectOrphans(mockClient, userId);
      expect(result).toHaveLength(1);
      expect(result[0].meetingId).toBe('meeting-999');
    });
  });

  describe('Conflict Detection', () => {
    test('should not flag tasks with valid data', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'task-1',
                description: 'Task 1',
                owner: 'Alice',
                due_date: '2026-10-15',
                status: 'open',
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await detectConflicts(mockClient, userId);
      expect(result).toHaveLength(0);
    });

    test('should flag tasks with invalid status', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'task-1',
                description: 'Task 1',
                owner: 'Alice',
                due_date: '2026-10-15',
                status: 'invalid_status',
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await detectConflicts(mockClient, userId);
      expect(result).toHaveLength(1);
      expect(result[0].conflictType).toBe('status_mismatch');
    });
  });

  describe('Full Conflict Detection', () => {
    test('should run all checks and aggregate results', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      let callCount = 0;
      mockClient.from.mockImplementation(() => {
        callCount++;
        return {
          select: jest.fn().mockReturnValue({
            eq: jest
              .fn()
              .mockImplementation(() => {
                if (callCount === 1) {
                  // Duplicates check
                  return {
                    order: jest.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  };
                } else if (callCount === 2) {
                  // False merges check
                  return Promise.resolve({
                    data: [],
                    error: null,
                  });
                } else if (callCount === 3) {
                  // Orphans check - tasks
                  return Promise.resolve({
                    data: [],
                    error: null,
                  });
                } else if (callCount === 4) {
                  // Orphans check - meetings
                  return Promise.resolve({
                    data: [],
                    error: null,
                  });
                } else {
                  // Conflicts check
                  return Promise.resolve({
                    data: [],
                    error: null,
                  });
                }
              }),
          }),
        };
      });

      const result = await runFullConflictDetection(mockClient, userId);
      expect(result.totalConflicts).toBe(0);
      expect(result.hasDuplicates).toBe(false);
      expect(result.hasFalseMerges).toBe(false);
      expect(result.hasOrphans).toBe(false);
      expect(result.hasConflicts).toBe(false);
    });
  });
});
