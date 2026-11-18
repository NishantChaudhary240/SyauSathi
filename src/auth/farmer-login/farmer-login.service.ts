import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../../common/authorization/role.enum.js';
import { normalizePhoneNumber } from '../../common/phone-number.js';
import { OtpPurpose } from '../../otp/entities/otp-challenge.entity.js';
import { OtpRateLimitException, OtpService } from '../../otp/otp.service.js';
import { TokenPair, TokenService } from '../../tokens/token.service.js';
import { UserEntity } from '../../user/entities/user.entity.js';
import { UserService } from '../../user/user.service.js';

@Injectable()
export class FarmerLoginService {
  private readonly logger = new Logger(FarmerLoginService.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
  ) {}

  async sendOtp(rawPhoneNumber: string): Promise<void> {
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
    const user = await this.userService.findByPhoneNumber(phoneNumber);
    if (!user || user.role !== UserRole.FARMER || !user.isActive) {
      return;
    }

    try {
      await this.otpService.sendOtp(phoneNumber, OtpPurpose.LOGIN);
    } catch (error) {
      if (error instanceof OtpRateLimitException) {
        return;
      }
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn('Login OTP delivery failed.');
        return;
      }
      throw error;
    }
  }

  async verifyOtp(
    rawPhoneNumber: string,
    otp: string,
  ): Promise<{ tokens: TokenPair; user: UserEntity }> {
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
    try {
      await this.otpService.verifyOtp(phoneNumber, OtpPurpose.LOGIN, otp);
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof OtpRateLimitException
      ) {
        throw new UnauthorizedException(
          'Invalid verification code or account.',
        );
      }
      throw error;
    }

    const user = await this.userService.findByPhoneNumber(phoneNumber);
    if (!user || user.role !== UserRole.FARMER || !user.isActive) {
      throw new UnauthorizedException('Invalid verification code or account.');
    }

    const tokens = await this.tokenService.issueTokens(user);
    return { tokens, user };
  }
}
