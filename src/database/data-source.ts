import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { environmentSchema } from '../config/environment';
import { databaseOptions } from './database-options';

// Shell environment values take precedence over .env values.
const envFile = resolve(process.cwd(), '.env');
const fileEnvironment = existsSync(envFile)
  ? parseEnv(readFileSync(envFile, 'utf8'))
  : {};
const result = environmentSchema.validate(
  { ...fileEnvironment, ...process.env },
  {
    allowUnknown: true,
    abortEarly: false,
  },
);
if (result.error)
  throw new Error(`Configuration error: ${result.error.message}`);
const config = new ConfigService(result.value as Record<string, unknown>);

export default new DataSource(databaseOptions(config));
