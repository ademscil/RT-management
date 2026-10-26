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

  // ---- Multi-tenancy ----
  /** JWT `rtId` does not match the asserted tenant, and caller is not SUPERUSER. */
  ERR_TENANT_MISMATCH = 'ERR_TENANT_MISMATCH',
  /** No active tenant could be resolved for a tenant-scoped route. */
  ERR_TENANT_REQUIRED = 'ERR_TENANT_REQUIRED',
  /** Tenant exists but is SUSPENDED/ARCHIVED — mutating operations are blocked. */
  ERR_TENANT_SUSPENDED = 'ERR_TENANT_SUSPENDED',
  /** Tenant slug already taken (globally unique namespace). */
  ERR_TENANT_SLUG_TAKEN = 'ERR_TENANT_SLUG_TAKEN',

  // ---- Billing & subscription ----
  /** Plan quota exhausted for the requested resource. */
  ERR_QUOTA_EXCEEDED = 'ERR_QUOTA_EXCEEDED',
  /** Active subscription does not include the requested feature. */
  ERR_PLAN_FEATURE_LOCKED = 'ERR_PLAN_FEATURE_LOCKED',
  /** Subscription expired beyond the grace window. */
  ERR_SUBSCRIPTION_EXPIRED = 'ERR_SUBSCRIPTION_EXPIRED',
  /** Midtrans rejected or could not process the charge. */
  ERR_PAYMENT_GATEWAY_ERROR = 'ERR_PAYMENT_GATEWAY_ERROR',
  /** Webhook signature verification failed. */
  ERR_PAYMENT_SIGNATURE_INVALID = 'ERR_PAYMENT_SIGNATURE_INVALID',
  /** Webhook replayed for an event already applied. */
  ERR_PAYMENT_DUPLICATE_EVENT = 'ERR_PAYMENT_DUPLICATE_EVENT',
  /** Invoice not found, or already in a terminal state. */
  ERR_INVOICE_NOT_PAYABLE = 'ERR_INVOICE_NOT_PAYABLE',
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

