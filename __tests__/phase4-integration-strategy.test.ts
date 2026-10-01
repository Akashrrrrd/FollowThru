import { OAuthManager } from '@/lib/integrations/oauth-manager';
import { SyncEngine } from '@/lib/integrations/sync-engine';
import { NudgeEngine } from '@/lib/integrations/nudge-engine';

const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
  })),
};

describe('Phase 4: Integration Strategy', () => {
  describe('OAuthManager', () => {
    let manager: OAuthManager;

    beforeEach(() => {
      jest.clearAllMocks();
      manager = new OAuthManager(mockSupabase as any);
    });

    it('should save OAuth credentials', async () => {
      await manager.saveCredentials('user-123', {
        provider: 'jira',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      }, 'access-token-xyz');

      expect(mockSupabase.from).toHaveBeenCalledWith('integration_clients');
    });

    it('should retrieve credentials', async () => {
      mockSupabase.from().select().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();
      mockSupabase.from().single().mockResolvedValue({
        data: { provider: 'jira', access_token: 'token' },
        error: null,
      });

      const creds = await manager.getCredentials('user-123', 'jira');

      expect(creds.provider).toBe('jira');
    });

    it('should disconnect integration', async () => {
      mockSupabase.from().delete().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();

      await manager.disconnect('user-123', 'slack');

      expect(mockSupabase.from).toHaveBeenCalledWith('integration_clients');
    });
  });

  describe('SyncEngine', () => {
    let engine: SyncEngine;

    beforeEach(() => {
      jest.clearAllMocks();
      engine = new SyncEngine(mockSupabase as any);
    });

    it('should start sync job', async () => {
      const jobId = await engine.startSync('user-123', 'asana');

      expect(jobId).toBe('test-id');
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs');
    });

    it('should update sync status', async () => {
      mockSupabase.from().update().mockReturnThis();
      mockSupabase.from().eq().mockResolvedValue({ data: null, error: null });

      await engine.updateSyncStatus('job-123', 'completed', 42);

      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs');
    });

    it('should handle sync errors', async () => {
      mockSupabase.from().update().mockReturnThis();
      mockSupabase.from().eq().mockResolvedValue({ data: null, error: null });

      await engine.updateSyncStatus('job-123', 'failed', 0, 'Connection timeout');

      expect(mockSupabase.from).toHaveBeenCalledWith('sync_jobs');
    });
  });

  describe('NudgeEngine', () => {
    let engine: NudgeEngine;

    beforeEach(() => {
      jest.clearAllMocks();
      engine = new NudgeEngine(mockSupabase as any);
    });

    it('should send nudge', async () => {
      const nudgeId = await engine.sendNudge(
        'task-123',
        'user-456',
        'Complete this task',
        'email',
      );

      expect(nudgeId).toBe('test-id');
    });

    it('should generate appropriate message for due today', () => {
      const msg = engine.generateNudgeMessage('Write report', 0, 'John');

      expect(msg).toContain('due today');
      expect(msg).toContain('John');
    });

    it('should generate appropriate message for overdue', () => {
      const msg = engine.generateNudgeMessage('Write report', 3, 'John');

      expect(msg).toContain('3 days overdue');
    });

    it('should mark nudge as opened', async () => {
      mockSupabase.from().update().mockReturnThis();
      mockSupabase.from().eq().mockResolvedValue({ data: null, error: null });

      await engine.markNudgeOpened('nudge-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('nudges');
    });
  });
});
