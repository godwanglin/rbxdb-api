export type GrantStatus = 'APPLIED' | 'PENDING' | 'FAILED' | 'UNKNOWN_PRODUCT';

export type Purchase = {
  purchaseId: string; userId: string; username: string; displayName: string;
  productId: string; itemId: string; itemName: string; category: string; robux: number;
  storeId: string | null; storeName: string | null; ownerUserId: string | null;
  beneficiaryUserId: string | null; paymentStatus: 'VERIFIED'; grantStatus: GrantStatus;
  failureCode: string | null; failureMessage?: string | null; grantAttempts: number;
  receiptCreatedAt: string; processedAt?: string | null; completedAt: string | null;
  lastSyncedAt?: string | null; universeId?: string | null; placeId?: string | null;
  jobId?: string | null; createdAt: string; updatedAt: string;
};

export type Summary = { total: number; robux: number; applied: number; pending: number; failed: number; unknown: number };
export type ListData = { items: Purchase[]; total: number; page: number; pageSize: number; summary: Summary; categories: string[] };
export type Filters = { days: string; search: string; category: string; grantStatus: string };
export type Envelope<T> = { status: 'success' | 'error'; data: T | null; error: { code: string; message: string } | null };
