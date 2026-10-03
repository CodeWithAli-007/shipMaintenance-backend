import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AiAnalysisStatus, AiAnalysisType } from './enums.js';
import { Finding } from './Finding.js';
import { MediaAsset } from './MediaAsset.js';
import { User } from './User.js';

@Entity({ name: 'ai_analysis' })
export class AiAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({
    name: 'analysis_type',
    type: 'enum',
    enum: AiAnalysisType,
    enumName: 'ai_analysis_type',
  })
  analysisType!: AiAnalysisType;

  @Index({ unique: true })
  @ManyToOne(() => MediaAsset, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'media_asset_id' })
  mediaAsset!: MediaAsset | null;

  @Index({ unique: true })
  @ManyToOne(() => Finding, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'finding_id' })
  finding!: Finding | null;

  @Index()
  @Column({
    type: 'enum',
    enum: AiAnalysisStatus,
    enumName: 'ai_analysis_status',
    default: AiAnalysisStatus.PENDING,
  })
  status!: AiAnalysisStatus;

  @Column({ name: 'model_name', type: 'varchar', length: 150, nullable: true })
  modelName!: string | null;

  @Column({ name: 'prompt_version', type: 'varchar', length: 50, nullable: true })
  promptVersion!: string | null;

  @Column({ name: 'source_hash', type: 'varchar', length: 64, nullable: true })
  sourceHash!: string | null;

  @Column({ name: 'input_hash', type: 'varchar', length: 64, nullable: true })
  inputHash!: string | null;

  @Column({ name: 'input_snapshot', type: 'jsonb', nullable: true })
  inputSnapshot!: Record<string, unknown> | null;

  @Column({ name: 'source_text_snapshot', type: 'text', nullable: true })
  sourceTextSnapshot!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  result!: Record<string, unknown> | null;

  @Column({ name: 'evidence_text', type: 'text', nullable: true })
  evidenceText!: string | null;

  @Column({ name: 'transcript_text', type: 'text', nullable: true })
  transcriptText!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requested_by' })
  requestedBy!: User | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'analyzed_at', type: 'timestamptz', nullable: true })
  analyzedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
