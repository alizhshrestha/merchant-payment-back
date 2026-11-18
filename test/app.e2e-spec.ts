import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('connects to PostgreSQL without automatic schema changes', async () => {
    const database = app.get(DataSource);
    expect(database.isInitialized).toBe(true);
    expect(database.options.synchronize).toBe(false);
    expect(database.options.migrationsRun).toBe(false);
    const rows: { result: number }[] =
      await database.query('SELECT 1 AS result');
    expect(rows).toEqual([{ result: 1 }]);
  });

  afterEach(async () => {
    await app.close();
  });
});
