import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import { UserRole } from '../common/authorization/role.enum.js';
import { UserEntity } from '../user/entities/user.entity.js';
import { RefreshTokenEntity } from './entities/refresh-token.entity.js';
import { TokenService } from './token.service.js';

describe('TokenService', () => {
  const user = {
    id: 'user-id',
    role: UserRole.FARMER,
  };
  const jwtService = {
    signAsync: vi.fn().mockResolvedValue('signed-access-token'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues a signed access token and stores only a hash of the refresh token', async () => {
    const savedTokens: Partial<RefreshTokenEntity>[] = [];
    const refreshTokenRepository = {
      create: vi.fn((entity: Partial<RefreshTokenEntity>) => entity),
      save: vi.fn(async (entity: Partial<RefreshTokenEntity>) => {
        savedTokens.push(entity);
        return entity;
      }),
    };
    const service = createService(refreshTokenRepository);

    const result = await service.issueTokens(user);

    expect(result).toMatchObject({
      accessToken: 'signed-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: user.id, role: user.role },
      { expiresIn: 900 },
    );
    expect(savedTokens).toHaveLength(1);
    expect(savedTokens[0]?.tokenHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex'),
    );
    expect(savedTokens[0]?.tokenHash).not.toBe(result.refreshToken);
  });

  it('rotates a refresh token and records the replacement', async () => {
    const oldRefreshToken = 'old-refresh-token';
    const currentToken = createRefreshTokenRecord(oldRefreshToken);
    const transactionRepositories = createTransactionRepositories(
      currentToken,
    );
    const service = createService({
      manager: {
        transaction: vi.fn(
          async (
            callback: (manager: EntityManager) => Promise<unknown>,
          ) => callback(transactionRepositories.manager),
        ),
      },
    });

    const result = await service.rotateRefreshToken(oldRefreshToken);

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).not.toBe(oldRefreshToken);
    expect(currentToken.revokedAt).toBeInstanceOf(Date);
    expect(currentToken.replacedByTokenId).toBe('replacement-id');
    expect(transactionRepositories.refreshTokens.save).toHaveBeenCalledTimes(
      2,
    );
  });

  it('revokes the active token family if a rotated token is reused', async () => {
    const currentToken = createRefreshTokenRecord(
      'already-used-token',
      new Date(),
    );
    const transactionRepositories = createTransactionRepositories(
      currentToken,
    );
    const service = createService({
      manager: {
        transaction: vi.fn(
          async (
            callback: (manager: EntityManager) => Promise<unknown>,
          ) => callback(transactionRepositories.manager),
        ),
      },
    });

    await expect(
      service.rotateRefreshToken('already-used-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(transactionRepositories.refreshTokens.update).toHaveBeenCalled();
  });

  function createService(refreshRepository: object): TokenService {
    return new TokenService(
      jwtService as unknown as JwtService,
      refreshRepository as Repository<RefreshTokenEntity>,
      {} as Repository<UserEntity>,
    );
  }

  function createRefreshTokenRecord(
    rawToken: string,
    revokedAt: Date | null = null,
  ): RefreshTokenEntity {
    return {
      id: 'existing-id',
      userId: user.id,
      familyId: 'family-id',
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt,
      replacedByTokenId: null,
      createdAt: new Date(),
    };
  }

  function createTransactionRepositories(
    currentToken: RefreshTokenEntity,
  ): {
    manager: EntityManager;
    refreshTokens: {
      findOne: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  } {
    const refreshTokens = {
      findOne: vi.fn().mockResolvedValue(currentToken),
      create: vi.fn((entity: Partial<RefreshTokenEntity>) => entity),
      save: vi.fn(async (entity: Partial<RefreshTokenEntity>) => ({
        ...entity,
        id: entity.id ?? 'replacement-id',
      })),
      update: vi.fn(),
    };
    const users = {
      findOne: vi.fn().mockResolvedValue(user),
    };
    const manager = {
      getRepository: vi.fn((entity: typeof RefreshTokenEntity | typeof UserEntity) =>
        entity === RefreshTokenEntity ? refreshTokens : users,
      ),
    };

    return {
      manager: manager as unknown as EntityManager,
      refreshTokens,
    };
  }
});
