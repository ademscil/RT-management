import { describe, it, expect } from 'vitest';
import {
  INVOICE_NUMBER_PATTERN,
  INVOICE_ORDER_ID_PATTERN,
  InvoiceStatus,
  MidtransFraudStatus,
  MidtransTransactionStatus,
  PLAN_CATALOGUE,
  PPN_RATE,
  PlanCode,
  SUBSCRIPTION_GRACE_PERIOD_DAYS,
  addDays,
  billingCycleDiscountRate,
  billingCycleMonths,
  buildInvoiceNumber,
  buildInvoiceOrderId,
  computePriceBreakdown,
  computeSubscriptionEnd,
  daysUntil,
  isTerminalInvoiceStatus,
  resolveInvoiceStatusFromMidtrans,
  type InvoiceStatus as InvoiceStatusType,
} from '@simrt/shared-types';

const PRO = PLAN_CATALOGUE.find((p) => p.code === PlanCode.PRO_RT)!;
const ENT = PLAN_CATALOGUE.find((p) => p.code === PlanCode.ENTERPRISE_KELURAHAN)!;

describe('billing cycle maths', () => {
  it('maps each cycle to its month count', () => {
    expect(billingCycleMonths('MONTHLY')).toBe(1);
    expect(billingCycleMonths('QUARTERLY')).toBe(3);
    expect(billingCycleMonths('ANNUAL')).toBe(12);
    expect(billingCycleMonths('LIFETIME')).toBe(1);
  });

  it('applies the documented multi-cycle discounts', () => {
    expect(billingCycleDiscountRate('MONTHLY')).toBe(0);
    expect(billingCycleDiscountRate('QUARTERLY')).toBe(0.05);
    expect(billingCycleDiscountRate('ANNUAL')).toBe(0.15);
  });
});

describe('server-authoritative pricing', () => {
  it('charges exactly the monthly price for one monthly cycle (plus PPN)', () => {
    const b = computePriceBreakdown(PRO.priceIdr, 'MONTHLY');
    expect(b.quantityCycles).toBe(1);
    expect(b.subtotalIdr).toBe(PRO.priceIdr);
    expect(b.discountIdr).toBe(0);
    expect(b.taxIdr).toBe(Math.round(PRO.priceIdr * PPN_RATE));
    expect(b.totalIdr).toBe(PRO.priceIdr + b.taxIdr);
  });

  it('applies a 5% discount on quarterly', () => {
    const b = computePriceBreakdown(PRO.priceIdr, 'QUARTERLY');
    expect(b.quantityCycles).toBe(3);
    expect(b.subtotalIdr).toBe(PRO.priceIdr * 3);
    expect(b.discountIdr).toBe(Math.round(PRO.priceIdr * 3 * 0.05));
  });

  it('applies a 15% discount on annual', () => {
    const b = computePriceBreakdown(PRO.priceIdr, 'ANNUAL');
    expect(b.quantityCycles).toBe(12);
    expect(b.discountIdr).toBe(Math.round(PRO.priceIdr * 12 * 0.15));
  });

  it('taxes the discounted amount, not the gross subtotal', () => {
    const b = computePriceBreakdown(PRO.priceIdr, 'ANNUAL');
    const taxable = b.subtotalIdr - b.discountIdr;
    expect(b.taxIdr).toBe(Math.round(taxable * PPN_RATE));
    expect(b.totalIdr).toBe(taxable + b.taxIdr);
  });

  it('multiplies by an explicit cycle quantity', () => {
    const b = computePriceBreakdown(PRO.priceIdr, 'MONTHLY', 6);
    expect(b.quantityCycles).toBe(6);
    expect(b.subtotalIdr).toBe(PRO.priceIdr * 6);
  });

  it('never produces a fractional or negative total', () => {
    for (const plan of [PRO, ENT]) {
      for (const cycle of ['MONTHLY', 'QUARTERLY', 'ANNUAL']) {
        const b = computePriceBreakdown(plan.priceIdr, cycle, 1);
        expect(Number.isInteger(b.totalIdr)).toBe(true);
        expect(b.totalIdr).toBeGreaterThan(0);
        expect(b.discountIdr).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('is a pure function of its inputs — same input, same output', () => {
    const a = computePriceBreakdown(ENT.priceIdr, 'ANNUAL', 2);
    const b = computePriceBreakdown(ENT.priceIdr, 'ANNUAL', 2);
    expect(a).toEqual(b);
  });
});

describe('Midtrans order id + invoice numbering', () => {
  const when = new Date('2026-10-24T13:45:30Z');

  it('matches the documented order-id pattern', () => {
    const orderId = buildInvoiceOrderId(
      'rt05-rw02-sukamaju-depok',
      'INV/SIMRT/2026/10/ABC123',
      when
    );
    expect(INVOICE_ORDER_ID_PATTERN.test(orderId)).toBe(true);
    // Slug is compacted to the 20-char budget, so only the date is asserted exactly.
    expect(orderId.startsWith('SIMRT-SUB-')).toBe(true);
    expect(orderId).toContain('-20261024-');
  });

  it('keeps long, prefix-identical slugs distinct (order id is an idempotency key)', () => {
    // Blind truncation made both of these collapse to the same prefix. Because
    // the order id doubles as the gateway-side idempotency key, a collision
    // would let one tenant's invoice be mistaken for another's.
    const a = buildInvoiceOrderId('rt05-rw02-sukamaju-depok', 'INV/X', when);
    const b = buildInvoiceOrderId('rt05-rw02-sukamaju-depok-2', 'INV/X', when);
    expect(a).not.toBe(b);
  });

  it('is DETERMINISTIC for the same invoice — this is the double-charge guard', () => {
    // A retried checkout for the same logical invoice must produce the same
    // Midtrans order id, so the gateway rejects the duplicate charge instead of
    // billing the tenant twice.
    const first = buildInvoiceOrderId('rt05', 'INV/SIMRT/2026/10/ABC123', when);
    const retry = buildInvoiceOrderId('rt05', 'INV/SIMRT/2026/10/ABC123', when);
    expect(retry).toBe(first);
  });

  it('differs across distinct invoices', () => {
    const a = buildInvoiceOrderId('rt05', 'INV/SIMRT/2026/10/ABC123', when);
    const b = buildInvoiceOrderId('rt05', 'INV/SIMRT/2026/10/ZZZ999', when);
    expect(a).not.toBe(b);
  });

  it('stays inside the Midtrans 50-character order-id ceiling', () => {
    const long = buildInvoiceOrderId(
      'a-very-long-tenant-slug-here',
      'INV/SIMRT/2026/10/ABC123',
      when
    );
    expect(long.length).toBeLessThanOrEqual(50);
  });

  it('matches the human-readable invoice-number pattern', () => {
    const num = buildInvoiceNumber('seed-value', when);
    expect(INVOICE_NUMBER_PATTERN.test(num)).toBe(true);
    expect(num.startsWith('INV/SIMRT/2026/10/')).toBe(true);
  });
});

describe('Midtrans status normalisation', () => {
  it('maps settlement to PAID', () => {
    expect(resolveInvoiceStatusFromMidtrans(MidtransTransactionStatus.SETTLEMENT)).toBe(
      InvoiceStatus.PAID
    );
  });

  it('only marks a capture PAID once fraud screening accepts it', () => {
    expect(
      resolveInvoiceStatusFromMidtrans(
        MidtransTransactionStatus.CAPTURE,
        MidtransFraudStatus.ACCEPT
      )
    ).toBe(InvoiceStatus.PAID);

    // A challenged capture is NOT money yet — treating it as paid is how a
    // fraudster gets a free subscription.
    expect(
      resolveInvoiceStatusFromMidtrans(
        MidtransTransactionStatus.CAPTURE,
        MidtransFraudStatus.CHALLENGE
      )
    ).toBe(InvoiceStatus.PENDING);

    expect(
      resolveInvoiceStatusFromMidtrans(MidtransTransactionStatus.CAPTURE, MidtransFraudStatus.DENY)
    ).toBe(InvoiceStatus.PENDING);
  });

  it('maps deny/cancel/failure to FAILED and expire to EXPIRED', () => {
    expect(resolveInvoiceStatusFromMidtrans(MidtransTransactionStatus.DENY)).toBe(
      InvoiceStatus.FAILED
    );
    expect(resolveInvoiceStatusFromMidtrans(MidtransTransactionStatus.CANCEL)).toBe(
      InvoiceStatus.FAILED
    );
    expect(resolveInvoiceStatusFromMidtrans(MidtransTransactionStatus.FAILURE)).toBe(
      InvoiceStatus.FAILED
    );
    expect(resolveInvoiceStatusFromMidtrans(MidtransTransactionStatus.EXPIRE)).toBe(
      InvoiceStatus.EXPIRED
    );
  });

  it('maps the refund family to REFUNDED', () => {
    const refundFamily = [
      MidtransTransactionStatus.REFUND,
      MidtransTransactionStatus.PARTIAL_REFUND,
      MidtransTransactionStatus.PARTIAL_CANCEL,
    ];
    for (const s of refundFamily) {
      expect(resolveInvoiceStatusFromMidtrans(s)).toBe(InvoiceStatus.REFUNDED);
    }
  });

  it('treats PAID as terminal so a replay cannot un-pay or re-charge', () => {
    const terminal: InvoiceStatusType[] = [
      InvoiceStatus.PAID,
      InvoiceStatus.EXPIRED,
      InvoiceStatus.FAILED,
      InvoiceStatus.REFUNDED,
    ];
    for (const s of terminal) expect(isTerminalInvoiceStatus(s)).toBe(true);

    // PENDING must never be terminal — otherwise a late settlement is dropped.
    expect(isTerminalInvoiceStatus(InvoiceStatus.PENDING)).toBe(false);
  });
});

describe('subscription period arithmetic', () => {
  it('advances the end date by the purchased month count', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    expect(computeSubscriptionEnd(start, 'MONTHLY', 1).toISOString()).toBe(
      '2026-02-15T00:00:00.000Z'
    );
    expect(computeSubscriptionEnd(start, 'QUARTERLY', 1).toISOString()).toBe(
      '2026-04-15T00:00:00.000Z'
    );
    expect(computeSubscriptionEnd(start, 'ANNUAL', 1).toISOString()).toBe(
      '2027-01-15T00:00:00.000Z'
    );
  });

  it('does not mutate the input date', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    computeSubscriptionEnd(start, 'ANNUAL', 3);
    expect(start.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('computes the 7-day grace deadline', () => {
    const endsAt = new Date('2026-02-01T00:00:00Z');
    expect(addDays(endsAt, SUBSCRIPTION_GRACE_PERIOD_DAYS).toISOString()).toBe(
      '2026-02-08T00:00:00.000Z'
    );
  });

  it('reports days remaining and floors at zero once elapsed', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    expect(daysUntil(new Date('2026-06-11T00:00:00Z'), now)).toBe(10);
    expect(daysUntil(new Date('2026-05-01T00:00:00Z'), now)).toBe(0);
    expect(daysUntil(null, now)).toBeNull();
  });
});
