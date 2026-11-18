import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../common/authorization/role.enum.js';
import { UserService } from '../../user/user.service.js';
import { AccessTokenStrategy } from './access-token.strategy.js';

describe('AccessTokenStrategy', () => {
  const userService = {
    findActiveFarmerById: vi.fn(),
  };
  let strategy: AccessTokenStrategy;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-that-is-at-least-32-bytes';
    vi.clearAllMocks();
    strategy = new AccessTokenStrategy(userService as unknown as UserService);
  });

  afterEach(() => {
    delete process.env.JWT_ACCESS_SECRET;
  });

  it('validates access tokens against an active farmer account', async () => {
    userService.findActiveFarmerById.mockResolvedValue({
      id: 'farmer-id',
      role: UserRole.FARMER,
      isActive: true,
    });

    await expect(
      strategy.validate({ sub: 'farmer-id', role: UserRole.FARMER }),
    ).resolves.toEqual({ sub: 'farmer-id', role: UserRole.FARMER });
  });

  it('rejects tokens carrying any non-farmer role', async () => {
    await expect(
      strategy.validate({ sub: 'user-id', role: UserRole.ADMIN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userService.findActiveFarmerById).not.toHaveBeenCalled();
  });
});
