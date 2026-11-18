import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from './user.entity';
import { RiskReview } from './risk-review.entity';
import { AuditLog } from './audit-log.entity';
import { RiskStatus } from './risk-status';

export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  NEEDS_INFO = 'NEEDS_INFO',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('merchant_applications')
@Index('IDX_applications_creator_created', ['createdBy', 'createdAt'])
@Index('IDX_applications_reviewer_status', [
  'assignedReviewerId',
  'applicationStatus',
])
@Index('IDX_applications_status_created', ['applicationStatus', 'createdAt'])
@Check('CHK_applications_volume', '"requested_monthly_volume" >= 0')
@Check('CHK_applications_review_version', '"review_version" >= 0')
@Check('CHK_applications_currency', `"currency" ~ '^[A-Z]{3}$'`)
export class MerchantApplication {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'business_name', type: 'varchar', length: 200 })
  businessName: string;
  @Column({ name: 'legal_business_name', type: 'varchar', length: 200 })
  legalBusinessName: string;
  @Column({ name: 'business_type', type: 'varchar', length: 100 })
  businessType: string;
  @Column({ name: 'owner_name', type: 'varchar', length: 150 })
  ownerName: string;
  @Column({ name: 'contact_email', type: 'varchar', length: 255 })
  contactEmail: string;
  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  contactPhone: string | null;
  // PostgreSQL numeric is a string to preserve decimal precision.
  @Column({
    name: 'requested_monthly_volume',
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  requestedMonthlyVolume: string;
  @Column({ type: 'char', length: 3 }) currency: string;
  @Column({
    name: 'application_status',
    type: 'enum',
    enum: ApplicationStatus,
    enumName: 'application_status',
    default: ApplicationStatus.DRAFT,
  })
  applicationStatus: ApplicationStatus;
  @Column({
    name: 'risk_status',
    type: 'enum',
    enum: RiskStatus,
    enumName: 'risk_status',
    default: RiskStatus.NOT_STARTED,
  })
  riskStatus: RiskStatus;
  @Column({ name: 'review_version', type: 'integer', default: 0 })
  reviewVersion: number;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @ManyToOne(() => User, (user) => user.createdApplications, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'created_by' })
  creator: Relation<User>;
  @Column({ name: 'assigned_reviewer_id', type: 'uuid', nullable: true })
  assignedReviewerId: string | null;
  @ManyToOne(() => User, (user) => user.assignedApplications, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'assigned_reviewer_id' })
  assignedReviewer: Relation<User> | null;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
  @OneToMany(() => RiskReview, (review) => review.application)
  riskReviews: Relation<RiskReview[]>;
  @OneToMany(() => AuditLog, (log) => log.application) auditLogs: Relation<
    AuditLog[]
  >;
}
