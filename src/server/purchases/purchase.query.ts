import { z } from 'zod';

const text = z.string().trim().min(1).max(120);
export const purchaseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
  days: z.coerce.number().refine(v => [1, 7, 14, 30].includes(v)).optional(),
  from: z.iso.datetime({ offset: true }).transform(v => new Date(v)).optional(),
  to: z.iso.datetime({ offset: true }).transform(v => new Date(v)).optional(),
  search: text.optional(),
  user: text.optional(),
  category: text.max(100).optional(),
  grantStatus: z.enum(['APPLIED', 'PENDING', 'FAILED', 'UNKNOWN_PRODUCT']).optional(),
  item: text.optional(),
}).strict().refine(q => !(q.days && (q.from || q.to)), 'Use days or from/to')
  .refine(q => !q.from || !q.to || q.from <= q.to, 'Invalid date range');

export function parsePurchaseQuery(params: URLSearchParams) {
  const raw: Record<string, string> = Object.create(null);
  for (const [key, value] of params) {
    if (key in raw) throw new z.ZodError([]);
    if (value !== '') raw[key] = value;
  }
  const query = purchaseQuerySchema.parse(raw);
  return { ...query, from: query.days ? new Date(Date.now() - query.days * 86_400_000) : query.from };
}
