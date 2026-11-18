import { Module } from '@nestjs/common';
import { OtpModule } from '../../otp/otp.module.js';
import { TokenModule } from '../../tokens/token.module.js';
import { UserModule } from '../../user/user.module.js';
import { FarmerLoginController } from './farmer-login.controller.js';
import { FarmerLoginService } from './farmer-login.service.js';

@Module({
  imports: [OtpModule, TokenModule, UserModule],
  controllers: [FarmerLoginController],
  providers: [FarmerLoginService],
})
export class FarmerLoginModule {}
