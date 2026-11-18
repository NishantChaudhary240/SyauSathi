import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { normalizeDigits } from '../../common/phone-number.js';

export class RequestOtpDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeDigits(value).trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Matches(/^[+\d\s().-]{8,20}$/)
  phoneNumber!: string;
}
