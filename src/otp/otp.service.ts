import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtpChallengeEntity } from './entities/otp-challenge.entity.js';
import {
  OTP_DELIVERY_PROVIDER,
  type OtpDeliveryProvider,
} from './otp-delivery.provider.js';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpChallengeEntity)
    private readonly challengeRepository: Repository<OtpChallengeEntity>,
    @Inject(OTP_DELIVERY_PROVIDER)
    private readonly deliveryProvider: OtpDeliveryProvider,
  ) {}
}
