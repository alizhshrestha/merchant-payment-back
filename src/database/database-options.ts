import { ConfigService } from '@nestjs/config';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { join } from 'node:path';
import { User } from './entities/user.entity';
import { MerchantApplication } from './entities/merchant-application.entity';
import { RiskReview } from './entities/risk-review.entity';
import { AuditLog } from './entities/audit-log.entity';

export function databaseOptions(
  config: ConfigService,
): PostgresConnectionOptions {
  return {
    type: 'postgres',
    host: config.getOrThrow<string>('POSTGRES_HOST'),
    port: config.getOrThrow<number>('POSTGRES_PORT'),
    username: config.getOrThrow<string>('POSTGRES_USER'),
    password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
    database: config.getOrThrow<string>('POSTGRES_DB'),
    entities: [User, MerchantApplication, RiskReview, AuditLog],
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: false,
    // PostgreSQL 17 provides gen_random_uuid() without installing an extension.
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    connectTimeoutMS: 5000,
  };
}
