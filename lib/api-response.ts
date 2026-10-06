/**
 * Standardized API response helpers for consistent response formatting and error handling.
 * Use these in all API routes to ensure uniform response structure.
 */

import { NextResponse } from 'next/server';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface PaginationMetadata {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  pagination?: PaginationMetadata;
  timestamp?: string;
  api_version?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp?: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// PAGINATION HELPERS
// ============================================================================

export interface PaginationOptions {
  page?: number | string;
  per_page?: number | string;
  limit?: number | string; // Alias for per_page
}

export interface PaginationParams {
  page: number;
  per_page: number;
  offset: number;
}

/**
 * Parse and validate pagination parameters from query string.
 * Defaults: page=1, per_page=20
 * Max per_page: 100
 */
export function parsePagination(
  options: PaginationOptions = {},
  defaults = { page: 1, per_page: 20, maxPerPage: 100 }
): PaginationParams {
  let page = parseInt(String(options.page ?? defaults.page), 10);
  let per_page = parseInt(
    String(options.per_page ?? options.limit ?? defaults.per_page),
    10
  );

  // Validate and clamp values
  if (isNaN(page) || page < 1) page = defaults.page;
  if (isNaN(per_page) || per_page < 1) per_page = defaults.per_page;
  if (per_page > defaults.maxPerPage) per_page = defaults.maxPerPage;

  const offset = (page - 1) * per_page;

  return { page, per_page, offset };
}

/**
 * Calculate pagination metadata.
 */
export function createPaginationMetadata(
  page: number,
  per_page: number,
  total: number
): PaginationMetadata {
  const total_pages = Math.ceil(total / per_page);
  
  return {
    page,
    per_page,
    total,
    total_pages,
    has_next: page < total_pages,
    has_previous: page > 1,
  };
}

// ============================================================================
// ERROR CODES
// ============================================================================

export enum ErrorCode {
  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_FIELD = 'MISSING_FIELD',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  DUPLICATE = 'DUPLICATE',
  
  // Permission errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ORGANIZATION_MISMATCH = 'ORGANIZATION_MISMATCH',
  TEAM_MISMATCH = 'TEAM_MISMATCH',
  
  // Business logic errors
  INVALID_STATE = 'INVALID_STATE',
  INVALID_OPERATION = 'INVALID_OPERATION',
  EXPIRED = 'EXPIRED',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

// ============================================================================
// HTTP STATUS CODES FOR ERROR CODES
// ============================================================================

const errorCodeToStatus: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_FIELD]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE]: 409,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.ORGANIZATION_MISMATCH]: 403,
  [ErrorCode.TEAM_MISMATCH]: 403,
  [ErrorCode.INVALID_STATE]: 400,
  [ErrorCode.INVALID_OPERATION]: 400,
  [ErrorCode.EXPIRED]: 400,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
};

// ============================================================================
// SUCCESS RESPONSE BUILDERS
// ============================================================================

/**
 * Build a successful API response.
 * 
 * @param data - Response data (array, object, or primitive)
 * @param options - Optional message, pagination metadata, and status code
 */
export function successResponse<T>(
  data: T,
  options?: {
    message?: string;
    pagination?: PaginationMetadata;
    status?: number;
    timestamp?: boolean;
    api_version?: string;
  }
): NextResponse<ApiSuccessResponse<T>> {
  const status = options?.status ?? 200;
  const includeTimestamp = options?.timestamp ?? true;
  
  return NextResponse.json(
    {
      success: true,
      data,
      ...(options?.message && { message: options.message }),
      ...(options?.pagination && { pagination: options.pagination }),
      ...(includeTimestamp && { timestamp: new Date().toISOString() }),
      ...(options?.api_version && { api_version: options.api_version }),
    },
    { status }
  );
}

/**
 * Build a successful created response (201).
 * 
 * @param data - Created resource data
 * @param message - Optional success message
 */
export function createdResponse<T>(
  data: T,
  message?: string
): NextResponse<ApiSuccessResponse<T>> {
  return successResponse(data, { message, status: 201 });
}

/**
 * Build a list response with pagination.
 * 
 * @param items - Array of items
 * @param total - Total count of items (used for pagination calculation)
 * @param pagination - Pagination params (page, per_page)
 * @param message - Optional message
 */
export function listResponse<T>(
  items: T[],
  total: number,
  pagination: { page: number; per_page: number },
  message?: string
): NextResponse<ApiSuccessResponse<T[]>> {
  const paginationMeta = createPaginationMetadata(pagination.page, pagination.per_page, total);
  
  return successResponse(items, {
    message,
    pagination: paginationMeta,
  });
}

// ============================================================================
// ERROR RESPONSE BUILDERS
// ============================================================================

/**
 * Build an error response with proper status code mapping.
 * 
 * @param code - Error code enum
 * @param message - Human-readable error message
 * @param details - Optional error details for debugging
 * @param overrideStatus - Override the default status code for this error code
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: any,
  overrideStatus?: number
): NextResponse<ApiErrorResponse> {
  const status = overrideStatus ?? errorCodeToStatus[code];
  
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

// ============================================================================
// SHORTCUT ERROR BUILDERS
// ============================================================================

export function unauthorized(message: string = 'Unauthorized'): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.UNAUTHORIZED, message);
}

export function forbidden(message: string = 'Forbidden'): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.FORBIDDEN, message);
}

export function notFound(message: string = 'Resource not found'): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.NOT_FOUND, message);
}

export function validationError(message: string, details?: any): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.VALIDATION_ERROR, message, details);
}

export function conflict(message: string, details?: any): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.CONFLICT, message, details);
}

export function internalError(message: string = 'Internal server error', details?: any): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.INTERNAL_ERROR, message, details);
}

export function rateLimitExceeded(message: string = 'Rate limit exceeded'): NextResponse<ApiErrorResponse> {
  return errorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, message);
}

export function orgMismatch(): NextResponse<ApiErrorResponse> {
  return errorResponse(
    ErrorCode.ORGANIZATION_MISMATCH,
    'User does not belong to this organization'
  );
}

export function teamMismatch(): NextResponse<ApiErrorResponse> {
  return errorResponse(
    ErrorCode.TEAM_MISMATCH,
    'User does not belong to this team'
  );
}

export function insufficientPermissions(resource: string = 'resource'): NextResponse<ApiErrorResponse> {
  return errorResponse(
    ErrorCode.INSUFFICIENT_PERMISSIONS,
    `You do not have permission to manage this ${resource}`
  );
}
