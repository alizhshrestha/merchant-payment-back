# ADR 001: Run local PostgreSQL and Redis with Docker Compose

- Status: Accepted
- Date: 2026-11-18
- Scope: Local development

## Context

The project needs PostgreSQL for application data and Redis for background job
processing. These services are requirements recorded in the assignment planning;
this ADR documents how we run them locally, rather than selecting alternative
database or queue technologies.

We need a simple, repeatable setup within the submission deadline, without
requiring developers to install and manage both services directly on their machines.

## Decision

Use the repository's `compose.yaml` to run PostgreSQL 17 and Redis 7 in separate
containers. Run NestJS directly on the host during this stage.

- Use `postgres:17-alpine` and `redis:7-alpine` images.
- Bind published ports to `127.0.0.1`, defaulting to 5432 and 6379.
- Read local settings from `.env`; commit `.env.example` and ignore `.env`.
  Example credentials are for local development only.
- Require nonempty PostgreSQL initialization settings before Compose starts.
- Store PostgreSQL data and Redis data in separate named volumes.
- Enable Redis append-only persistence and the `noeviction` policy so Redis
  does not evict queue keys when a configured memory limit is reached.
  The current configuration does not set that limit.
- Use `pg_isready` and `redis-cli ping` health checks, and start with
  `docker compose up -d --wait`.

## Alternatives considered

- Native installations: avoid Docker, but add machine-specific installation,
  version management, and cleanup steps.
- Hosted services: avoid running local containers, but introduce account setup,
  network dependence, and potentially cost for this development stage.
- Containerize NestJS too: can provide a more complete shared runtime, but adds
  build and development configuration that is not needed for the current stage.

## Consequences

- Developers can start both services with one command and use the same major versions.
- Named volumes preserve data when containers are recreated; `docker compose down -v`
  deliberately removes that data. Volumes are not backups.
- Docker's engine must be running and the configured host ports must be available.
- Major-version image tags can receive patch updates; exact image digests are not pinned.
- PostgreSQL initialization settings only initialize an empty data volume.
- Readiness checks do not verify application authentication, migrations, or job processing.
- Redis persistence reduces data loss risk but does not guarantee zero loss after a crash.
- This local setup is not a production deployment design.

## Verification and follow-up

The Compose configuration has passed validation. On 2026-11-18, both PostgreSQL
and Redis were confirmed running with healthy Compose status.

The initial schema and migration approach are recorded in
[ADR 002](002-initial-database-schema.md). Workflow decisions will be documented
as they are agreed.
