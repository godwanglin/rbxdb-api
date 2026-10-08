import { z } from 'zod';

const id = z.union([
  z.string().regex(/^[1-9]\d{0,15}$/).refine(v => BigInt(v) <= BigInt(Number.MAX_SAFE_INTEGER)),
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
]).transform(String);
const timestamp = z.iso.datetime({ offset: true }).transform(v => new Date(v));
const optionalText = (max: number) => z.string().max(max).nullable().optional();

export const purchaseSchema = z.object({
  purchaseId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  userId: id,
  username: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(100),
  productId: id,
  itemId: z.string().trim().min(1).max(128),
  itemName: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  robux: z.number().int().min(0).max(2_147_483_647),
  storeId: optionalText(128),
  storeName: optionalText(200),
  ownerUserId: id.nullable().optional(),
  beneficiaryUserId: id.nullable().optional(),
  paymentStatus: z.literal('VERIFIED'),
  grantStatus: z.enum(['APPLIED', 'PENDING', 'FAILED', 'UNKNOWN_PRODUCT']),
  failureCode: optionalText(100),
  failureMessage: optionalText(500),
  grantAttempts: z.number().int().min(0).max(2_147_483_647).default(0),
  receiptCreatedAt: timestamp,
  processedAt: timestamp.nullable().optional(),
  completedAt: timestamp.nullable().optional(),
  lastSyncedAt: timestamp.nullable().optional(),
  universeId: id.nullable().optional(),
  placeId: id.nullable().optional(),
  jobId: optionalText(128),
}).strict();

export type PurchaseInput = z.infer<typeof purchaseSchema>;
