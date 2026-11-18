import { ConflictException, Injectable } from '@nestjs/common';
import { normalizePhoneNumber } from '../../common/phone-number.js';
import { OtpPurpose } from '../../otp/entities/otp-challenge.entity.js';
import { OtpService } from '../../otp/otp.service.js';
import { TokenPair, TokenService } from '../../tokens/token.service.js';
import { UserEntity } from '../../user/entities/user.entity.js';
import { UserService } from '../../user/user.service.js';

@Injectable()
export class FarmerRegistrationService {
  constructor(
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
  ) {}

  async sendOtp(rawPhoneNumber: string): Promise<void> {
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
    if (await this.userService.findByPhoneNumber(phoneNumber)) {
      throw new ConflictException('A farmer account already exists.');
    }
    await this.otpService.sendOtp(phoneNumber, OtpPurpose.REGISTER);
  }

  async verifyOtp(
    rawPhoneNumber: string,
    otp: string,
  ): Promise<{ tokens: TokenPair; user: UserEntity }> {
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
    await this.otpService.verifyOtp(phoneNumber, OtpPurpose.REGISTER, otp);
    const existing = await this.userService.findByPhoneNumber(phoneNumber);
    if (existing) {
      throw new ConflictException('A farmer account already exists.');
    }

    const user = await this.userService.createFarmer(phoneNumber);
    const tokens = await this.tokenService.issueTokens(user);
    return { tokens, user };
  }
}
