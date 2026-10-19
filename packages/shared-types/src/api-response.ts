export enum ErrorCode {
  ERR_UNAUTHORIZED = 'ERR_UNAUTHORIZED',
  ERR_FORBIDDEN = 'ERR_FORBIDDEN',
  ERR_NOT_FOUND = 'ERR_NOT_FOUND',
  ERR_VALIDATION = 'ERR_VALIDATION',
  ERR_CONFLICT = 'ERR_CONFLICT',
  ERR_INTERNAL = 'ERR_INTERNAL',
  ERR_PII_DECRYPT_DENIED = 'ERR_PII_DECRYPT_DENIED',
  ERR_RATE_LIMIT_EXCEEDED = 'ERR_RATE_LIMIT_EXCEEDED',
  ERR_CIRCUIT_BREAKER_TRIGGERED = 'ERR_CIRCUIT_BREAKER_TRIGGERED',
  ERR_HASH_CHAIN_TAMPERED = 'ERR_HASH_CHAIN_TAMPERED',
  ERR_INVALID_INVITE_TOKEN = 'ERR_INVALID_INVITE_TOKEN',
  ERR_TOKEN_EXPIRED = 'ERR_TOKEN_EXPIRED',
  ERR_RECOVERY_CODE_INVALID = 'ERR_RECOVERY_CODE_INVALID',
  ERR_OFFLINE_SYNC_FAILED = 'ERR_OFFLINE_SYNC_FAILED',
}

export interface ApiErrorDetail {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorDetail;
  timestamp: string;
}

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function createErrorResponse(code: ErrorCode | string, message: string, details?: unknown): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
}

