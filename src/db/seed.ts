import 'reflect-metadata';
import { AppDataSource } from '../data-source.js';
import { User } from '../entities/User.js';
import { UserRole } from '../entities/enums.js';
import { hashPassword } from '../lib/password.js';

const DEMO_PASSWORD = 'password';

const seedUsers = [
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'backoffice@ship.local',
    fullName: 'Emma Larsen',
    role: UserRole.BACKOFFICE,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'tech@ship.local',
    fullName: 'Field Technician',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444441',
    email: 'ahmed.hassan@ship.local',
    fullName: 'Ahmed Hassan',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444442',
    email: 'thomas.berg@ship.local',
    fullName: 'Thomas Berg',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444443',
    email: 'john.nielsen@ship.local',
    fullName: 'John Nielsen',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'peter.holm@ship.local',
    fullName: 'Peter Holm',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444445',
    email: 'daniel.kowalski@ship.local',
    fullName: 'Daniel Kowalski',
    role: UserRole.TECHNICIAN,
  },
] as const;

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const legacyAdmin = await repo.findOne({ where: { email: 'admin@ship.local' } });
  if (legacyAdmin) {
    legacyAdmin.isActive = false;
    await repo.save(legacyAdmin);
    console.log('disable admin@ship.local');
  }

  for (const user of seedUsers) {
    const existing = await repo.findOne({ where: { email: user.email } });
    if (existing) {
      existing.fullName = user.fullName;
      existing.role = user.role;
      existing.passwordHash = passwordHash;
      existing.isActive = true;
      await repo.save(existing);
      console.log(`update ${user.email}`);
      continue;
    }

    await repo.save(
      repo.create({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash,
        isActive: true,
      }),
    );
    console.log(`seed   ${user.email}`);
  }
}

seed()
  .then(async () => {
    console.log('Seed complete. Demo password: password');
    await AppDataSource.destroy();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exitCode = 1;
  });
