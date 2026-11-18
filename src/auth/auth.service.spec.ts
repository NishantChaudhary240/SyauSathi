import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../common/authorization/role.enum.js';
import { TokenService } from '../tokens/token.service.js';
import { UserService } from '../user/user.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const tokenService = {
    rotateRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
  };
  const userService = {
    findActiveFarmerById: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: TokenService, useValue: tokenService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('gets the authenticated farmer profile', async () => {
    const farmer = { id: 'farmer-id', role: UserRole.FARMER };
    userService.findActiveFarmerById.mockResolvedValue(farmer);

    await expect(service.getCurrentFarmer(farmer.id)).resolves.toBe(farmer);
    expect(userService.findActiveFarmerById).toHaveBeenCalledWith(farmer.id);
  });

  it('delegates refresh and logout token operations', async () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    tokenService.rotateRefreshToken.mockResolvedValue(tokens);
    tokenService.revokeRefreshToken.mockResolvedValue(undefined);

    await expect(service.rotateRefreshToken('old-refresh')).resolves.toBe(
      tokens,
    );
    await expect(
      service.revokeRefreshToken('refresh'),
    ).resolves.toBeUndefined();
    expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith('refresh');
  });
});
