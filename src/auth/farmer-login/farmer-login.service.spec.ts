import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../common/authorization/role.enum.js';
import { OtpPurpose } from '../../otp/entities/otp-challenge.entity.js';
import { OtpService } from '../../otp/otp.service.js';
import { TokenService } from '../../tokens/token.service.js';
import { UserService } from '../../user/user.service.js';
import { FarmerLoginService } from './farmer-login.service.js';

describe('FarmerLoginService', () => {
  let service: FarmerLoginService;
  const user = {
    id: 'farmer-id',
    phoneNumber: '+9779812345678',
    role: UserRole.FARMER,
    isActive: true,
    isProfileComplete: true,
  };
  const tokenPair = {
    accessToken: 'access',
    refreshToken: 'refresh',
    tokenType: 'Bearer' as const,
    expiresIn: 900,
  };
  const otpService = {
    sendOtp: vi.fn(),
    verifyOtp: vi.fn(),
  };
  const tokenService = {
    issueTokens: vi.fn(),
  };
  const userService = {
    findByPhoneNumber: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmerLoginService,
        { provide: OtpService, useValue: otpService },
        { provide: TokenService, useValue: tokenService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get<FarmerLoginService>(FarmerLoginService);
  });

  it('sends a login OTP and issues tokens only after verification', async () => {
    userService.findByPhoneNumber.mockResolvedValue(user);
    tokenService.issueTokens.mockResolvedValue(tokenPair);

    await service.sendOtp('9812345678');
    await expect(service.verifyOtp('9812345678', '123456')).resolves.toEqual({
      tokens: tokenPair,
      user,
    });
    expect(otpService.sendOtp).toHaveBeenCalledWith(
      '+9779812345678',
      OtpPurpose.LOGIN,
    );
    expect(otpService.verifyOtp).toHaveBeenCalledWith(
      '+9779812345678',
      OtpPurpose.LOGIN,
      '123456',
    );
  });

  it('does not send an OTP or reveal whether an account exists', async () => {
    userService.findByPhoneNumber.mockResolvedValue(null);

    await expect(service.sendOtp('9812345678')).resolves.toBeUndefined();
    expect(otpService.sendOtp).not.toHaveBeenCalled();
    await expect(service.verifyOtp('9812345678', '123456')).rejects.toThrow(
      new UnauthorizedException('Invalid verification code or account.'),
    );
  });

  it('does not send OTPs to inactive farmer accounts', async () => {
    userService.findByPhoneNumber.mockResolvedValue({
      ...user,
      isActive: false,
    });

    await expect(service.sendOtp('9812345678')).resolves.toBeUndefined();
    expect(otpService.sendOtp).not.toHaveBeenCalled();
  });
});
