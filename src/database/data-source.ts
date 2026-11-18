import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { loadCliEnvironment } from '../config/cli-environment';
import { databaseOptions } from './database-options';

export default new DataSource(
  databaseOptions(new ConfigService(loadCliEnvironment())),
);
