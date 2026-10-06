/**
 * Standardized API response helpers for consistent response formatting and error handling.
 * Use these in all API routes to ensure uniform response structure.
 */

import { NextResponse } from 'next/server';

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

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
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message }),
    },
    { status }
  );
}

/**
 * Build a successful created response (201).
 */
export function createdResponse<T>(
  data: T,
  message?: string
): NextResponse<ApiSuccessResponse<T>> {
  return successResponse(data, message, 201);
}

// ============================================================================
// ERROR RESPONSE BUILDERS
// ============================================================================

/**
 * Build an error response with proper status code mapping.
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
