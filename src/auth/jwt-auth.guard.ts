import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.service';
import { IS_PUBLIC } from './public.decorator';

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );
    if (!match) throw new UnauthorizedException('Bearer access token required');
    let subject: string;
    try {
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(
        match[1],
      );
      if (
        typeof payload.sub !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          payload.sub,
        ) ||
        typeof payload.exp !== 'number' ||
        !Number.isFinite(payload.exp)
      )
        throw new Error('Invalid claims');
      subject = payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    request.user = await this.auth.findCurrentUser(subject);
    return true;
  }
}
