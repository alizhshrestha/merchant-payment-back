import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MerchantApplication } from './merchant-application.entity';
import { User } from './user.entity';

@Entity('audit_logs')
@Index('IDX_audit_logs_application_created', ['applicationId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'application_id', type: 'uuid' }) applicationId: string;
  @ManyToOne(
    () => MerchantApplication,
    (application) => application.auditLogs,
    { nullable: false, onDelete: 'RESTRICT' },
  )
  @JoinColumn({ name: 'application_id' })
  application: Relation<MerchantApplication>;
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true }) actorUserId:
    string | null;
  @ManyToOne(() => User, (user) => user.auditLogs, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'actor_user_id' })
  actor: Relation<User> | null;
  @Column({ type: 'varchar', length: 60 }) action: string;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
