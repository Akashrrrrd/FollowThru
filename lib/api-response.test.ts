/**
 * API Response Standardization Tests
 * 
 * Verifies that all standardized responses follow the expected format:
 * - Success: { success: true, data: {...}, timestamp?: string, pagination?: {...} }
 * - Error: { success: false, error: { code: string, message: string }, timestamp?: string }
 */

import { 
  successResponse, 
  createdResponse, 
  listResponse, 
  errorResponse, 
  unauthorized, 
  validationError, 
  notFound, 
  internalError,
  ErrorCode,
  parsePagination,
  createPaginationMetadata,
} from './api-response';

describe('API Response Helpers', () => {
  describe('parsePagination', () => {
    it('should parse valid page and per_page', () => {
      const result = parsePagination({ page: '2', per_page: '50' });
      expect(result.page).toBe(2);
      expect(result.per_page).toBe(50);
      expect(result.offset).toBe(50); // (2-1) * 50
    });

    it('should clamp per_page to max', () => {
      const result = parsePagination({ page: '1', per_page: '500' });
      expect(result.per_page).toBe(100); // default max
    });

    it('should default to page 1, per_page 20', () => {
      const result = parsePagination({});
      expect(result.page).toBe(1);
      expect(result.per_page).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should handle null values', () => {
      const result = parsePagination({ page: null, per_page: null });
      expect(result.page).toBe(1);
      expect(result.per_page).toBe(20);
    });
  });

  describe('createPaginationMetadata', () => {
    it('should calculate pagination metadata correctly', () => {
      const meta = createPaginationMetadata(2, 50, 150);
      expect(meta.page).toBe(2);
      expect(meta.per_page).toBe(50);
      expect(meta.total).toBe(150);
      expect(meta.total_pages).toBe(3);
      expect(meta.has_next).toBe(true);
      expect(meta.has_previous).toBe(true);
    });

    it('should indicate no next page on last page', () => {
      const meta = createPaginationMetadata(3, 50, 150);
      expect(meta.has_next).toBe(false);
      expect(meta.has_previous).toBe(true);
    });

    it('should indicate no previous page on first page', () => {
      const meta = createPaginationMetadata(1, 50, 150);
      expect(meta.has_next).toBe(true);
      expect(meta.has_previous).toBe(false);
    });
  });

  describe('Response Builders', () => {
    it('successResponse should include data and timestamp', async () => {
      const response = successResponse({ id: '123', name: 'Test' });
      const json = await response.json();
      
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ id: '123', name: 'Test' });
      expect(json.timestamp).toBeDefined();
      expect(response.status).toBe(200);
    });

    it('createdResponse should return 201 status', async () => {
      const response = createdResponse({ id: '123' }, 'Created');
      
      expect(response.status).toBe(201);
    });

    it('listResponse should include pagination metadata', async () => {
      const items = [{ id: '1' }, { id: '2' }];
      const response = listResponse(items, 100, { page: 1, per_page: 50 });
      const json = await response.json();
      
      expect(json.success).toBe(true);
      expect(json.data).toEqual(items);
      expect(json.pagination).toBeDefined();
      expect(json.pagination.total).toBe(100);
      expect(json.pagination.page).toBe(1);
      expect(json.pagination.total_pages).toBe(2);
    });

    it('unauthorized should return 401 with error code', async () => {
      const response = unauthorized('Please sign in');
      const json = await response.json();
      
      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.UNAUTHORIZED);
      expect(json.error.message).toBe('Please sign in');
      expect(response.status).toBe(401);
    });

    it('validationError should return 400 with error code', async () => {
      const response = validationError('Invalid email', { field: 'email' });
      const json = await response.json();
      
      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(json.error.message).toBe('Invalid email');
      expect(json.error.details).toEqual({ field: 'email' });
      expect(response.status).toBe(400);
    });

    it('notFound should return 404 with error code', async () => {
      const response = notFound('Team not found');
      const json = await response.json();
      
      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(json.error.message).toBe('Team not found');
      expect(response.status).toBe(404);
    });

    it('internalError should return 500 with error code', async () => {
      const response = internalError('Database error');
      const json = await response.json();
      
      expect(json.success).toBe(false);
      expect(json.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(json.error.message).toBe('Database error');
      expect(response.status).toBe(500);
    });
  });

  describe('Error Response Format', () => {
    it('all error responses should include timestamp', async () => {
      const responses = [
        unauthorized(),
        validationError('test'),
        notFound(),
        internalError(),
      ];

      for (const response of responses) {
        const json = await response.json();
        expect(json.timestamp).toBeDefined();
        expect(typeof json.timestamp).toBe('string');
      }
    });

    it('error responses should have consistent structure', async () => {
      const response = errorResponse(
        ErrorCode.CONFLICT,
        'Already exists',
        { resource: 'team' }
      );
      const json = await response.json();
      
      expect(json).toHaveProperty('success', false);
      expect(json).toHaveProperty('error');
      expect(json.error).toHaveProperty('code');
      expect(json.error).toHaveProperty('message');
      expect(json.error).toHaveProperty('details');
      expect(json).toHaveProperty('timestamp');
    });
  });

  describe('Response Consistency', () => {
    it('all success responses should have same shape', async () => {
      const responses = [
        successResponse({ data: 'test' }),
        successResponse({ data: 'test' }, { message: 'Success' }),
        createdResponse({ id: '123' }),
      ];

      for (const response of responses) {
        const json = await response.json();
        expect(json).toHaveProperty('success');
        expect(json).toHaveProperty('data');
        expect(json).toHaveProperty('timestamp');
      }
    });

    it('all error responses should have same shape', async () => {
      const responses = [
        unauthorized(),
        validationError('test'),
        notFound(),
        internalError(),
      ];

      for (const response of responses) {
        const json = await response.json();
        expect(json).toHaveProperty('success', false);
        expect(json).toHaveProperty('error');
        expect(json.error).toHaveProperty('code');
        expect(json.error).toHaveProperty('message');
        expect(json).toHaveProperty('timestamp');
      }
    });
  });

  describe('Error Code Mappings', () => {
    it('should map error codes to correct HTTP status', () => {
      const testCases = [
        { code: ErrorCode.UNAUTHORIZED, expectedStatus: 401 },
        { code: ErrorCode.FORBIDDEN, expectedStatus: 403 },
        { code: ErrorCode.NOT_FOUND, expectedStatus: 404 },
        { code: ErrorCode.VALIDATION_ERROR, expectedStatus: 400 },
        { code: ErrorCode.CONFLICT, expectedStatus: 409 },
        { code: ErrorCode.RATE_LIMIT_EXCEEDED, expectedStatus: 429 },
        { code: ErrorCode.INTERNAL_ERROR, expectedStatus: 500 },
        { code: ErrorCode.SERVICE_UNAVAILABLE, expectedStatus: 503 },
      ];

      for (const { code, expectedStatus } of testCases) {
        const response = errorResponse(code, 'test');
        expect(response.status).toBe(expectedStatus);
      }
    });
  });
});
