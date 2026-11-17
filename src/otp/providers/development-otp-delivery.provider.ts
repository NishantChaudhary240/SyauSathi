import { Injectable, Logger } from '@nestjs/common';
import { OtpDeliveryProvider } from '../otp-delivery.provider.js';

@Injectable()
export class DevelopmentOtpDeliveryProvider implements OtpDeliveryProvider {
  private readonly logger = new Logger(DevelopmentOtpDeliveryProvider.name);

  async sendOtp(mobileNumber: string, otp: string): Promise<void> {
    this.logger.log(`Development OTP for ${mobileNumber}: ${otp}`);
  }
}
