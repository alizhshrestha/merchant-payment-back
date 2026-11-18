import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import configuredSource from '../src/database/data-source';
import { User, UserRole } from '../src/database/entities/user.entity';
import {
  MerchantApplication,
  ApplicationStatus,
} from '../src/database/entities/merchant-application.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';

const validInput = {
  businessName: 'Himalayan Coffee',
  legalBusinessName: 'Himalayan Coffee Pvt Ltd',
  businessType: 'Retail',
  ownerName: 'Test Owner',
  contactEmail: 'owner@example.test',
  contactPhone: '+9779800000000',
  requestedMonthlyVolume: '250000.50',
  currency: 'NPR',
};
interface ApplicationPage {
  data: MerchantApplication[];
  total: number;
  page: number;
  limit: number;
}

describe('Merchant application permissions and drafts', () => {
  const name = `merchant_apps_test_${randomUUID().replaceAll('-', '')}`;
  let admin: DataSource;
  let database: DataSource;
  let app: INestApplication<App>;
  let createdDatabase = false;
  let sales: User;
  let otherSales: User;
  let reviewer: User;
  let otherReviewer: User;
  let administrator: User;
  let tokens: Record<string, string>;
  let own: MerchantApplication;
  let other: MerchantApplication;

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
    const users = database.getRepository(User);
    [sales, otherSales, reviewer, otherReviewer, administrator] =
      await users.save([
        {
          name: 'Sales',
          email: 'sales@example.test',
          role: UserRole.SALES,
          passwordHash: 'unused',
        },
        {
          name: 'Other Sales',
          email: 'sales2@example.test',
          role: UserRole.SALES,
          passwordHash: 'unused',
        },
        {
          name: 'Reviewer',
          email: 'reviewer@example.test',
          role: UserRole.REVIEWER,
          passwordHash: 'unused',
        },
        {
          name: 'Other Reviewer',
          email: 'reviewer2@example.test',
          role: UserRole.REVIEWER,
          passwordHash: 'unused',
        },
        {
          name: 'Admin',
          email: 'admin@example.test',
          role: UserRole.ADMIN,
          passwordHash: 'unused',
        },
      ]);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(database)
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
    const jwt = app.get(JwtService);
    tokens = {};
    for (const user of [
      sales,
      otherSales,
      reviewer,
      otherReviewer,
      administrator,
    ])
      tokens[user.id] = await jwt.signAsync({ sub: user.id });
  });

  beforeEach(async () => {
    await database.query('DELETE FROM audit_logs');
    await database.query('DELETE FROM risk_reviews');
    await database.query('DELETE FROM merchant_applications');
    own = await database.getRepository(MerchantApplication).save({
      ...validInput,
      createdBy: sales.id,
      assignedReviewerId: reviewer.id,
    });
    other = await database.getRepository(MerchantApplication).save({
      ...validInput,
      businessName: 'Other business',
      createdBy: otherSales.id,
      applicationStatus: ApplicationStatus.SUBMITTED,
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      if (createdDatabase) await admin.query(`DROP DATABASE "${name}"`);
      await admin.destroy();
    }
  });

  function auth(user: User) {
    return `Bearer ${tokens[user.id]}`;
  }

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/applications').expect(401);
    await request(app.getHttpServer())
      .post('/applications')
      .send(validInput)
      .expect(401);
  });

  it.each(['sales', 'admin'])(
    'allows %s to create a draft with an audit event',
    async (role) => {
      const actor = role === 'sales' ? sales : administrator;
      const response = await request(app.getHttpServer())
        .post('/applications')
        .set('Authorization', auth(actor))
        .send(validInput)
        .expect(201);
      const application = response.body as MerchantApplication;
      expect(application).toMatchObject({
        createdBy: actor.id,
        applicationStatus: 'DRAFT',
        riskStatus: 'NOT_STARTED',
        reviewVersion: 0,
        assignedReviewerId: null,
        requestedMonthlyVolume: '250000.50',
      });
      const audit = await database
        .getRepository(AuditLog)
        .findOneByOrFail({ applicationId: application.id });
      expect(audit).toMatchObject({
        actorUserId: actor.id,
        action: 'APPLICATION_CREATED',
        metadata: { status: 'DRAFT' },
      });
      expect(application).not.toHaveProperty('creator');
    },
  );

  it('forbids reviewer creation and edits even for an assigned application', async () => {
    await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', auth(reviewer))
      .send(validInput)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/applications/${own.id}`)
      .set('Authorization', auth(reviewer))
      .send({ businessName: 'Changed' })
      .expect(403);
    expect(await database.getRepository(AuditLog).count()).toBe(0);
  });

  it('scopes list results and counts to ownership or assignment', async () => {
    for (const [user, expected] of [
      [sales, [own.id]],
      [otherSales, [other.id]],
      [reviewer, [own.id]],
      [otherReviewer, []],
      [administrator, [own.id, other.id]],
    ] as [User, string[]][]) {
      const response = await request(app.getHttpServer())
        .get('/applications')
        .set('Authorization', auth(user))
        .expect(200);
      const page = response.body as ApplicationPage;
      expect(page.total).toBe(expected.length);
      expect(page.data.map((application) => application.id).sort()).toEqual(
        expected.sort(),
      );
    }
  });

  it('scopes individual reads and returns 404 for inaccessible or missing records', async () => {
    await request(app.getHttpServer())
      .get(`/applications/${own.id}`)
      .set('Authorization', auth(sales))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/applications/${own.id}`)
      .set('Authorization', auth(reviewer))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/applications/${other.id}`)
      .set('Authorization', auth(administrator))
      .expect(200);
    for (const user of [otherSales, otherReviewer])
      await request(app.getHttpServer())
        .get(`/applications/${own.id}`)
        .set('Authorization', auth(user))
        .expect(404);
    await request(app.getHttpServer())
      .get(`/applications/${randomUUID()}`)
      .set('Authorization', auth(administrator))
      .expect(404);
  });

  it('combines pagination and status filters with access scope', async () => {
    const first = await request(app.getHttpServer())
      .get('/applications?page=1&limit=1')
      .set('Authorization', auth(administrator))
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/applications?page=2&limit=1')
      .set('Authorization', auth(administrator))
      .expect(200);
    expect((first.body as ApplicationPage).total).toBe(2);
    expect((first.body as ApplicationPage).data[0].id).not.toBe(
      (second.body as ApplicationPage).data[0].id,
    );
    const filtered = await request(app.getHttpServer())
      .get('/applications?status=SUBMITTED')
      .set('Authorization', auth(sales))
      .expect(200);
    expect((filtered.body as ApplicationPage).total).toBe(0);
  });

  it('edits an owned draft, preserves server fields and audits only field names', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/applications/${own.id}`)
      .set('Authorization', auth(sales))
      .send({ businessName: 'Updated Coffee', contactPhone: null })
      .expect(200);
    expect(response.body).toMatchObject({
      businessName: 'Updated Coffee',
      contactPhone: null,
      createdBy: sales.id,
      applicationStatus: 'DRAFT',
      assignedReviewerId: reviewer.id,
    });
    const audit = await database
      .getRepository(AuditLog)
      .findOneByOrFail({ applicationId: own.id });
    expect(audit.metadata).toEqual({
      changedFields: ['businessName', 'contactPhone'],
    });
    expect(audit.actorUserId).toBe(sales.id);
  });

  it('forbids edits of another sales user’s application and allows admin draft edits', async () => {
    await request(app.getHttpServer())
      .patch(`/applications/${own.id}`)
      .set('Authorization', auth(otherSales))
      .send({ businessName: 'Wrong' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/applications/${own.id}`)
      .set('Authorization', auth(administrator))
      .send({ businessName: 'Admin correction' })
      .expect(200);
  });

  it.each([
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
  ])('rejects edits in %s even for admins', async (status) => {
    await database
      .getRepository(MerchantApplication)
      .update(own.id, { applicationStatus: status });
    for (const user of [sales, administrator])
      await request(app.getHttpServer())
        .patch(`/applications/${own.id}`)
        .set('Authorization', auth(user))
        .send({ businessName: 'Wrong' })
        .expect(409);
    expect(await database.getRepository(AuditLog).count()).toBe(0);
  });

  it('allows corrections when information has been requested', async () => {
    await database
      .getRepository(MerchantApplication)
      .update(own.id, { applicationStatus: ApplicationStatus.NEEDS_INFO });
    await request(app.getHttpServer())
      .patch(`/applications/${own.id}`)
      .set('Authorization', auth(sales))
      .send({ ownerName: 'Corrected owner' })
      .expect(200);
  });

  it.each([
    'createdBy',
    'assignedReviewerId',
    'applicationStatus',
    'riskStatus',
    'reviewVersion',
    'id',
  ])('rejects client-controlled %s on both writes', async (field) => {
    await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', auth(sales))
      .send({ ...validInput, [field]: 'injected' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/applications/${own.id}`)
      .set('Authorization', auth(sales))
      .send({ [field]: 'injected' })
      .expect(400);
  });

  it.each([
    '-1',
    'NaN',
    'Infinity',
    '1e3',
    '0.001',
    '10000000000000.00',
    12.34,
  ])('rejects invalid or imprecise volume %s', async (volume) => {
    await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', auth(sales))
      .send({ ...validInput, requestedMonthlyVolume: volume })
      .expect(400);
  });

  it('accepts the maximum exact decimal and normalizes currency/email', async () => {
    const response = await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', auth(sales))
      .send({
        ...validInput,
        requestedMonthlyVolume: '9999999999999.99',
        currency: 'npr',
        contactEmail: 'OWNER@EXAMPLE.TEST',
      })
      .expect(201);
    expect(response.body).toMatchObject({
      requestedMonthlyVolume: '9999999999999.99',
      currency: 'NPR',
      contactEmail: 'owner@example.test',
    });
  });

  it.each([
    {},
    { businessName: '   ' },
    { contactEmail: 'bad' },
    { currency: 'N' },
  ])('rejects incomplete or invalid creation data', async (body) => {
    const input = Object.keys(body).length ? { ...validInput, ...body } : {};
    await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', auth(sales))
      .send(input)
      .expect(400);
  });

  it('rejects empty patches and malformed IDs', async () => {
    await request(app.getHttpServer())
      .patch(`/applications/${own.id}`)
      .set('Authorization', auth(sales))
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .get('/applications/not-a-uuid')
      .set('Authorization', auth(sales))
      .expect(400);
  });

  it.each([
    'page=0',
    'limit=101',
    'page=abc',
    'status=UNKNOWN',
    'createdBy=anything',
  ])('rejects invalid list query %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/applications?${query}`)
      .set('Authorization', auth(sales))
      .expect(400);
  });

  it('rolls back a created application if its audit insert fails', async () => {
    await database.query(
      "CREATE FUNCTION test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END; $$",
    );
    await database.query(
      'CREATE TRIGGER test_reject_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_reject_audit()',
    );
    try {
      await request(app.getHttpServer())
        .post('/applications')
        .set('Authorization', auth(sales))
        .send(validInput)
        .expect(500);
      expect(await database.getRepository(MerchantApplication).count()).toBe(2);
    } finally {
      await database.query('DROP TRIGGER test_reject_audit ON audit_logs');
      await database.query('DROP FUNCTION test_reject_audit()');
    }
  });
});
