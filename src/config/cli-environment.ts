import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { environmentSchema } from './environment';

export function loadCliEnvironment(): Record<string, unknown> {
  const envFile = resolve(process.cwd(), '.env');
  const fileEnvironment = existsSync(envFile)
    ? parseEnv(readFileSync(envFile, 'utf8'))
    : {};
  const result = environmentSchema.validate(
    { ...fileEnvironment, ...process.env },
    { allowUnknown: true, abortEarly: false },
  );
  if (result.error)
    throw new Error(`Configuration error: ${result.error.message}`);
  return result.value as Record<string, unknown>;
}
