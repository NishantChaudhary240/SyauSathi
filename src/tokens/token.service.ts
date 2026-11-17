import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { UserEntity } from '../user/entities/user.entity.js';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

type RotationResult =
  | { kind: 'rotated'; tokens: TokenPair }
  | { kind: 'invalid' | 'expired' | 'reused' };

@Injectable()
export class TokenService {
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {
    this.accessTokenTtlSeconds = this.readPositiveInteger(
      'JWT_ACCESS_TOKEN_TTL_SECONDS',
      900,
    );
    this.refreshTokenTtlSeconds = this.readPositiveInteger(
      'JWT_REFRESH_TOKEN_TTL_SECONDS',
      2_592_000,
    );
  }

  async issueTokens(user: Pick<UserEntity, 'id' | 'role'>): Promise<TokenPair> {
    const now = new Date();
    const refreshToken = this.createRefreshToken();
    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: this.hashToken(refreshToken),
      expiresAt: this.getRefreshTokenExpiry(now),
      revokedAt: null,
      replacedByTokenId: null,
    });
    const tokens = await this.createTokenPair(user, refreshToken);

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return tokens;
  }

  async rotateRefreshToken(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const now = new Date();

    const result = await this.refreshTokenRepository.manager.transaction(
      async (manager): Promise<RotationResult> => {
        const refreshTokens = manager.getRepository(RefreshTokenEntity);
        const users = manager.getRepository(UserEntity);
        const currentToken = await refreshTokens.findOne({
          where: { tokenHash },
          lock: { mode: 'pessimistic_write' },
        });

        if (!currentToken) {
          return { kind: 'invalid' };
        }

        if (currentToken.revokedAt) {
          await this.revokeFamily(refreshTokens, currentToken.familyId, now);
          return { kind: 'reused' };
        }

        if (currentToken.expiresAt <= now) {
          currentToken.revokedAt = now;
          await refreshTokens.save(currentToken);
          return { kind: 'expired' };
        }

        const user = await users.findOne({
          where: { id: currentToken.userId },
        });
        if (!user) {
          currentToken.revokedAt = now;
          await refreshTokens.save(currentToken);
          return { kind: 'invalid' };
        }

        const nextRefreshToken = this.createRefreshToken();
        const replacement = refreshTokens.create({
          userId: currentToken.userId,
          familyId: currentToken.familyId,
          tokenHash: this.hashToken(nextRefreshToken),
          expiresAt: this.getRefreshTokenExpiry(now),
          revokedAt: null,
          replacedByTokenId: null,
        });
        const tokens = await this.createTokenPair(user, nextRefreshToken);
        const savedReplacement = await refreshTokens.save(replacement);

        currentToken.revokedAt = now;
        currentToken.replacedByTokenId = savedReplacement.id;
        await refreshTokens.save(currentToken);

        return { kind: 'rotated', tokens };
      },
    );

    if (result.kind !== 'rotated') {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return result.tokens;
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    await this.refreshTokenRepository.update(
      {
        tokenHash: this.hashToken(rawRefreshToken),
        revokedAt: IsNull(),
      },
      { revokedAt: new Date() },
    );
  }

  private async createTokenPair(
    user: Pick<UserEntity, 'id' | 'role'>,
    refreshToken: string,
  ): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, role: user.role },
      { expiresIn: this.accessTokenTtlSeconds },
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenTtlSeconds,
    };
  }

  private createRefreshToken(): string {
    return randomBytes(64).toString('base64url');
  }

  private getRefreshTokenExpiry(now: Date): Date {
    return new Date(now.getTime() + this.refreshTokenTtlSeconds * 1_000);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async revokeFamily(
    refreshTokens: Repository<RefreshTokenEntity>,
    familyId: string,
    revokedAt: Date,
  ): Promise<void> {
    await refreshTokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt },
    );
  }

  private readPositiveInteger(name: string, fallback: number): number {
    const value = process.env[name];
    if (value === undefined) {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new Error(`${name} must be a positive integer.`);
    }

    return parsed;
  }
}
