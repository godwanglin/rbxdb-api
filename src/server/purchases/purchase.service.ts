import {purchaseSchema,type PurchaseInput} from './purchase.schema'; import {upsertPurchase,findPurchase,listPurchases} from './purchase.repository';
export async function ingest(raw:unknown){return upsertPurchase(purchaseSchema.parse(raw));} export {findPurchase,listPurchases}; export {purchaseSchema}; export type {PurchaseInput};
