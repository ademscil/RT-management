import { z } from 'zod';
import {
  PaidBillingCycle,
  PaidBillingCycleSchema,
  PlanCode,
  PlanCodeSchema,
} from './tenant.js';

/**
 * ==============================================================================
 * SAAS BILLING & SUBSCRIPTION CONTRACT
 * ==============================================================================
 * Shared by the API and the admin panel. Every amount that reaches Midtrans is
 * resolved server-side from this contract — a client NEVER supplies a price.
 * ==============================================================================
 */

export enum SubscriptionStatus {
  /** FREE tier or an active paid subscription inside its term. */
  ACTIVE = 'ACTIVE',
  /** Inside a paid term that expired but not past the grace window. */
  GRACE_PERIOD = 'GRACE_PERIOD',
  /** Expired beyond grace — tenant downgraded / read-only. */
  EXPIRED = 'EXPIRED',
  /** First-time trial of a paid plan. */
  TRIALING = 'TRIALING',
  /** Cancelled by the tenant; remains active until `endsAt`. */
  CANCELLED = 'CANCELLED',
}

export const SubscriptionStatusSchema = z.nativeEnum(SubscriptionStatus);

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export const InvoiceStatusSchema = z.nativeEnum(InvoiceStatus);

/** Terminal invoice states that a webhook replay must never overwrite. */
export const TERMINAL_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.PAID,
  InvoiceStatus.EXPIRED,
  InvoiceStatus.FAILED,
  InvoiceStatus.REFUNDED,
];

export function isTerminalInvoiceStatus(status: InvoiceStatus): boolean {
  return TERMINAL_INVOICE_STATUSES.includes(status);
}

/** Payment channels exposed to the tenant billing portal. */
export enum PaymentChannel {
  /** Dynamic QRIS produced by Midtrans Core API `charge`. */
  QRIS = 'QRIS',
  /** BCA Virtual Account. */
  BCA_VA = 'BCA_VA',
  /** Mandiri Bill Payment. */
  MANDIRI_BILL = 'MANDIRI_BILL',
  /** Midtrans Snap hosted checkout (all-methods fallback). */
  SNAP = 'SNAP',
  /** Bank transfer verified manually by a SUPERUSER (self-hosted deployments). */
  MANUAL_TRANSFER = 'MANUAL_TRANSFER',
}

export const PaymentChannelSchema = z.nativeEnum(PaymentChannel);

/** Midtrans `transaction_status` values, normalised. */
export enum MidtransTransactionStatus {
  CAPTURE = 'capture',
  SETTLEMENT = 'settlement',
  PENDING = 'pending',
  DENY = 'deny',
  CANCEL = 'cancel',
  EXPIRE = 'expire',
  REFUND = 'refund',
  PARTIAL_REFUND = 'partial_refund',
  PARTIAL_CANCEL = 'partial_cancel',
  FAILURE = 'failure',
}

export const MidtransTransactionStatusSchema = z.nativeEnum(MidtransTransactionStatus);

/** Midtrans `fraud_status` values. */
export enum MidtransFraudStatus {
  ACCEPT = 'accept',
  DENY = 'deny',
  CHALLENGE = 'challenge',
}

export const MidtransFraudStatusSchema = z.nativeEnum(MidtransFraudStatus);

/** Midtrans `payment_type` values we accept. */
export enum MidtransPaymentType {
  QRIS = 'qris',
  BANK_TRANSFER = 'bank_transfer',
  ECHANNEL = 'echannel',
  GOPAY = 'gopay',
  SHOPEEPAY = 'shopeepay',
  CREDIT_CARD = 'credit_card',
}

export const MidtransPaymentTypeSchema = z.nativeEnum(MidtransPaymentType);

export const PAID_PLAN_CODES: readonly string[] = [
  PlanCodeSchema.enum.PRO_RT,
  PlanCodeSchema.enum.ENTERPRISE_KELURAHAN,
];

// ==============================================================================
// MIDTRANS WEBHOOK — validated, idempotent ingestion
// ==============================================================================

/**
 * Midtrans HTTP notification body.
 *
 * Authenticity is proven with the `x-signature` header:
 *   sha512(order_id + status_code + gross_amount + server_key)
 *
 * `gross_amount` is deliberately modelled as a STRING because Midtrans sends it
 * as a decimal string (e.g. "149000.00"). Parsing it to a float before signature
 * verification would introduce a precision mismatch and break verification.
 */
export const MidtransWebhookPayloadSchema = z.object({
  transaction_time: z.string().max(64).optional(),
  transaction_status: MidtransTransactionStatusSchema,
  transaction_id: z.string().max(64).optional(),
  status_message: z.string().max(512).optional(),
  status_code: z.string().min(1, 'status_code wajib ada').max(8),
  signature_key: z.string().max(256).optional(),
  payment_type: z.string().max(64).optional(),
  order_id: z.string().min(1, 'order_id wajib ada').max(64),
  merchant_id: z.string().max(64).optional(),
  gross_amount: z.string().min(1, 'gross_amount wajib ada').max(32),
  fraud_status: MidtransFraudStatusSchema.optional(),
  currency: z.string().max(8).optional(),
  acquirer: z.string().max(64).optional(),
  expiry_time: z.string().max(64).optional(),
  va_numbers: z
    .array(z.object({ bank: z.string().max(32), va_number: z.string().max(64) }))
    .optional(),
});
export type MidtransWebhookPayload = z.infer<typeof MidtransWebhookPayloadSchema>;

/** Result of processing a webhook, returned to Midtrans. */
export interface WebhookProcessResult {
  /** True when the event produced a state change; false when it was a replay. */
  applied: boolean;
  /** Populated when the event was a recognised duplicate. */
  duplicateOf?: string;
  invoiceId?: string;
  rtId?: string;
  newStatus?: InvoiceStatus;
}

/** Normalise a Midtrans transaction into an internal invoice status. */
export function resolveInvoiceStatusFromMidtrans(
  transactionStatus: MidtransTransactionStatus,
  fraudStatus?: MidtransFraudStatus | undefined
): InvoiceStatus {
  switch (transactionStatus) {
    case MidtransTransactionStatus.SETTLEMENT:
      return InvoiceStatus.PAID;
    case MidtransTransactionStatus.CAPTURE:
      // A capture is only money once fraud screening accepts it.
      return fraudStatus === MidtransFraudStatus.ACCEPT ? InvoiceStatus.PAID : InvoiceStatus.PENDING;
    case MidtransTransactionStatus.PENDING:
      return InvoiceStatus.PENDING;
    case MidtransTransactionStatus.DENY:
    case MidtransTransactionStatus.FAILURE:
    case MidtransTransactionStatus.CANCEL:
      return InvoiceStatus.FAILED;
    case MidtransTransactionStatus.EXPIRE:
      return InvoiceStatus.EXPIRED;
    case MidtransTransactionStatus.REFUND:
    case MidtransTransactionStatus.PARTIAL_REFUND:
    case MidtransTransactionStatus.PARTIAL_CANCEL:
      return InvoiceStatus.REFUNDED;
    default:
      return InvoiceStatus.PENDING;
  }
}

// ==============================================================================
// REQUEST CONTRACTS
// ==============================================================================

export const CreateSubscriptionCheckoutSchema = z.object({
  planCode: PlanCodeSchema,
  billingCycle: PaidBillingCycleSchema.default(PaidBillingCycle.MONTHLY),
  channel: PaymentChannelSchema.default(PaymentChannel.QRIS),
  /** Optional override for the number of cycles purchased (1-12). */
  quantityCycles: z.coerce.number().int().min(1).max(12).default(1),
});
export type CreateSubscriptionCheckoutInput = z.infer<typeof CreateSubscriptionCheckoutSchema>;

export const InvoiceQueryFilterSchema = z.object({
  status: InvoiceStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type InvoiceQueryFilter = z.infer<typeof InvoiceQueryFilterSchema>;

export const ManualTransferVerificationSchema = z.object({
  invoiceId: z.string().uuid('Invoice tidak valid'),
  isApproved: z.boolean(),
  catatan: z.string().trim().max(500).optional(),
});
export type ManualTransferVerificationInput = z.infer<typeof ManualTransferVerificationSchema>;

// ==============================================================================
// RESPONSE CONTRACTS
// ==============================================================================

export interface BillingPriceBreakdown {
  /** Price for a single billing cycle, in IDR. */
  unitPriceIdr: number;
  /** Number of months covered by this purchase. */
  quantityCycles: number;
  subtotalIdr: number;
  discountIdr: number;
  /** Indonesian PPN (VAT). 0 when not applicable. */
  taxIdr: number;
  totalIdr: number;
}

export interface SubscriptionInvoiceDto {
  id: string;
  rtId: string;
  invoiceNumber: string;
  planCode: PlanCode;
  billingCycle: string;
  status: InvoiceStatus;
  channel: PaymentChannel;
  amountIdr: number;
  midtransOrderId: string;
  /** Payment instructions — QR payload string, VA number, or Snap redirect URL. */
  paymentQrString: string | null;
  paymentVaNumber: string | null;
  paymentRedirectUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface SubscriptionCheckoutResponse {
  invoice: SubscriptionInvoiceDto;
  priceBreakdown: BillingPriceBreakdown;
  /** Data-URL image of the QRIS payload, when applicable. */
  qrImageUrl: string | null;
}

export interface SubscriptionStatusResponse {
  planCode: PlanCode;
  status: SubscriptionStatus;
  billingCycle: string;
  startedAt: string | null;
  endsAt: string | null;
  gracePeriodEndsAt: string | null;
  autoRenew: boolean;
  /** `null` for FREE/LIFETIME plans. */
  daysRemaining: number | null;
  pendingInvoice: SubscriptionInvoiceDto | null;
}

// ==============================================================================
// PRICING ENGINE — server-authoritative
// ==============================================================================

/** Indonesian VAT (PPN) rate applied to taxable SaaS subscriptions. */
export const PPN_RATE = 0.11;

/** Months covered by one purchase of a given billing cycle. */
export function billingCycleMonths(cycle: string): number {
  switch (cycle) {
    case PaidBillingCycle.QUARTERLY:
      return 3;
    case PaidBillingCycle.ANNUAL:
      return 12;
    case PaidBillingCycle.MONTHLY:
    default:
      return 1;
  }
}

/** Multi-cycle discount: quarterly → 5%, annual → 15%, otherwise none. */
export function billingCycleDiscountRate(cycle: string): number {
  switch (cycle) {
    case PaidBillingCycle.QUARTERLY:
      return 0.05;
    case PaidBillingCycle.ANNUAL:
      return 0.15;
    default:
      return 0;
  }
}

/**
 * Compute the authoritative price breakdown for a plan purchase.
 *
 * `monthlyPriceIdr` MUST come from the server-side plan catalogue
 * (`PLAN_CATALOGUE`), never from the request body.
 *
 * @param quantityCycles number of billing cycles purchased (>= 1)
 */
export function computePriceBreakdown(
  monthlyPriceIdr: number,
  billingCycle: string,
  quantityCycles = 1
): BillingPriceBreakdown {
  const cycles = Math.max(1, Math.trunc(quantityCycles));
  const months = billingCycleMonths(billingCycle) * cycles;
  const subtotal = monthlyPriceIdr * months;
  const discount = Math.round(subtotal * billingCycleDiscountRate(billingCycle));
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * PPN_RATE);
  return {
    unitPriceIdr: monthlyPriceIdr,
    quantityCycles: months,
    subtotalIdr: subtotal,
    discountIdr: discount,
    taxIdr: tax,
    totalIdr: taxable + tax,
  };
}

// ==============================================================================
// INVOICE NUMBERING & MIDTRANS ORDER ID
// ==============================================================================

/** `SIMRT-SUB-<SLUG>-<YYYYMMDD>-<6 alnum>` — Midtrans-safe, <= 50 chars. */
export const INVOICE_ORDER_ID_PATTERN = /^SIMRT-SUB-[A-Z0-9]{3,20}-\d{8}-[A-Z0-9]{6}$/;

/** Human-readable invoice number shown in the billing portal. */
export const INVOICE_NUMBER_PATTERN = /^INV\/SIMRT\/\d{4}\/\d{2}\/[A-Z0-9]{6}$/;

const ALNUM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Maximum characters available for the slug segment of a Midtrans order id. */
const ORDER_ID_SLUG_BUDGET = 20;

/**
 * Compact a tenant slug into the order-id character set.
 *
 * When the cleaned slug fits the budget it is used verbatim. When it does NOT,
 * a blind truncation would make two different long slugs share a prefix — e.g.
 * both `rt05-rw02-sukamaju-depok` and `rt05-rw02-sukamaju-depok-2` clean to
 * `RT05RW02SUKAMAJUDEPO`. Since the order id is also the gateway-side idempotency
 * key, that collision would let one tenant's invoice be mistaken for another's.
 * So the tail carries a hash of the FULL slug, keeping the namespace injective.
 */
function compactSlug(tenantSlug: string): string {
  const s = tenantSlug.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return 'TENANT';
  if (s.length <= ORDER_ID_SLUG_BUDGET) return s;
  const hashTailLength = 4;
  return `${s.slice(0, ORDER_ID_SLUG_BUDGET - hashTailLength)}${alnumSuffix(hashTailLength, s)}`;
}

function dateStamp(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
}

/**
 * FNV-1a based deterministic suffix. Seeded so that re-issuing the same logical
 * invoice yields the SAME order id — Midtrans then rejects the duplicate charge,
 * giving us defence-in-depth against double-billing on retry.
 */
function alnumSuffix(length: number, seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let out = '';
  let state = hash || 0x9e3779b9;
  for (let i = 0; i < length; i++) {
    out += ALNUM_ALPHABET[state % ALNUM_ALPHABET.length];
    state = Math.imul(state ^ (state >>> 13), 0x01000193) >>> 0;
    if (state === 0) state = 0x9e3779b9 + i;
  }
  return out;
}

/**
 * Build a Midtrans order id for a subscription invoice.
 * Format: `SIMRT-SUB-<SLUG>-<YYYYMMDD>-<SUFFIX>`
 */
export function buildInvoiceOrderId(
  tenantSlug: string,
  invoiceNumber: string,
  now: Date = new Date()
): string {
  return `SIMRT-SUB-${compactSlug(tenantSlug)}-${dateStamp(now)}-${alnumSuffix(6, invoiceNumber)}`;
}

/** Build a human-readable invoice number: `INV/SIMRT/2026/10/XXXXXX`. */
export function buildInvoiceNumber(seed: string, now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `INV/SIMRT/${year}/${month}/${alnumSuffix(6, seed)}`;
}

/** Grace window (days) after `endsAt` before the tenant drops to read-only. */
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 7;

/** Advance a start date by the purchased month count to obtain `endsAt`. */
export function computeSubscriptionEnd(
  start: Date,
  billingCycle: string,
  quantityCycles = 1
): Date {
  const months = billingCycleMonths(billingCycle) * Math.max(1, Math.trunc(quantityCycles));
  const end = new Date(start.getTime());
  end.setUTCMonth(end.getUTCMonth() + months);
  return end;
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Whole days between two instants, floored at 0. `null` when end is null. */
export function daysUntil(end: Date | null, now: Date = new Date()): number | null {
  if (!end) return null;
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}
