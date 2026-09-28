import type { BranchCode } from '../types';

export const padNum = (n: number, width: number) => String(n).padStart(width, '0');

/** CUS-DHK-000031 */
export const makeCustomerId = (branch: BranchCode, n: number) => `CUS-${branch}-${padNum(n, 6)}`;

/** DHK-SAV-0000012 */
export const makeDepositNo = (branch: BranchCode, shortCode: string, n: number) => `${branch}-${shortCode}-${padNum(n, 7)}`;

/** LN-CTG-PER-000007 */
export const makeLoanNo = (branch: BranchCode, shortCode: string, n: number) => `LN-${branch}-${shortCode}-${padNum(n, 6)}`;

/** TXN-20260928-000451 */
export const makeTxnId = (date: string, n: number) => `TXN-${date.replace(/-/g, '')}-${padNum(n, 6)}`;

/** AUD-000001 */
export const makeAuditId = (n: number) => `AUD-${padNum(n, 6)}`;
