import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { PasswordService } from './password.service';
import { ACCESS_TOKEN_SECONDS } from './auth.constants';
import type { LoginInput } from './login.pipe';

export type AuthUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;
function publicUser(user: User): AuthUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash: string;
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit() {
    // Unknown users still incur password verification work.
    this.dummyHash = await this.passwords.hash(randomBytes(32).toString('hex'));
  }

  async login(input: LoginInput) {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = :email', {
        email: input.email.trim().toLowerCase(),
      })
      .getOne();
    const valid = await this.passwords.verify(
      input.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !valid)
      throw new UnauthorizedException('Invalid email or password');
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_SECONDS,
      user: publicUser(user),
    };
  }

  async findCurrentUser(id: string): Promise<AuthUser> {
    const user = await this.users.findOne({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user)
      throw new UnauthorizedException('Invalid or expired access token');
    return publicUser(user);
  }
}
