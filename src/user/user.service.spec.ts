import { Repository } from 'typeorm';
import { UserRole } from '../common/authorization/role.enum.js';
import { CompleteFarmerProfileDto } from './dto/complete-farmer-profile.dto.js';
import { OrchardType, UserEntity } from './entities/user.entity.js';
import { UserService } from './user.service.js';

describe('UserService', () => {
  const user: UserEntity = {
    id: 'farmer-id',
    phoneNumber: '+9779812345678',
    role: UserRole.FARMER,
    fullName: null,
    district: null,
    municipality: null,
    wardNumber: null,
    treeCount: null,
    orchardType: null,
    profilePhoto: null,
    isProfileComplete: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const repository = {
    create: vi.fn((value: Partial<UserEntity>) => value),
    findOne: vi.fn(),
    save: vi.fn(),
  };
  let service: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserService(repository as unknown as Repository<UserEntity>);
  });

  it('always assigns the farmer role when creating an account', async () => {
    repository.save.mockImplementation(
      async (value: Partial<UserEntity>) => value,
    );

    const created = await service.createFarmer(user.phoneNumber);

    expect(created.role).toBe(UserRole.FARMER);
    expect(created.isActive).toBe(true);
    expect(created.isProfileComplete).toBe(false);
  });

  it('completes the authenticated farmer profile with district required and optional orchard fields', async () => {
    repository.findOne.mockResolvedValue(createFarmer());
    repository.save.mockImplementation(async (value: UserEntity) => value);
    const dto: CompleteFarmerProfileDto = {
      fullName: 'डोल्मा गुरुङ',
      district: 'Mustang',
      municipality: 'Gharapjhong',
      wardNumber: 4,
      treeCount: 40,
      orchardType: OrchardType.TRADITIONAL,
      profilePhoto: 'https://example.com/photo.jpg',
    };

    const updated = await service.completeFarmerProfile(user.id, dto);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: user.id, role: UserRole.FARMER, isActive: true },
    });
    expect(updated).toMatchObject({
      id: user.id,
      role: UserRole.FARMER,
      isActive: true,
      isProfileComplete: true,
      fullName: 'डोल्मा गुरुङ',
      district: 'Mustang',
      municipality: 'Gharapjhong',
      wardNumber: 4,
      treeCount: 40,
      orchardType: OrchardType.TRADITIONAL,
    });
    expect(repository.save).toHaveBeenCalledWith(updated);
  });

  function createFarmer(): UserEntity {
    return Object.assign(new UserEntity(), user);
  }
});
