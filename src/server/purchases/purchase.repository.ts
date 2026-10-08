import { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';
import type { PurchaseInput } from './purchase.schema';

const summarySelect = {
  purchaseId: true, userId: true, username: true, displayName: true,
  productId: true, itemId: true, itemName: true, category: true, robux: true,
  storeId: true, storeName: true, ownerUserId: true, beneficiaryUserId: true,
  paymentStatus: true, grantStatus: true, failureCode: true, grantAttempts: true,
  receiptCreatedAt: true, completedAt: true, createdAt: true, updatedAt: true,
} satisfies Prisma.PurchaseSelect;

export async function upsertPurchase(input: PurchaseInput) {
  const data = {
    ...input,
    userId: BigInt(input.userId), productId: BigInt(input.productId),
    ownerUserId: input.ownerUserId ? BigInt(input.ownerUserId) : null,
    beneficiaryUserId: input.beneficiaryUserId ? BigInt(input.beneficiaryUserId) : null,
    universeId: input.universeId ? BigInt(input.universeId) : null,
    placeId: input.placeId ? BigInt(input.placeId) : null,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const current = await tx.purchase.findUnique({ where: { purchaseId: input.purchaseId } });
        if (current && (current.userId !== data.userId || current.productId !== data.productId || current.robux !== data.robux)) {
          throw new Error('RECEIPT_IDENTITY_CONFLICT');
        }
        if (current?.grantStatus === 'APPLIED') {
          if (input.grantStatus !== 'APPLIED') return current;
          return tx.purchase.update({ where: { purchaseId: input.purchaseId }, data: {
            grantAttempts: Math.max(current.grantAttempts, input.grantAttempts),
            completedAt: current.completedAt ?? data.completedAt ?? new Date(),
            storeId: current.storeId ?? data.storeId,
            storeName: current.storeName ?? data.storeName,
            ownerUserId: current.ownerUserId ?? data.ownerUserId,
            beneficiaryUserId: current.beneficiaryUserId ?? data.beneficiaryUserId,
            lastSyncedAt: new Date(),
          } });
        }
        if (current && input.grantStatus !== 'APPLIED') {
          if (input.grantAttempts < current.grantAttempts) return current;
          if (input.grantAttempts === current.grantAttempts && current.processedAt && data.processedAt && data.processedAt < current.processedAt) return current;
        }
        const next = {
          ...data, grantAttempts: Math.max(data.grantAttempts, current?.grantAttempts ?? 0),
          receiptCreatedAt: current?.receiptCreatedAt ?? data.receiptCreatedAt, lastSyncedAt: new Date(),
        };
        if (next.grantStatus === 'APPLIED') {
          next.completedAt = next.completedAt ?? new Date();
          next.failureCode = null;
          next.failureMessage = null;
        }
        return tx.purchase.upsert({ where: { purchaseId: input.purchaseId }, create: next, update: next });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code) && attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1) + Math.random() * 20));
        continue;
      }
      throw error;
    }
  }
  throw new Error('UPSERT_RETRY_EXHAUSTED');
}

export function findPurchase(purchaseId: string) {
  return prisma.purchase.findUnique({ where: { purchaseId } });
}

type PurchaseQuery = {
  from?: Date; to?: Date; search?: string; user?: string; category?: string;
  grantStatus?: string; item?: string; page: number; pageSize: number;
};

export async function listPurchases(query: PurchaseQuery) {
  const clauses: Prisma.PurchaseWhereInput[] = [];
  if (query.from || query.to) clauses.push({ createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } });
  if (query.user) clauses.push({ OR: [
    { username: { contains: query.user } }, { displayName: { contains: query.user } },
    ...(/^\d{1,16}$/.test(query.user) ? [{ userId: BigInt(query.user) }] : []),
  ] });
  if (query.search) {
    const term = query.search.startsWith('@') ? query.search.slice(1) : query.search;
    clauses.push({ OR: [
      { username: { contains: term } }, { displayName: { contains: term } },
      { itemId: { contains: term } }, { itemName: { contains: term } },
      ...(/^\d{1,16}$/.test(term) ? [{ userId: BigInt(term) }] : []),
    ] });
  }
  if (query.category) clauses.push({ category: query.category });
  if (query.grantStatus) clauses.push({ grantStatus: query.grantStatus as Prisma.EnumGrantStatusFilter['equals'] });
  if (query.item) clauses.push({ OR: [{ itemId: { contains: query.item } }, { itemName: { contains: query.item } }] });
  const where = { AND: clauses };
  const [data, total] = await prisma.$transaction([
    prisma.purchase.findMany({ where, select: summarySelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.purchase.count({ where }),
  ]);
  return { data, total };
}
