import { describe, expect, it } from 'vitest';
import { purchaseSchema } from '@/src/server/purchases/purchase.schema';

const valid = {
  purchaseId: 'receipt-1', userId: '12345', username: 'player', displayName: 'Player',
  productId: '99', itemId: 'ExpandPlot1', itemName: 'Ekspansi Toko Lv. 1',
  category: 'EKSPANSI TOKO', robux: 30, paymentStatus: 'VERIFIED', grantStatus: 'APPLIED',
  receiptCreatedAt: '2026-10-08T00:00:00.000Z'
};

describe('purchase schema', () => {
  it('accepts a verified receipt payload', () => expect(purchaseSchema.parse(valid).purchaseId).toBe('receipt-1'));
  it('rejects malformed numeric identifiers', () => expect(() => purchaseSchema.parse({...valid, userId: '0'})).toThrow());
  it('rejects missing or invalid payment verification', () => expect(() => purchaseSchema.parse({...valid, paymentStatus: 'PENDING'})).toThrow());
  it('rejects invalid date values', () => expect(() => purchaseSchema.parse({...valid, receiptCreatedAt: 'no-date'})).toThrow());
  it('rejects negative Robux', () => expect(() => purchaseSchema.parse({...valid, robux: -1})).toThrow());
});
