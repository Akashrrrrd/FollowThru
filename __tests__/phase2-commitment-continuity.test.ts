import { CommitmentContinuityService } from '@/lib/commitment-continuity-service';

const mockSupabase = {
  from: jest.fn(() => ({
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    order: jest.fn().mockReturnThis(),
  })),
};

describe('Phase 2: Commitment Continuity', () => {
  let service: CommitmentContinuityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommitmentContinuityService(mockSupabase as any);
  });

  describe('recordEvidence', () => {
    it('should record evidence with all parameters', async () => {
      const id = await service.recordEvidence(
        'task-123',
        'meeting-456',
        'John will complete the report by Friday',
        120,
        'https://meeting.com/recording',
      );

      expect(id).toBe('test-id');
      expect(mockSupabase.from).toHaveBeenCalledWith('commitment_evidence');
    });

    it('should record evidence without optional parameters', async () => {
      const id = await service.recordEvidence(
        'task-123',
        'meeting-456',
        'John will complete the report',
      );

      expect(id).toBe('test-id');
    });
  });

  describe('getUnresolvedCommitments', () => {
    it('should fetch unresolved commitments ordered by due date', async () => {
      mockSupabase.from().select().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();
      mockSupabase.from().in().mockReturnThis();
      mockSupabase.from().neq().mockReturnThis();
      mockSupabase.from().order().mockResolvedValue({
        data: [
          {
            id: 'task-1',
            description: 'Task 1',
            status: 'open',
            due_date: '2025-10-10',
          },
        ],
        error: null,
      });

      const commitments = await service.getUnresolvedCommitments('user-123');

      expect(commitments).toHaveLength(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
    });
  });

  describe('carryOverCommitment', () => {
    it('should create carryover record', async () => {
      mockSupabase.from().insert().mockResolvedValue({ data: null, error: null });

      await service.carryOverCommitment(
        'original-123',
        'new-456',
        'Still pending from last meeting',
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('commitment_carryover');
    });
  });

  describe('calculateDaysOutstanding', () => {
    it('should calculate days from due date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockSupabase.from().select().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();
      mockSupabase.from().single().mockResolvedValue({
        data: {
          due_date: yesterday.toISOString(),
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const days = await service.calculateDaysOutstanding('task-123');

      expect(days).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for no due date', async () => {
      mockSupabase.from().select().mockReturnThis();
      mockSupabase.from().eq().mockReturnThis();
      mockSupabase.from().single().mockResolvedValue({
        data: {
          due_date: null,
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      const days = await service.calculateDaysOutstanding('task-123');

      expect(days).toBe(0);
    });
  });
});
