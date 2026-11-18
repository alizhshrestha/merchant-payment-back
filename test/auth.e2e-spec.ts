import { randomUUID } from 'node:crypto';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWT_ISSUER, JWT_AUDIENCE } from '../src/auth/auth.constants';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import configuredSource from '../src/database/data-source';
import { seedUsers } from '../src/database/seed-users';
import { User, UserRole } from '../src/database/entities/user.entity';

@Controller('test-protected')
class ProtectedController {
  @Get() read() {
    return { protected: true };
  }
}

interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: { id: string; name: string; email: string; role: UserRole };
}

describe('JWT authentication', () => {
  const name = `merchant_auth_test_${randomUUID().replaceAll('-', '')}`;
  const credentials = {
    NODE_ENV: 'test',
    SEED_ADMIN_PASSWORD: 'Admin integration password!',
    SEED_SALES_PASSWORD: 'Sales integration password!',
    SEED_REVIEWER_PASSWORD: 'Reviewer integration password!',
  };
  let admin: DataSource;
  let database: DataSource;
  let app: INestApplication<App>;
  let jwt: JwtService;
  let createdDatabase = false;
  let sales: User;

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
    await seedUsers(database, credentials);
    sales = await database
      .getRepository(User)
      .findOneByOrFail({ email: 'sales@merchant.local' });
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedController],
    })
      .overrideProvider(DataSource)
      .useValue(database)
      .compile();
    app = module.createNestApplication();
    await app.init();
    jwt = app.get(JwtService);
  });

  beforeEach(() => {
    // Reset only the in-memory test limiter between cases, retaining the real guard.
    app.get<ThrottlerStorageService>(getStorageToken()).onApplicationShutdown();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      if (createdDatabase) await admin.query(`DROP DATABASE "${name}"`);
      await admin.destroy();
    }
  });

  it.each([UserRole.ADMIN, UserRole.SALES, UserRole.REVIEWER])(
    'logs in %s and returns only public user fields',
    async (role) => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: `${role.toLowerCase()}@merchant.local`,
          password: credentials[`SEED_${role}_PASSWORD`],
        })
        .expect(200)
        .expect('Cache-Control', 'no-store');
      const body = response.body as LoginResponse;
      expect(body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { role },
      });
      expect(Object.keys(body.user).sort()).toEqual([
        'email',
        'id',
        'name',
        'role',
      ]);
      const payload = await jwt.verifyAsync<Record<string, unknown>>(
        body.accessToken,
      );
      expect(payload.sub).toBe(body.user.id);
      expect(Number(payload.exp) - Number(payload.iat)).toBe(900);
      expect(payload).not.toHaveProperty('role');
      expect(payload).not.toHaveProperty('passwordHash');
      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200)
        .expect('Cache-Control', 'no-store');
      expect(me.body).toEqual(body.user);
    },
  );

  it('normalizes email case and surrounding whitespace', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: '  SALES@MERCHANT.LOCAL  ',
        password: credentials.SEED_SALES_PASSWORD,
      })
      .expect(200);
  });

  it('returns the same 401 for wrong passwords and nonexistent users', async () => {
    const wrong = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: sales.email, password: 'wrong password' })
      .expect(401);
    const missing = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@merchant.local', password: 'wrong password' })
      .expect(401);
    expect(missing.body).toEqual(wrong.body);
  });

  it.each([
    {},
    { email: 'invalid', password: 'password' },
    { email: 'sales@merchant.local', password: '' },
    { email: 'sales@merchant.local', password: 123 },
    { email: 'sales@merchant.local', password: 'x'.repeat(257) },
    { email: 'sales@merchant.local', password: 'password', role: 'ADMIN' },
  ])('rejects invalid login input', async (body) => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(body)
      .expect(400);
  });

  it.each(['', 'Basic abc', 'Bearer malformed', 'Bearer a b'])(
    'rejects invalid authorization header %s',
    async (header) => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', header)
        .expect(401);
    },
  );

  it('protects routes by default and accepts a valid Bearer token', async () => {
    await request(app.getHttpServer()).get('/test-protected').expect(401);
    const token = await jwt.signAsync({ sub: sales.id });
    await request(app.getHttpServer())
      .get('/test-protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/me')
      .query({ access_token: token })
      .expect(401);
  });

  it.each([
    { expiresIn: -1 },
    { issuer: 'wrong-issuer' },
    { audience: 'wrong-audience' },
    { secret: 'wrong-secret' },
    { algorithm: 'HS384' as const },
  ])('rejects invalid token properties: %j', async (options) => {
    const token = await jwt.signAsync({ sub: sales.id }, options);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a signed token with no expiry', async () => {
    const signer = new JwtService({
      secret: Buffer.from(
        app.get(ConfigService).getOrThrow<string>('JWT_SECRET'),
        'hex',
      ),
      signOptions: {
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      },
    });
    const token = await signer.signAsync({ sub: sales.id });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it.each(['not-a-uuid', randomUUID()])(
    'rejects invalid or missing users',
    async (subject) => {
      const token = await jwt.signAsync({ sub: subject });
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    },
  );

  it('reads the current database role rather than trusting token role claims', async () => {
    const token = await jwt.signAsync({ sub: sales.id, role: UserRole.ADMIN });
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((me.body as LoginResponse['user']).role).toBe(UserRole.SALES);
  });

  it('rejects a token after its user is deleted', async () => {
    const user = await database.getRepository(User).save({
      name: 'Temporary',
      email: 'temporary@example.test',
      passwordHash: 'unused',
      role: UserRole.SALES,
    });
    const token = await jwt.signAsync({ sub: user.id });
    await database.getRepository(User).delete(user.id);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rate-limits login even when forwarded IP headers are changed', async () => {
    for (let index = 0; index < 10; index++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Forwarded-For', `192.0.2.${index + 1}`)
        .send({})
        .expect(400);
    }
    await request(app.getHttpServer()).post('/auth/login').send({}).expect(429);
  });
});
