import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpChallengeEntity } from './entities/otp-challenge.entity.js';
import {
  OTP_DELIVERY_PROVIDER,
  type OtpDeliveryProvider,
} from './otp-delivery.provider.js';
import { OtpService } from './otp.service.js';
import { DevelopmentOtpDeliveryProvider } from './providers/development-otp-delivery.provider.js';
import { SparrowOtpDeliveryProvider } from './providers/sparrow-otp-delivery.provider.js';

function selectDeliveryProvider(
  developmentProvider: DevelopmentOtpDeliveryProvider,
  sparrowProvider: SparrowOtpDeliveryProvider,
): OtpDeliveryProvider {
  const providerName =
    process.env.OTP_DELIVERY_PROVIDER ??
    (process.env.NODE_ENV === 'production' ? 'sparrow' : 'development');

  if (providerName === 'development') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'The development OTP provider cannot be enabled in production.',
      );
    }
    return developmentProvider;
  }
  if (providerName === 'sparrow') {
    return sparrowProvider;
  }
  throw new Error(`Unsupported OTP_DELIVERY_PROVIDER: ${providerName}`);
}

@Module({
  imports: [TypeOrmModule.forFeature([OtpChallengeEntity])],
  providers: [
    OtpService,
    DevelopmentOtpDeliveryProvider,
    SparrowOtpDeliveryProvider,
    {
      provide: OTP_DELIVERY_PROVIDER,
      inject: [DevelopmentOtpDeliveryProvider, SparrowOtpDeliveryProvider],
      useFactory: selectDeliveryProvider,
    },
  ],
  exports: [OtpService],
})
export class OtpModule {}
