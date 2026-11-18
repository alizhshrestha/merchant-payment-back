## JWT login (Stage 3.2)

The API requires `JWT_SECRET` in `.env`: 32 random bytes as 64 hexadecimal characters.
A secret is already generated for this local setup. For a fresh setup, generate one
with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
and save it in your ignored `.env`. Never commit the generated secret.

```bash
npm run migration:run
npm run seed
npm run start:dev
```

In Postman, send `POST http://localhost:3000/auth/login` with a JSON body:

```json
{
  "email": "sales@merchant.local",
  "password": "<your SEED_SALES_PASSWORD from .env>"
}
```

A successful login returns HTTP 200 with `accessToken`, `tokenType: "Bearer"`,
`expiresIn: 900`, and `user` containing only id, name, email and role.
Copy `accessToken` into Postman's Authorization > Bearer Token field and send
`GET http://localhost:3000/auth/me` to retrieve the current user.

Invalid login input returns 400; incorrect credentials or invalid/missing tokens
return 401. Login is limited to ten requests per IP per minute (429 after that).
All routes require authentication unless explicitly marked public; `/` and login
remain public. A token expires after 15 minutes; log in again to obtain a new one.
Role-specific authorization is the following stage.

## Local users and password hashing (Stage 3.1)

Set `SEED_ADMIN_PASSWORD`, `SEED_SALES_PASSWORD`, and `SEED_REVIEWER_PASSWORD`
in your ignored `.env` file (15–128 characters each). Fresh setups must choose
these passwords; `.env.example` intentionally leaves them empty. The initial
local setup has generated passwords saved in `.env`.

```bash
npm run migration:run
npm run seed
```

| Role | Email | Password setting |
| --- | --- | --- |
| ADMIN | admin@merchant.local | SEED_ADMIN_PASSWORD |
| SALES | sales@merchant.local | SEED_SALES_PASSWORD |
| REVIEWER | reviewer@merchant.local | SEED_REVIEWER_PASSWORD |

The database stores salted scrypt hashes, not plaintext passwords. Seeding only
works with `NODE_ENV=development` or `test`. Rerunning skips existing accounts;
it does not reset passwords or change roles. A conflicting role fails the entire
transaction. Seed passwords are required only for the seed command, not app startup.
JWT login and protected routes are available as documented above.

## Database migrations (Stage 2.4)

Use Node.js 24, install dependencies, configure `.env` from `.env.example`, and start
Docker services before running these commands from the project root:

```bash
npm run migration:show
npm run migration:run
```

The first migration creates `users`, `merchant_applications`, `risk_reviews`, and
`audit_logs`. TypeORM also maintains a `migrations` tracking table. Running the
migration command again applies only pending changes.

For later entity changes, generate a new migration and review its SQL before applying:

```bash
npm run migration:generate -- src/database/migrations/DescribeChange
```

`npm run migration:revert` undoes the latest migration. **Reverting the initial
migration deletes all four tables and their data.** Use a disposable database to
practice rollback; do not run it against data you need to keep.

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

Migration integration tests create and delete a uniquely named temporary database.
The local PostgreSQL user must have CREATE DATABASE permission (the Compose user
does by default). Tests never revert the application database.

## Application configuration (Stage 2.3)

NestJS loads `.env` and validates settings before connecting to PostgreSQL.
Set `POSTGRES_HOST=127.0.0.1` when running NestJS on your Mac. The database
port, username, password, and name match the Compose settings in `.env.example`.
`PORT` defaults to 3000 and `NODE_ENV` defaults to `development`.

```bash
docker compose up -d --wait
npm run start:dev
```

TypeORM connects at startup with `synchronize: false` and `migrationsRun: false`.
No tables are created automatically. Apply the reviewed migration explicitly before using repositories.
Redis is running locally; application queue integration comes in a later stage.

Run `npm test -- --runInBand` for unit tests. `npm run test:e2e -- --runInBand`
requires the local PostgreSQL service and valid `.env` credentials.

## Architecture decisions

- [ADR 004: JWT authentication](docs/adr/004-jwt-authentication.md)

- [ADR 003: Password hashing and local seeding](docs/adr/003-password-hashing-and-local-seeding.md)

- [ADR 002: Initial database schema and migrations](docs/adr/002-initial-database-schema.md)

- [ADR 001: Local PostgreSQL and Redis with Docker Compose](docs/adr/001-local-development-docker-compose.md)

## Local services (Stage 2.2)

Start Docker Desktop, then run:

```bash
cp .env.example .env # first setup only
docker compose up -d --wait
docker compose ps
```

PostgreSQL 17: `127.0.0.1:5432`, database `merchant_payment`, user `merchant`,
local password in `.env`. Redis 7: `127.0.0.1:6379`.
Ports are local-only. Both services have health checks and persistent named
volumes. Redis uses append-only persistence and `noeviction` for future queues.
NestJS connects to PostgreSQL; apply migrations explicitly using the commands above.

Use `docker compose stop` to stop services and `docker compose up -d --wait`
to restart. `docker compose down` removes containers but preserves data;
adding `-v` deletes the data. PostgreSQL initialization values apply only
when its data volume is empty.

---

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
