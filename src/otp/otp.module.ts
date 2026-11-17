import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpChallengeEntity } from './entities/otp-challenge.entity.js';
import { OTP_DELIVERY_PROVIDER } from './otp-delivery.provider.js';
import { OtpService } from './otp.service.js';
import { DevelopmentOtpDeliveryProvider } from './providers/development-otp-delivery.provider.js';

@Module({
  imports: [TypeOrmModule.forFeature([OtpChallengeEntity])],
  providers: [
    OtpService,
    DevelopmentOtpDeliveryProvider,
    {
      provide: OTP_DELIVERY_PROVIDER,
      useExisting: DevelopmentOtpDeliveryProvider,
    },
  ],
  exports: [OtpService],
})
export class OtpModule {}
