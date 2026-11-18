import { RolesGuard } from './roles.guard';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';
import {
  ACCESS_TOKEN_SECONDS,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from './auth.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: Buffer.from(config.getOrThrow<string>('JWT_SECRET'), 'hex'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: ACCESS_TOKEN_SECONDS,
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          maxAge: ACCESS_TOKEN_SECONDS,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
