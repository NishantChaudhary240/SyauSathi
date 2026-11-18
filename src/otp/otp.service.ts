import {
  Inject,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import {
  OtpChallengeEntity,
  OtpPurpose,
} from './entities/otp-challenge.entity.js';
import {
  OTP_DELIVERY_PROVIDER,
  type OtpDeliveryProvider,
} from './otp-delivery.provider.js';

const OTP_LIFETIME_MS = 5 * 60 * 1_000;
const RESEND_COOLDOWN_MS = 60 * 1_000;
const REQUEST_WINDOW_MS = 60 * 60 * 1_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_VERIFICATION_ATTEMPTS = 3;

type VerificationResult = 'verified' | 'invalid' | 'attempts-exceeded';

export class OtpRateLimitException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class OtpService {
  private readonly hashSecret: string;

  constructor(
    @InjectRepository(OtpChallengeEntity)
    private readonly challengeRepository: Repository<OtpChallengeEntity>,
    @Inject(OTP_DELIVERY_PROVIDER)
    private readonly deliveryProvider: OtpDeliveryProvider,
  ) {
    const secret = process.env.OTP_HASH_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new Error('OTP_HASH_SECRET must contain at least 32 bytes.');
    }
    this.hashSecret = secret;
  }

  async sendOtp(phoneNumber: string, purpose: OtpPurpose): Promise<void> {
    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    let challengeId: string | undefined;

    await this.challengeRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `otp:${purpose}:${phoneNumber}`,
      ]);
      const now = new Date();
      const challenges = manager.getRepository(OtpChallengeEntity);
      const windowStart = new Date(now.getTime() - REQUEST_WINDOW_MS);
      const recentRequests = await challenges.count({
        where: {
          phoneNumber,
          purpose,
          createdAt: MoreThanOrEqual(windowStart),
        },
      });

      if (recentRequests >= MAX_REQUESTS_PER_WINDOW) {
        throw new OtpRateLimitException(
          'OTP request limit reached. Try again later.',
        );
      }

      const latestChallenge = await challenges.findOne({
        where: { phoneNumber, purpose },
        order: { createdAt: 'DESC' },
      });
      if (
        latestChallenge &&
        latestChallenge.createdAt.getTime() > now.getTime() - RESEND_COOLDOWN_MS
      ) {
        throw new OtpRateLimitException(
          'Please wait before requesting another OTP.',
        );
      }

      await challenges.update(
        { phoneNumber, purpose, usedAt: IsNull() },
        { usedAt: now },
      );

      const challenge = challenges.create({
        phoneNumber,
        purpose,
        otpHash: this.hashOtp(phoneNumber, purpose, otp),
        expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
        attemptCount: 0,
        usedAt: null,
      });
      const savedChallenge = await challenges.save(challenge);
      challengeId = savedChallenge.id;
    });

    try {
      await this.deliveryProvider.sendOtp(phoneNumber, otp);
    } catch (error) {
      if (challengeId) {
        await this.challengeRepository.update(
          { id: challengeId, usedAt: IsNull() },
          { usedAt: new Date() },
        );
      }
      throw new ServiceUnavailableException(
        'Unable to send an OTP at this time.',
        { cause: error },
      );
    }
  }

  async verifyOtp(
    phoneNumber: string,
    purpose: OtpPurpose,
    otp: string,
  ): Promise<void> {
    const result = await this.challengeRepository.manager.transaction(
      async (manager): Promise<VerificationResult> => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `otp:${purpose}:${phoneNumber}`,
        ]);
        const now = new Date();
        const challenges = manager.getRepository(OtpChallengeEntity);
        const challenge = await challenges.findOne({
          where: { phoneNumber, purpose, usedAt: IsNull() },
          order: { createdAt: 'DESC' },
          lock: { mode: 'pessimistic_write' },
        });

        if (!challenge || challenge.expiresAt <= now) {
          if (challenge) {
            challenge.usedAt = now;
            await challenges.save(challenge);
          }
          return 'invalid';
        }

        if (challenge.attemptCount >= MAX_VERIFICATION_ATTEMPTS) {
          challenge.usedAt = now;
          await challenges.save(challenge);
          return 'attempts-exceeded';
        }

        const matches = this.matchesOtp(
          phoneNumber,
          purpose,
          otp,
          challenge.otpHash,
        );
        if (!matches) {
          challenge.attemptCount += 1;
          if (challenge.attemptCount >= MAX_VERIFICATION_ATTEMPTS) {
            challenge.usedAt = now;
          }
          await challenges.save(challenge);
          return challenge.attemptCount >= MAX_VERIFICATION_ATTEMPTS
            ? 'attempts-exceeded'
            : 'invalid';
        }

        challenge.usedAt = now;
        await challenges.save(challenge);
        return 'verified';
      },
    );

    if (result === 'attempts-exceeded') {
      throw new OtpRateLimitException(
        'OTP verification attempt limit exceeded.',
      );
    }
    if (result === 'invalid') {
      throw new UnauthorizedException('Invalid or expired OTP.');
    }
  }

  private hashOtp(
    phoneNumber: string,
    purpose: OtpPurpose,
    otp: string,
  ): string {
    return createHmac('sha256', this.hashSecret)
      .update(`${phoneNumber}\0${purpose}\0${otp}`)
      .digest('hex');
  }

  private matchesOtp(
    phoneNumber: string,
    purpose: OtpPurpose,
    otp: string,
    expectedHash: string,
  ): boolean {
    if (!/^\d{6}$/.test(otp) || !/^[a-f\d]{64}$/i.test(expectedHash)) {
      return false;
    }

    const actual = Buffer.from(this.hashOtp(phoneNumber, purpose, otp), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
}
