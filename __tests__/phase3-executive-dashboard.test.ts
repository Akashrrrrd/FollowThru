import { ExecutiveDashboardService } from '@/lib/executive-dashboard-service';

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    mockResolvedValue: jest.fn(),
  })),
};

describe('Phase 3: Executive Dashboard', () => {
  let service: ExecutiveDashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExecutiveDashboardService(mockSupabase as any);
  });

  describe('getMetrics', () => {
    it('should return metrics structure for month period', async () => {
      mockSupabase.from().select().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();
      mockSupabase.from().gte().mockReturnThis();
      mockSupabase.from().order().mockReturnThis();
      mockSupabase.from().limit().mockResolvedValue({
        data: [],
        error: null,
      });

      const metrics = await service.getMetrics('user-123', 'month');

      expect(metrics).toHaveProperty('period');
      expect(metrics).toHaveProperty('dateRange');
      expect(metrics).toHaveProperty('followThrough');
      expect(metrics).toHaveProperty('velocity');
      expect(metrics).toHaveProperty('decisionRevisits');
      expect(metrics.period).toBe('month');
    });

    it('should calculate follow-through percentage', async () => {
      mockSupabase.from().select().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();
      mockSupabase.from().gte().mockResolvedValue({
        data: [
          { id: '1', status: 'done', state: null },
          { id: '2', status: 'done', state: null },
          { id: '3', status: 'open', state: null },
        ],
        error: null,
      });
      mockSupabase.from().order().mockReturnThis();
      mockSupabase.from().limit().mockResolvedValue({
        data: [],
        error: null,
      });

      const metrics = await service.getMetrics('user-123', 'week');

      expect(metrics.followThrough.totalCommitments).toBe(3);
      expect(metrics.followThrough.completed).toBe(2);
      expect(metrics.followThrough.percentage).toBe(66); // 2/3 * 100
    });
  });

  describe('Follow-through calculation', () => {
    it('should handle zero tasks', async () => {
      mockSupabase.from().select().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();
      mockSupabase.from().gte().mockResolvedValue({
        data: [],
        error: null,
      });
      mockSupabase.from().order().mockReturnThis();
      mockSupabase.from().limit().mockResolvedValue({
        data: [],
        error: null,
      });

      const metrics = await service.getMetrics('user-123', 'week');

      expect(metrics.followThrough.percentage).toBe(0);
      expect(metrics.followThrough.totalCommitments).toBe(0);
    });

    it('should count dismissed commitments separately', async () => {
      mockSupabase.from().select().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();
      mockSupabase.from().gte().mockResolvedValue({
        data: [
          { id: '1', status: 'done', state: null },
          { id: '2', status: 'open', state: 'DISMISSED' },
          { id: '3', status: 'open', state: null },
        ],
        error: null,
      });
      mockSupabase.from().order().mockReturnThis();
      mockSupabase.from().limit().mockResolvedValue({
        data: [],
        error: null,
      });

      const metrics = await service.getMetrics('user-123', 'week');

      expect(metrics.followThrough.dismissed).toBe(1);
      expect(metrics.followThrough.completed).toBe(1);
    });
  });

  describe('Period handling', () => {
    it.each(['week', 'month', 'quarter', 'year'] as const)('should handle %s period', async (period) => {
      mockSupabase.from().select().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();
      mockSupabase.from().gte().mockResolvedValue({
        data: [],
        error: null,
      });
      mockSupabase.from().order().mockReturnThis();
      mockSupabase.from().limit().mockResolvedValue({
        data: [],
        error: null,
      });

      const metrics = await service.getMetrics('user-123', period);

      expect(metrics.period).toBe(period);
      expect(metrics.dateRange.start).toBeDefined();
      expect(metrics.dateRange.end).toBeDefined();
    });
  });
});
