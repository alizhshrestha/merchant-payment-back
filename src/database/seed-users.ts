import Joi from 'joi';
import { DataSource } from 'typeorm';
import { PasswordService } from '../auth/password.service';
import { User, UserRole } from './entities/user.entity';

interface SeedEnvironment {
  NODE_ENV: 'development' | 'test';
  SEED_ADMIN_PASSWORD: string;
  SEED_SALES_PASSWORD: string;
  SEED_REVIEWER_PASSWORD: string;
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test').required(),
  SEED_ADMIN_PASSWORD: Joi.string().min(15).max(128).pattern(/\S/).required(),
  SEED_SALES_PASSWORD: Joi.string().min(15).max(128).pattern(/\S/).required(),
  SEED_REVIEWER_PASSWORD: Joi.string()
    .min(15)
    .max(128)
    .pattern(/\S/)
    .required(),
});

export async function seedUsers(
  database: DataSource,
  environment: Record<string, unknown>,
) {
  const result = schema.validate(environment, {
    allowUnknown: true,
    abortEarly: false,
  });
  if (result.error)
    throw new Error(`Seed configuration error: ${result.error.message}`);
  const settings = result.value as SeedEnvironment;
  const accounts = [
    {
      name: 'Local Admin',
      email: 'admin@merchant.local',
      role: UserRole.ADMIN,
      password: settings.SEED_ADMIN_PASSWORD,
    },
    {
      name: 'Local Sales',
      email: 'sales@merchant.local',
      role: UserRole.SALES,
      password: settings.SEED_SALES_PASSWORD,
    },
    {
      name: 'Local Reviewer',
      email: 'reviewer@merchant.local',
      role: UserRole.REVIEWER,
      password: settings.SEED_REVIEWER_PASSWORD,
    },
  ];
  const passwords = new PasswordService();
  return database.transaction(async (manager) => {
    // Serialize concurrent seed runs; the unique email index remains the final safeguard.
    await manager.query('SELECT pg_advisory_xact_lock(62712001)');
    const repository = manager.getRepository(User);
    const summary: {
      email: string;
      role: UserRole;
      status: 'created' | 'existing';
    }[] = [];
    for (const account of accounts) {
      const existing = await repository
        .createQueryBuilder('user')
        .where('LOWER(user.email) = :email', { email: account.email })
        .getOne();
      if (existing) {
        if (existing.role !== account.role)
          throw new Error(`Seed role conflict for ${account.email}`);
        summary.push({
          email: account.email,
          role: account.role,
          status: 'existing',
        });
        continue;
      }
      await repository.insert({
        name: account.name,
        email: account.email,
        role: account.role,
        passwordHash: await passwords.hash(account.password),
      });
      summary.push({
        email: account.email,
        role: account.role,
        status: 'created',
      });
    }
    return summary;
  });
}
