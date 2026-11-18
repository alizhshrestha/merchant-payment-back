import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { loadCliEnvironment } from '../config/cli-environment';
import { databaseOptions } from './database-options';
import { seedUsers } from './seed-users';

async function main() {
  const environment = loadCliEnvironment();
  if (!['development', 'test'].includes(String(environment.NODE_ENV))) {
    throw new Error(
      'Local seed command is only available in development or test',
    );
  }
  const database = new DataSource(
    databaseOptions(new ConfigService(environment)),
  );
  try {
    await database.initialize();
    if (await database.showMigrations())
      throw new Error('Run migration:run before seeding');
    const summary = await seedUsers(database, environment);
    for (const user of summary)
      console.log(`${user.role}: ${user.email} (${user.status})`);
  } finally {
    if (database.isInitialized) await database.destroy();
  }
}

void main().catch(() => {
  console.error(
    'Seed failed. Check local NODE_ENV, all three SEED_*_PASSWORD values (15–128 characters), database connectivity, migrations, and existing account roles. No existing passwords or roles were changed.',
  );
  process.exitCode = 1;
});
