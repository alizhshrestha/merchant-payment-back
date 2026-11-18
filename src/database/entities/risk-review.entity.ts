import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MerchantApplication } from './merchant-application.entity';
import { RiskStatus } from './risk-status';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

@Entity('risk_reviews')
@Unique('UQ_risk_reviews_application_version', [
  'applicationId',
  'reviewVersion',
])
@Check('CHK_risk_reviews_version', '"review_version" > 0')
@Check('CHK_risk_reviews_attempt_count', '"attempt_count" >= 0')
@Check('CHK_risk_reviews_score', '"risk_score" BETWEEN 0 AND 100')
@Check('CHK_risk_reviews_started', `"status" <> 'NOT_STARTED'`)
export class RiskReview {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'application_id', type: 'uuid' }) applicationId: string;
  @ManyToOne(
    () => MerchantApplication,
    (application) => application.riskReviews,
    { nullable: false, onDelete: 'RESTRICT' },
  )
  @JoinColumn({ name: 'application_id' })
  application: Relation<MerchantApplication>;
  @Column({ name: 'review_version', type: 'integer' }) reviewVersion: number;
  @Column({
    type: 'enum',
    enum: RiskStatus,
    enumName: 'risk_status',
    default: RiskStatus.PENDING,
  })
  status: RiskStatus;
  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: RiskLevel,
    enumName: 'risk_level',
    nullable: true,
  })
  riskLevel: RiskLevel | null;
  @Column({ name: 'risk_score', type: 'integer', nullable: true }) riskScore:
    number | null;
  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount: number;
  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
