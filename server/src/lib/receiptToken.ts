import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';

export function signReceiptToken(saleId: string): string {
  return createHmac('sha256', config.JWT_ACCESS_SECRET)
    .update(saleId)
    .digest('hex');
}

export function verifyReceiptToken(saleId: string, token: string): boolean {
  try {
    const expected = signReceiptToken(saleId);
    return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
