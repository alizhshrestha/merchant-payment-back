import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import {
  MerchantApplication,
  ApplicationStatus,
} from '../database/entities/merchant-application.entity';
import { AuditLog } from '../database/entities/audit-log.entity';
import { UserRole } from '../database/entities/user.entity';
import type { AuthUser } from '../auth/auth.service';
import type {
  ApplicationListInput,
  CreateApplicationInput,
  UpdateApplicationInput,
} from './application.pipes';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly database: DataSource,
    @InjectRepository(MerchantApplication)
    private readonly applications: Repository<MerchantApplication>,
  ) {}

  private scope(
    query: SelectQueryBuilder<MerchantApplication>,
    user: AuthUser,
  ) {
    if (user.role === UserRole.SALES)
      query.andWhere('application.createdBy = :userId', { userId: user.id });
    else if (user.role === UserRole.REVIEWER)
      query.andWhere('application.assignedReviewerId = :userId', {
        userId: user.id,
      });
    else if (user.role !== UserRole.ADMIN) query.andWhere('1 = 0');
    return query;
  }

  async create(input: CreateApplicationInput, user: AuthUser) {
    return this.database.transaction(async (manager) => {
      const application = await manager.save(MerchantApplication, {
        ...input,
        createdBy: user.id,
      });
      await manager.insert(AuditLog, {
        applicationId: application.id,
        actorUserId: user.id,
        action: 'APPLICATION_CREATED',
        metadata: { status: ApplicationStatus.DRAFT },
      });
      return manager.findOneByOrFail(MerchantApplication, {
        id: application.id,
      });
    });
  }

  async list(input: ApplicationListInput, user: AuthUser) {
    const query = this.scope(
      this.applications.createQueryBuilder('application'),
      user,
    );
    if (input.status)
      query.andWhere('application.applicationStatus = :status', {
        status: input.status,
      });
    const [data, total] = await query
      .orderBy('application.createdAt', 'DESC')
      .addOrderBy('application.id', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit)
      .getManyAndCount();
    return { data, total, page: input.page, limit: input.limit };
  }

  async findOne(id: string, user: AuthUser) {
    const application = await this.scope(
      this.applications.createQueryBuilder('application'),
      user,
    )
      .andWhere('application.id = :id', { id })
      .getOne();
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async update(id: string, input: UpdateApplicationInput, user: AuthUser) {
    return this.database.transaction(async (manager) => {
      const application = await this.scope(
        manager.createQueryBuilder(MerchantApplication, 'application'),
        user,
      )
        .andWhere('application.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!application) throw new NotFoundException('Application not found');
      if (
        ![ApplicationStatus.DRAFT, ApplicationStatus.NEEDS_INFO].includes(
          application.applicationStatus,
        )
      ) {
        throw new ConflictException(
          'Only DRAFT or NEEDS_INFO applications can be edited',
        );
      }
      await manager.update(MerchantApplication, id, input);
      await manager.insert(AuditLog, {
        applicationId: id,
        actorUserId: user.id,
        action: 'APPLICATION_UPDATED',
        metadata: { changedFields: Object.keys(input).sort() },
      });
      return manager.findOneByOrFail(MerchantApplication, { id });
    });
  }
}
