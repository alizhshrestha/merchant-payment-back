import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MerchantApplication } from './merchant-application.entity';
import { AuditLog } from './audit-log.entity';

export enum UserRole {
  ADMIN = 'ADMIN',
  SALES = 'SALES',
  REVIEWER = 'REVIEWER',
}

@Entity('users')
@Index('IDX_users_email_lower', { synchronize: false })
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'varchar', length: 255 }) email: string;
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;
  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role: UserRole;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
  @OneToMany(() => MerchantApplication, (application) => application.creator)
  createdApplications: Relation<MerchantApplication[]>;
  @OneToMany(
    () => MerchantApplication,
    (application) => application.assignedReviewer,
  )
  assignedApplications: Relation<MerchantApplication[]>;
  @OneToMany(() => AuditLog, (log) => log.actor) auditLogs: Relation<
    AuditLog[]
  >;
}
