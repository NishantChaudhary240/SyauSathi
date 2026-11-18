import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export function normalizeDigits(value: string): string {
  return value.replace(/[०-९]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x0966),
  );
}

export function normalizePhoneNumber(value: string): string {
  const asciiValue = normalizeDigits(value).trim();
  const parsed = parsePhoneNumberFromString(asciiValue, 'NP');
  if (
    !parsed ||
    !parsed.isValid() ||
    parsed.country !== 'NP' ||
    parsed.getType() !== 'MOBILE'
  ) {
    throw new BadRequestException('Enter a valid 10-digit Nepal mobile phone number.');
  }

  return parsed.number;
}
