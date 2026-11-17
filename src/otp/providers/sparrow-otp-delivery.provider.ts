import { Injectable } from '@nestjs/common';
import { OtpDeliveryProvider } from '../otp-delivery.provider.js';

@Injectable()
export class SparrowOtpDeliveryProvider implements OtpDeliveryProvider {
  async sendOtp(): Promise<void> {
    throw new Error('Sparrow OTP delivery has not been configured.');
  }
}
