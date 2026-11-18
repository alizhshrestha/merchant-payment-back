import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794986919173 implements MigrationInterface {
  name = 'InitialSchema1794986919173';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."risk_status" AS ENUM('NOT_STARTED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH')`,
    );
    await queryRunner.query(
      `CREATE TABLE "risk_reviews" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "application_id" uuid NOT NULL, "review_version" integer NOT NULL, "status" "public"."risk_status" NOT NULL DEFAULT 'PENDING', "risk_level" "public"."risk_level", "risk_score" integer, "attempt_count" integer NOT NULL DEFAULT '0', "failure_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_risk_reviews_application_version" UNIQUE ("application_id", "review_version"), CONSTRAINT "CHK_risk_reviews_started" CHECK ("status" <> 'NOT_STARTED'), CONSTRAINT "CHK_risk_reviews_score" CHECK ("risk_score" BETWEEN 0 AND 100), CONSTRAINT "CHK_risk_reviews_attempt_count" CHECK ("attempt_count" >= 0), CONSTRAINT "CHK_risk_reviews_version" CHECK ("review_version" > 0), CONSTRAINT "PK_32e1cd29b2ee1ca11018f2e525c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "application_id" uuid NOT NULL, "actor_user_id" uuid, "action" character varying(60) NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_application_created" ON "audit_logs" ("application_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."application_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "merchant_applications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "business_name" character varying(200) NOT NULL, "legal_business_name" character varying(200) NOT NULL, "business_type" character varying(100) NOT NULL, "owner_name" character varying(150) NOT NULL, "contact_email" character varying(255) NOT NULL, "contact_phone" character varying(30), "requested_monthly_volume" numeric(15,2) NOT NULL, "currency" character(3) NOT NULL, "application_status" "public"."application_status" NOT NULL DEFAULT 'DRAFT', "risk_status" "public"."risk_status" NOT NULL DEFAULT 'NOT_STARTED', "review_version" integer NOT NULL DEFAULT '0', "created_by" uuid NOT NULL, "assigned_reviewer_id" uuid, "submitted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_applications_currency" CHECK ("currency" ~ '^[A-Z]{3}$'), CONSTRAINT "CHK_applications_review_version" CHECK ("review_version" >= 0), CONSTRAINT "CHK_applications_volume" CHECK ("requested_monthly_volume" >= 0), CONSTRAINT "PK_09b9df0877db73b8a232c8c7ed4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_applications_status_created" ON "merchant_applications" ("application_status", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_applications_reviewer_status" ON "merchant_applications" ("assigned_reviewer_id", "application_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_applications_creator_created" ON "merchant_applications" ("created_by", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'SALES', 'REVIEWER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(150) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "role" "public"."user_role" NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    // Functional indexes are managed explicitly; TypeORM cannot infer LOWER(email).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email_lower" ON "users" (LOWER(email))`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_reviews" ADD CONSTRAINT "FK_01e7bad3dad96afda5d9631f8d9" FOREIGN KEY ("application_id") REFERENCES "merchant_applications"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_e64c07c384f813ed88b30316272" FOREIGN KEY ("application_id") REFERENCES "merchant_applications"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_f160d97a931844109de9d04228f" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "FK_a048aca475104379543eb914e58" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "FK_7da78a3bb9e76995dba067b83ed" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" DROP CONSTRAINT "FK_7da78a3bb9e76995dba067b83ed"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" DROP CONSTRAINT "FK_a048aca475104379543eb914e58"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_f160d97a931844109de9d04228f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_e64c07c384f813ed88b30316272"`,
    );
    await queryRunner.query(
      `ALTER TABLE "risk_reviews" DROP CONSTRAINT "FK_01e7bad3dad96afda5d9631f8d9"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_applications_creator_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_applications_reviewer_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_applications_status_created"`,
    );
    await queryRunner.query(`DROP TABLE "merchant_applications"`);
    await queryRunner.query(`DROP TYPE "public"."application_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_logs_application_created"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "risk_reviews"`);
    await queryRunner.query(`DROP TYPE "public"."risk_level"`);
    await queryRunner.query(`DROP TYPE "public"."risk_status"`);
  }
}
