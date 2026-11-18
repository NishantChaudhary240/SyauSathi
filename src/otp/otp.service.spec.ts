import { Repository } from 'typeorm';
import {
  OtpChallengeEntity,
  OtpPurpose,
} from './entities/otp-challenge.entity.js';
import { OtpDeliveryProvider } from './otp-delivery.provider.js';
import { OtpRateLimitException, OtpService } from './otp.service.js';
import { UnauthorizedException } from '@nestjs/common';

describe('OtpService', () => {
  const phoneNumber = '+9779812345678';
  let service: OtpService;
  let challenges: OtpChallengeEntity[];
  let deliveryProvider: { sendOtp: ReturnType<typeof vi.fn> };
  let repository: Repository<OtpChallengeEntity>;

  beforeEach(() => {
    process.env.OTP_HASH_SECRET = 'test-secret-that-is-at-least-32-bytes';
    challenges = [];
    deliveryProvider = { sendOtp: vi.fn().mockResolvedValue(undefined) };
    repository = createRepository();
    service = new OtpService(
      repository,
      deliveryProvider as OtpDeliveryProvider,
    );
  });

  afterEach(() => {
    delete process.env.OTP_HASH_SECRET;
  });

  it('creates a six-digit OTP, stores only its HMAC, and consumes it once', async () => {
    const requestStartedAt = Date.now();
    await service.sendOtp(phoneNumber, OtpPurpose.REGISTER);

    const sentOtp = deliveryProvider.sendOtp.mock.calls[0]?.[1] as string;
    expect(sentOtp).toMatch(/^\d{6}$/);
    expect(challenges).toHaveLength(1);
    expect(challenges[0]?.otpHash).toHaveLength(64);
    expect(challenges[0]?.otpHash).not.toBe(sentOtp);
    expect(challenges[0]!.expiresAt.getTime()).toBeGreaterThanOrEqual(
      requestStartedAt + 5 * 60 * 1_000 - 100,
    );
    expect(challenges[0]!.expiresAt.getTime()).toBeLessThanOrEqual(
      requestStartedAt + 5 * 60 * 1_000 + 100,
    );

    await expect(
      service.verifyOtp(phoneNumber, OtpPurpose.REGISTER, sentOtp),
    ).resolves.toBeUndefined();
    expect(challenges[0]?.usedAt).toBeInstanceOf(Date);
    await expect(
      service.verifyOtp(phoneNumber, OtpPurpose.REGISTER, sentOtp),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid and expired OTPs', async () => {
    await service.sendOtp(phoneNumber, OtpPurpose.LOGIN);
    const sentOtp = deliveryProvider.sendOtp.mock.calls[0]?.[1] as string;
    const invalidOtp = sentOtp === '000000' ? '000001' : '000000';

    await expect(
      service.verifyOtp(phoneNumber, OtpPurpose.LOGIN, invalidOtp),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(challenges[0]?.attemptCount).toBe(1);

    challenges[0]!.expiresAt = new Date(Date.now() - 1);
    await expect(
      service.verifyOtp(phoneNumber, OtpPurpose.LOGIN, sentOtp),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(challenges[0]?.usedAt).toBeInstanceOf(Date);
  });

  it('invalidates an OTP after three failed verification attempts', async () => {
    await service.sendOtp(phoneNumber, OtpPurpose.REGISTER);
    const sentOtp = deliveryProvider.sendOtp.mock.calls[0]?.[1] as string;
    const invalidOtp = sentOtp === '000000' ? '000001' : '000000';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        service.verifyOtp(phoneNumber, OtpPurpose.REGISTER, invalidOtp),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      service.verifyOtp(phoneNumber, OtpPurpose.REGISTER, invalidOtp),
    ).rejects.toBeInstanceOf(OtpRateLimitException);
    expect(challenges[0]?.attemptCount).toBe(3);
    expect(challenges[0]?.usedAt).toBeInstanceOf(Date);
  });

  it('enforces the resend cooldown and per-phone request limit', async () => {
    await service.sendOtp(phoneNumber, OtpPurpose.REGISTER);
    await expect(
      service.sendOtp(phoneNumber, OtpPurpose.REGISTER),
    ).rejects.toBeInstanceOf(OtpRateLimitException);
    expect(deliveryProvider.sendOtp).toHaveBeenCalledTimes(1);

    const firstCreatedAt = challenges[0]!.createdAt;
    challenges[0]!.createdAt = new Date(
      firstCreatedAt.getTime() - 60 * 60 * 1_000,
    );
    for (let request = 1; request <= 5; request += 1) {
      const original = challenges[0]!;
      challenges.push({
        id: `old-${request}`,
        phoneNumber: original.phoneNumber,
        purpose: original.purpose,
        otpHash: original.otpHash,
        expiresAt: original.expiresAt,
        attemptCount: original.attemptCount,
        usedAt: new Date(),
        createdAt: new Date(Date.now() - 61_000),
      });
    }
    await expect(
      service.sendOtp(phoneNumber, OtpPurpose.REGISTER),
    ).rejects.toBeInstanceOf(OtpRateLimitException);
  });

  it('allows a resend after cooldown and invalidates the previous code', async () => {
    await service.sendOtp(phoneNumber, OtpPurpose.LOGIN);
    const oldOtp = deliveryProvider.sendOtp.mock.calls[0]?.[1] as string;
    challenges[0]!.createdAt = new Date(Date.now() - 61_000);

    await service.sendOtp(phoneNumber, OtpPurpose.LOGIN);
    const newOtp = deliveryProvider.sendOtp.mock.calls[1]?.[1] as string;

    expect(challenges[0]?.usedAt).toBeInstanceOf(Date);
    expect(challenges[1]?.usedAt).toBeNull();
    if (newOtp !== oldOtp) {
      await expect(
        service.verifyOtp(phoneNumber, OtpPurpose.LOGIN, oldOtp),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      service.verifyOtp(phoneNumber, OtpPurpose.LOGIN, newOtp),
    ).resolves.toBeUndefined();
  });

  it('invalidates the newly created challenge when SMS delivery fails', async () => {
    deliveryProvider.sendOtp.mockRejectedValueOnce(new Error('SMS failed'));

    await expect(
      service.sendOtp(phoneNumber, OtpPurpose.REGISTER),
    ).rejects.toThrow('Unable to send an OTP at this time.');
    expect(challenges[0]?.usedAt).toBeInstanceOf(Date);
  });

  function createRepository(): Repository<OtpChallengeEntity> {
    const matchesWhere = (
      challenge: OtpChallengeEntity,
      where: Record<string, unknown>,
    ) => {
      for (const [key, expected] of Object.entries(where)) {
        if (key === 'createdAt') {
          const cutoff = (expected as { value: Date }).value;
          if (challenge.createdAt < cutoff) return false;
        } else if (key === 'usedAt') {
          if (challenge.usedAt !== null) return false;
        } else if (challenge[key as keyof OtpChallengeEntity] !== expected) {
          return false;
        }
      }
      return true;
    };

    const mockRepository = {
      manager: undefined as unknown,
      count: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          challenges.filter((challenge) => matchesWhere(challenge, where))
            .length,
      ),
      findOne: vi.fn(
        async ({
          where,
        }: {
          where: Record<string, unknown>;
          order?: unknown;
        }) =>
          challenges
            .filter((challenge) => matchesWhere(challenge, where))
            .sort(
              (left, right) =>
                right.createdAt.getTime() - left.createdAt.getTime(),
            )[0] ?? null,
      ),
      create: vi.fn((values: Partial<OtpChallengeEntity>) => values),
      save: vi.fn(async (value: Partial<OtpChallengeEntity>) => {
        const existing = challenges.find(
          (challenge) => challenge.id === value.id,
        );
        if (existing) {
          Object.assign(existing, value);
          return existing;
        }
        const saved = {
          ...value,
          id: value.id ?? `challenge-${challenges.length + 1}`,
          createdAt: value.createdAt ?? new Date(),
        } as OtpChallengeEntity;
        challenges.push(saved);
        return saved;
      }),
      update: vi.fn(
        async (
          where: Record<string, unknown>,
          values: Partial<OtpChallengeEntity>,
        ) => {
          for (const challenge of challenges) {
            if (matchesWhere(challenge, where)) {
              Object.assign(challenge, values);
            }
          }
        },
      ),
    };
    const manager = {
      query: vi.fn().mockResolvedValue(undefined),
      getRepository: vi.fn(() => mockRepository),
    };
    mockRepository.manager = {
      transaction: vi.fn(
        async (callback: (transactionManager: typeof manager) => unknown) =>
          callback(manager),
      ),
    };

    return mockRepository as unknown as Repository<OtpChallengeEntity>;
  }
});
