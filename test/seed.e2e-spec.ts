import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import configuredSource from '../src/database/data-source';
import { User, UserRole } from '../src/database/entities/user.entity';
import { seedUsers } from '../src/database/seed-users';
import { PasswordService } from '../src/auth/password.service';

describe('Local user seed', () => {
  const name = `merchant_seed_test_${randomUUID().replaceAll('-', '')}`;
  const environment = {
    NODE_ENV: 'test',
    SEED_ADMIN_PASSWORD: 'Admin test passphrase!',
    SEED_SALES_PASSWORD: 'Sales test passphrase!',
    SEED_REVIEWER_PASSWORD: 'Reviewer test passphrase!',
  };
  let admin: DataSource;
  let database: DataSource;
  let createdDatabase = false;
  const passwords = new PasswordService();

  beforeAll(async () => {
    admin = new DataSource({
      ...configuredSource.options,
      entities: [],
      migrations: [],
    });
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${name}"`);
    createdDatabase = true;
    database = new DataSource({ ...configuredSource.options, database: name });
    await database.initialize();
    await database.runMigrations();
  });

  beforeEach(async () => {
    await database.query('DELETE FROM users');
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      if (createdDatabase) await admin.query(`DROP DATABASE "${name}"`);
      await admin.destroy();
    }
  });

  function readUsers() {
    return database
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .orderBy('user.email')
      .getMany();
  }

  it('creates the three roles with verifiable hashes, not plaintext passwords', async () => {
    const summary = await seedUsers(database, environment);
    expect(summary.map((user) => user.status)).toEqual([
      'created',
      'created',
      'created',
    ]);
    const users = await readUsers();
    expect(users.map((user) => user.role)).toEqual([
      UserRole.ADMIN,
      UserRole.REVIEWER,
      UserRole.SALES,
    ]);
    for (const user of users) {
      const password = environment[`SEED_${user.role}_PASSWORD`];
      expect(user.passwordHash).not.toBe(password);
      expect(await passwords.verify(password, user.passwordHash)).toBe(true);
      expect(await passwords.verify('wrong password', user.passwordHash)).toBe(
        false,
      );
    }
    const defaultRead = await database.getRepository(User).find();
    expect(defaultRead.every((user) => user.passwordHash === undefined)).toBe(
      true,
    );
  });

  it('preserves existing IDs and hashes on rerun, including mixed-case emails', async () => {
    await seedUsers(database, environment);
    await database.query('UPDATE users SET email = UPPER(email)');
    const before = await readUsers();
    const summary = await seedUsers(database, {
      ...environment,
      SEED_ADMIN_PASSWORD: 'A different password!',
    });
    expect(summary.every((user) => user.status === 'existing')).toBe(true);
    expect(await readUsers()).toEqual(before);
  });

  it('serializes concurrent seed runs without duplicate accounts', async () => {
    await Promise.all([
      seedUsers(database, environment),
      seedUsers(database, environment),
    ]);
    expect(await database.getRepository(User).count()).toBe(3);
  });

  it.each([
    { ...environment, NODE_ENV: 'production' },
    { ...environment, SEED_ADMIN_PASSWORD: '' },
    { ...environment, SEED_SALES_PASSWORD: 'short' },
  ])('rejects invalid seed settings before writing users', async (settings) => {
    await expect(seedUsers(database, settings)).rejects.toThrow(
      'Seed configuration error',
    );
    expect(await database.getRepository(User).count()).toBe(0);
  });

  it('rolls back newly inserted users on a role conflict without changing existing users', async () => {
    const existing = await database.getRepository(User).save({
      name: 'Existing',
      email: 'sales@merchant.local',
      passwordHash: 'existing-hash',
      role: UserRole.REVIEWER,
    });
    await expect(seedUsers(database, environment)).rejects.toThrow(
      'Seed role conflict',
    );
    const users = await readUsers();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      id: existing.id,
      role: UserRole.REVIEWER,
      passwordHash: 'existing-hash',
    });
  });
});
