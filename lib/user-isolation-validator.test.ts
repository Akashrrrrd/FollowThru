/**
 * User Isolation Validator Tests
 * 
 * Tests for user data isolation and cross-user access prevention
 */

import {
  validateTaskIsolation,
  validateMeetingIsolation,
  validateInsightIsolation,
  validateAllUserIsolation,
  validateResourceOwnership,
  validateMeetingOwnership,
} from './user-isolation-validator';

describe('User Isolation Validator', () => {
  // Mock Supabase client
  const createMockSupabaseClient = () => {
    return {
      from: jest.fn(),
    };
  };

  describe('Task Isolation', () => {
    test('should pass when user can only see their own tasks', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                { id: 'task-1', user_id: userId, owner_user_id: userId, description: 'Task 1' },
                { id: 'task-2', user_id: userId, owner_user_id: userId, description: 'Task 2' },
              ],
              error: null,
            }),
        }),
      });

      const result = await validateTaskIsolation(mockClient, userId);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should fail when returned tasks have mismatched user_id', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const otherUserId = 'user-456';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                { id: 'task-1', user_id: userId, owner_user_id: userId, description: 'Task 1' },
                { id: 'task-2', user_id: otherUserId, owner_user_id: otherUserId, description: 'Other Task' },
              ],
              error: null,
            }),
        }),
      });

      const result = await validateTaskIsolation(mockClient, userId);
      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          table: 'tasks',
          type: 'cross_user_access',
          severity: 'critical',
        })
      );
    });

    test('should flag tasks with missing owner_user_id', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                { id: 'task-1', user_id: userId, owner_user_id: userId, description: 'Task 1' },
                { id: 'task-2', user_id: userId, owner_user_id: null, description: 'Task 2' },
              ],
              error: null,
            }),
        }),
      });

      const result = await validateTaskIsolation(mockClient, userId);
      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          table: 'tasks',
          type: 'leaked_data',
          severity: 'high',
        })
      );
    });

    test('should detect cross-user access attempts', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const otherUserId = 'user-456';

      let callCount = 0;
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // First call: fetch current user's tasks
                return Promise.resolve({
                  data: [{ id: 'task-1', user_id: userId, owner_user_id: userId, description: 'Task 1' }],
                  error: null,
                });
              } else {
                // Second call: attempt to fetch other user's tasks
                return Promise.resolve({
                  data: [{ id: 'task-2', user_id: otherUserId }],
                  error: null,
                });
              }
            }),
        }),
      });

      const result = await validateTaskIsolation(mockClient, userId, otherUserId);
      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'cross_user_access',
          description: expect.stringContaining('Able to query tasks for user'),
        })
      );
    });
  });

  describe('Meeting Isolation', () => {
    test('should pass when user can only see their own meetings', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                { id: 'meeting-1', user_id: userId, title: 'Meeting 1' },
                { id: 'meeting-2', user_id: userId, title: 'Meeting 2' },
              ],
              error: null,
            }),
        }),
      });

      const result = await validateMeetingIsolation(mockClient, userId);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should fail when returned meetings have mismatched user_id', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const otherUserId = 'user-456';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                { id: 'meeting-1', user_id: userId, title: 'Meeting 1' },
                { id: 'meeting-2', user_id: otherUserId, title: 'Other Meeting' },
              ],
              error: null,
            }),
        }),
      });

      const result = await validateMeetingIsolation(mockClient, userId);
      expect(result.passed).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          table: 'meetings',
          type: 'cross_user_access',
          severity: 'critical',
        })
      );
    });
  });

  describe('Insight Isolation', () => {
    test('should pass when user can only see their own insights', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                { id: 'insight-1', user_id: userId },
                { id: 'insight-2', user_id: userId },
              ],
              error: null,
            }),
        }),
      });

      const result = await validateInsightIsolation(mockClient, userId);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('Comprehensive Isolation Check', () => {
    test('should pass when all tables are properly isolated', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: [
                { id: '1', user_id: userId, owner_user_id: userId },
              ],
              error: null,
            }),
        }),
      });

      const result = await validateAllUserIsolation(mockClient, userId);
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.checkedTables).toContain('tasks');
      expect(result.checkedTables).toContain('meetings');
      expect(result.checkedTables).toContain('insights');
    });

    test('should aggregate violations from multiple tables', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const otherUserId = 'user-456';

      let callCount = 0;
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockImplementation(() => {
              callCount++;
              if (callCount <= 2) {
                // Tasks: current user only
                return Promise.resolve({
                  data: [{ id: '1', user_id: userId, owner_user_id: userId }],
                  error: null,
                });
              } else if (callCount <= 4) {
                // Meetings: cross-user access
                return Promise.resolve({
                  data: [{ id: 'meeting-1', user_id: otherUserId }],
                  error: null,
                });
              } else {
                // Insights: current user only
                return Promise.resolve({
                  data: [{ id: 'insight-1', user_id: userId }],
                  error: null,
                });
              }
            }),
        }),
      });

      const result = await validateAllUserIsolation(mockClient, userId, otherUserId);
      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Ownership', () => {
    test('should confirm ownership when resource belongs to user', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const resourceId = 'task-1';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: resourceId, user_id: userId },
                error: null,
              }),
            }),
        }),
      });

      const result = await validateResourceOwnership(mockClient, 'tasks', resourceId, userId);
      expect(result.owned).toBe(true);
    });

    test('should reject ownership when resource belongs to another user', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const otherUserId = 'user-456';
      const resourceId = 'task-1';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: resourceId, user_id: otherUserId },
                error: null,
              }),
            }),
        }),
      });

      const result = await validateResourceOwnership(mockClient, 'tasks', resourceId, userId);
      expect(result.owned).toBe(false);
      expect(result.reason).toContain('belongs to user');
    });

    test('should reject ownership when resource not found', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const resourceId = 'nonexistent-task';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
        }),
      });

      const result = await validateResourceOwnership(mockClient, 'tasks', resourceId, userId);
      expect(result.owned).toBe(false);
      expect(result.reason).toContain('not found');
    });

    test('should handle database errors gracefully', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const resourceId = 'task-1';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection failed' },
              }),
            }),
        }),
      });

      const result = await validateResourceOwnership(mockClient, 'tasks', resourceId, userId);
      expect(result.owned).toBe(false);
      expect(result.reason).toContain('Database error');
    });
  });

  describe('Meeting Ownership', () => {
    test('should confirm meeting ownership when meeting belongs to user', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const meetingId = 'meeting-1';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: meetingId, user_id: userId },
                error: null,
              }),
            }),
        }),
      });

      const result = await validateMeetingOwnership(mockClient, meetingId, userId);
      expect(result.valid).toBe(true);
    });

    test('should reject when meeting belongs to another user', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const otherUserId = 'user-456';
      const meetingId = 'meeting-1';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: meetingId, user_id: otherUserId },
                error: null,
              }),
            }),
        }),
      });

      const result = await validateMeetingOwnership(mockClient, meetingId, userId);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('belongs to user');
    });

    test('should reject when meeting not found', async () => {
      const mockClient = createMockSupabaseClient() as any;
      const userId = 'user-123';
      const meetingId = 'nonexistent-meeting';

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
        }),
      });

      const result = await validateMeetingOwnership(mockClient, meetingId, userId);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });
});
