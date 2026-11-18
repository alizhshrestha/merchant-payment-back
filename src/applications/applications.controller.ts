import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { UserRole } from '../database/entities/user.entity';
import { ApplicationsService } from './applications.service';
import {
  ApplicationListPipe,
  CreateApplicationPipe,
  UpdateApplicationPipe,
} from './application.pipes';
import type {
  ApplicationListInput,
  CreateApplicationInput,
  UpdateApplicationInput,
} from './application.pipes';

@Controller('applications')
@Roles(UserRole.ADMIN, UserRole.SALES, UserRole.REVIEWER)
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SALES)
  create(
    @Body(CreateApplicationPipe) input: CreateApplicationInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.applications.create(input, request.user);
  }

  @Get()
  list(
    @Query(ApplicationListPipe) input: ApplicationListInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.applications.list(input, request.user);
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.applications.findOne(id, request.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SALES)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(UpdateApplicationPipe) input: UpdateApplicationInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.applications.update(id, input, request.user);
  }
}
