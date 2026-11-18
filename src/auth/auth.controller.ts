import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginPipe } from './login.pipe';
import type { LoginInput } from './login.pipe';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  login(@Body(LoginPipe) input: LoginInput) {
    return this.auth.login(input);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
