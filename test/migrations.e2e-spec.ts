import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';
import configuredSource from '../src/database/data-source';
import { User, UserRole } from '../src/database/entities/user.entity';
import { MerchantApplication } from '../src/database/entities/merchant-application.entity';
import { RiskReview } from '../src/database/entities/risk-review.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';

// Use an isolated database: never revert or delete application data in .env's database.
describe('Initial migration and database constraints', () => {
  const name = `merchant_test_${randomUUID().replaceAll('-', '')}`;
  let admin: DataSource;
  let database: DataSource;
  let runner: QueryRunner;
  let createdDatabase = false;
  let user: User;
  let application: MerchantApplication;

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
    runner = database.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    user = await runner.manager.save(User, {
      name: 'Test Sales',
      email: 'sales@example.test',
      passwordHash: 'test-hash',
      role: UserRole.SALES,
    });
    application = await runner.manager.save(MerchantApplication, {
      businessName: 'Test Coffee',
      legalBusinessName: 'Test Coffee Ltd',
      businessType: 'Retail',
      ownerName: 'Test Owner',
      contactEmail: 'owner@example.test',
      requestedMonthlyVolume: '1234567890123.45',
      currency: 'NPR',
      createdBy: user.id,
    });
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    if (runner && !runner.isReleased) await runner.release();
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      if (createdDatabase) await admin.query(`DROP DATABASE "${name}"`);
      await admin.destroy();
    }
  });

  it('loads relationships and exact decimal values while hiding password hashes', async () => {
    const loaded = await runner.manager.findOneOrFail(MerchantApplication, {
      where: { id: application.id },
      relations: { creator: true },
    });
    expect(loaded.creator.id).toBe(user.id);
    expect(loaded.creator.passwordHash).toBeUndefined();
    expect(loaded.requestedMonthlyVolume).toBe('1234567890123.45');
    expect(loaded.applicationStatus).toBe('DRAFT');
    expect(loaded.riskStatus).toBe('NOT_STARTED');
    expect(loaded.reviewVersion).toBe(0);
    expect(loaded.assignedReviewerId).toBeNull();
  });

  it('rejects duplicate emails regardless of case', async () => {
    await expect(
      runner.manager.save(User, {
        name: 'Duplicate',
        email: 'SALES@example.test',
        passwordHash: 'test',
        role: UserRole.SALES,
      }),
    ).rejects.toMatchObject({ driverError: { code: '23505' } });
  });

  it('preserves multiple review versions but rejects a duplicate version', async () => {
    await runner.manager.save(RiskReview, [
      { applicationId: application.id, reviewVersion: 1 },
      { applicationId: application.id, reviewVersion: 2 },
    ]);
    const loaded = await runner.manager.findOneOrFail(MerchantApplication, {
      where: { id: application.id },
      relations: { riskReviews: true },
    });
    expect(loaded.riskReviews).toHaveLength(2);
    await expect(
      runner.manager.save(RiskReview, {
        applicationId: application.id,
        reviewVersion: 1,
      }),
    ).rejects.toMatchObject({ driverError: { code: '23505' } });
  });

  it('allows system audit events and prevents deleting their application', async () => {
    await runner.manager.save(AuditLog, {
      applicationId: application.id,
      action: 'RISK_REVIEW_QUEUED',
      metadata: { reviewVersion: 1 },
    });
    const log = await runner.manager.findOneByOrFail(AuditLog, {
      applicationId: application.id,
    });
    expect(log.actorUserId).toBeNull();
    await expect(
      runner.manager.delete(MerchantApplication, application.id),
    ).rejects.toMatchObject({ driverError: { code: '23503' } });
  });

  it('rejects references to nonexistent users', async () => {
    await expect(
      runner.manager.update(MerchantApplication, application.id, {
        assignedReviewerId: randomUUID(),
      }),
    ).rejects.toMatchObject({ driverError: { code: '23503' } });
  });

  it.each([
    ['UPDATE merchant_applications SET requested_monthly_volume = -1', '23514'],
    ["UPDATE merchant_applications SET currency = 'np'", '23514'],
    ['UPDATE merchant_applications SET review_version = -1', '23514'],
    [
      "UPDATE merchant_applications SET application_status = 'INVALID'",
      '22P02',
    ],
  ])('rejects invalid application data: %s', async (sql, code) => {
    await expect(runner.query(sql)).rejects.toMatchObject({
      driverError: { code },
    });
  });

  it.each([
    { reviewVersion: 0 },
    { reviewVersion: 1, attemptCount: -1 },
    { reviewVersion: 1, riskScore: -1 },
    { reviewVersion: 1, riskScore: 101 },
  ])('rejects invalid review values: %j', async (values) => {
    await expect(
      runner.manager.save(RiskReview, {
        applicationId: application.id,
        ...values,
      }),
    ).rejects.toMatchObject({ driverError: { code: '23514' } });
  });

  it('matches entity metadata and can revert and reapply the migration', async () => {
    // Release this test's fixture transaction before changing the isolated schema.
    await runner.rollbackTransaction();
    await runner.release();
    expect(
      (await database.driver.createSchemaBuilder().log()).upQueries,
    ).toHaveLength(0);
    expect(await database.showMigrations()).toBe(false);
    await database.undoLastMigration();
    const tables: { tablename: string }[] = await database.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'",
    );
    expect(tables).toEqual([]);
    await database.runMigrations();
    expect(
      (await database.driver.createSchemaBuilder().log()).upQueries,
    ).toHaveLength(0);
  });
});
