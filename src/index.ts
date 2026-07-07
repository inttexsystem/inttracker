export { scanGmail, listPending, assignPedido, getDocumentEvents, exportPendingEvents, classifyAttachment, normalizePedido } from './core/ingest.js';
export { linkDocumentToPedido } from './core/link.js';
export { createScan } from './core/realScan.js';
export { createAssignPedido } from './core/realAssign.js';
export type { ScanResult, ScanOptions, ScanDeps } from './core/realScan.js';
export type { AssignResult, AssignOptions, AssignDeps } from './core/realAssign.js';
export type { LinkResult } from './core/link.js';
