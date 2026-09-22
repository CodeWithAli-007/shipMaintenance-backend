import 'reflect-metadata';
import { In } from 'typeorm';
import { AppDataSource } from '../data-source.js';
import { User } from '../entities/User.js';
import { UserRole } from '../entities/enums.js';
import { hashPassword } from '../lib/password.js';

const DEMO_PASSWORD = 'password';

const seedUsers = [
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'emma.weber@ship.local',
    fullName: 'Emma Weber',
    role: UserRole.BACKOFFICE,
  },
  {
    id: '22222222-2222-2222-2222-222222222223',
    email: 'lena.schneider@ship.local',
    fullName: 'Lena Schneider',
    role: UserRole.BACKOFFICE,
  },
  {
    id: '44444444-4444-4444-4444-444444444441',
    email: 'thomas.berger@ship.local',
    fullName: 'Thomas Berger',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444442',
    email: 'johannes.mueller@ship.local',
    fullName: 'Johannes Müller',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444443',
    email: 'peter.hoffmann@ship.local',
    fullName: 'Peter Hoffmann',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'daniel.schmidt@ship.local',
    fullName: 'Daniel Schmidt',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444445',
    email: 'lukas.fischer@ship.local',
    fullName: 'Lukas Fischer',
    role: UserRole.TECHNICIAN,
  },
  {
    id: '44444444-4444-4444-4444-444444444446',
    email: 'anna.koch@ship.local',
    fullName: 'Anna Koch',
    role: UserRole.TECHNICIAN,
  },
] as const;

const legacyEmails = [
  'admin@ship.local',
  'backoffice@ship.local',
  'tech@ship.local',
  'ahmed.hassan@ship.local',
  'thomas.berg@ship.local',
  'john.nielsen@ship.local',
  'peter.holm@ship.local',
  'daniel.kowalski@ship.local',
];

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const activeEmails = new Set(seedUsers.map((user) => user.email));

  for (const user of seedUsers) {
    const existing =
      (await repo.findOne({ where: { id: user.id } })) ??
      (await repo.findOne({ where: { email: user.email } }));

    if (existing) {
      existing.email = user.email;
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

  const leftovers = await repo.find({
    where: { email: In(legacyEmails.filter((email) => !activeEmails.has(email))) },
  });
  for (const user of leftovers) {
    user.isActive = false;
    await repo.save(user);
    console.log(`disable ${user.email}`);
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
