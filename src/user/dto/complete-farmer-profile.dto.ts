import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { normalizeDigits } from '../../common/phone-number.js';
import { OrchardType } from '../entities/user.entity.js';

function trimOrUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value === null ? undefined : value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseIntOrUndefined(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = normalizeDigits(value).trim();
    if (normalized === '') {
      return undefined;
    }
    return Number(normalized);
  }
  return value;
}

export class CompleteFarmerProfileDto {
  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  district!: string;

  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  municipality?: string;

  @IsOptional()
  @Transform(({ value }) => parseIntOrUndefined(value))
  @IsInt()
  @Min(1)
  @Max(255)
  wardNumber?: number;

  @IsOptional()
  @Transform(({ value }) => parseIntOrUndefined(value))
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  treeCount?: number;

  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsEnum(OrchardType)
  orchardType?: OrchardType;

  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  profilePhoto?: string;
}
