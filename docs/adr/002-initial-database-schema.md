# ADR 002: Four-table schema and explicit TypeORM migrations

- Status: Accepted
- Date: 2026-11-18
- Scope: Initial persistence model

## Context

The agreed design needs employee roles, merchant applications, repeatable risk
assessments, and an audit trail. PostgreSQL and TypeORM were selected during
assignment planning. This decision defines the initial schema, not API behavior.

## Decision

Use four tables with UUID primary keys and timezone-aware timestamps:

| Table | Purpose and relationships |
| --- | --- |
| `users` | Employee identity, password hash, and ADMIN/SALES/REVIEWER role. One user can create or review many applications. |
| `merchant_applications` | Business and contact details, requested volume/currency, independent application/risk statuses, and current review version. Required creator and optional assigned reviewer reference users. |
| `risk_reviews` | One record per application review cycle; unique `(application_id, review_version)`. Processing retries update the cycle's attempt count rather than creating another cycle. |
| `audit_logs` | Application events with an optional user actor; a null actor represents system activity. JSON metadata must be sanitized by the future service layer. |

### Integrity and precision

- Enforce case-insensitive email uniqueness with a functional index on `LOWER(email)`.
  Login and user creation will normalize email in the authentication stage.
- Store monthly volume as `NUMERIC(15,2)` and expose it as a TypeScript string to
  preserve decimal precision. Require nonnegative values.
- Require three uppercase letters for currency. Checking supported ISO currencies
  belongs to request validation; this constraint only checks the format.
- Use enums for roles, application statuses, risk statuses, and risk levels.
- Require positive review-cycle versions, nonnegative attempt counts, and scores
  in 0–100 when present. An application's review version starts at zero.
- Default applications to DRAFT / NOT_STARTED and new risk cycles to PENDING.
  Risk reviews cannot use NOT_STARTED.
- Require core business details even for DRAFT records in this initial design.
  Contact phone, reviewer assignment, and submission time can be absent. Partial
  drafts were discussed but are not established as a requirement; supporting them
  would require changing nullability and enforcing completeness at submission.
- Use restrictive foreign-key deletion rules to avoid silently erasing history.
  There is no cascade deletion or hard-delete API in this stage.
- Add indexes for creator listings, reviewer/status filtering, status/date listing,
  application review versions, and application audit history.
- Hide password hashes from default ORM queries (`select: false`). Future auth
  code must explicitly select hashes and avoid returning them in responses.

### Migrations

Use one reviewed initial migration, with explicit `up` and `down` operations.
The application and CLI share connection options and entity registrations.
Keep `synchronize: false`, `migrationsRun: false`, and automatic extension
installation disabled. PostgreSQL 17's built-in `gen_random_uuid()` supplies IDs.

The generated SQL was reviewed to define the shared risk-status enum once,
remove it only after both referencing tables, and add the functional email index
that TypeORM does not generate. The index is marked `synchronize: false` in entity
metadata so future schema generation leaves it intact.

## Alternatives considered

- Overwriting one risk result: simpler, but loses history across resubmissions.
- Separate role, owner, and assignment tables: unnecessary for the current scope.
- Automatic schema synchronization: convenient locally, but bypasses reviewed,
  versioned schema changes.
- Cascading deletes: convenient cleanup, but can remove required audit history.

## Consequences and deferred behavior

The database enforces references, allowed values, and uniqueness. It does not yet
enforce reviewer roles, permitted state transitions, completed-result completeness,
latest-review updates, or append-only audit access. Future services must enforce
those rules transactionally and sanitize audit metadata. Review-version uniqueness
alone does not make worker effects idempotent.

`updated_at` is maintained by TypeORM updates; raw SQL writers must set it explicitly.
The initial migration's rollback drops all four tables and their data. Exercise
rollback only on disposable databases unless data loss is deliberately intended.

## Validation

Integration tests create a uniquely named temporary database, apply the migration,
check ORM relationships and constraints, check for entity/schema differences,
revert, reapply, and remove only that temporary database. The configured local
PostgreSQL user needs CREATE DATABASE permission to run these tests.
