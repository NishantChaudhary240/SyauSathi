import { BadRequestException } from '@nestjs/common';
import { normalizeDigits, normalizePhoneNumber } from './phone-number.js';

describe('normalizePhoneNumber', () => {
  it('normalizes valid Nepal mobile numbers (including Devanagari digits) to E.164', () => {
    expect(normalizePhoneNumber('9812345678')).toBe('+9779812345678');
    expect(normalizePhoneNumber('+977 9812345678')).toBe('+9779812345678');
    expect(normalizePhoneNumber('९८४२२ ३४५६७')).toBe('+9779842234567');
    expect(normalizeDigits('१२३४५६')).toBe('123456');
  });

  it('rejects invalid, non-Nepal, and fixed-line numbers', () => {
    expect(() => normalizePhoneNumber('123')).toThrow(BadRequestException);
    expect(() => normalizePhoneNumber('014234567')).toThrow(
      BadRequestException,
    );
    expect(() => normalizePhoneNumber('+14155552671')).toThrow(
      BadRequestException,
    );
  });
});
