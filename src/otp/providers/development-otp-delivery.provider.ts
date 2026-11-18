import { Injectable, Logger } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { OtpDeliveryProvider } from '../otp-delivery.provider.js';

@Injectable()
export class DevelopmentOtpDeliveryProvider implements OtpDeliveryProvider {
  private readonly logger = new Logger(DevelopmentOtpDeliveryProvider.name);

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Development OTP delivery is disabled in production.',
      );
    }
    this.logger.log(`Development OTP for ${phoneNumber}: ${otp}`);
  }
}
