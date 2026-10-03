import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Finding } from './Finding.js';
import { FindingAttachment } from './FindingAttachment.js';
import { User } from './User.js';

@Entity({ name: 'finding_ai_media' })
@Unique('uq_finding_ai_media_attachment', ['finding', 'findingAttachment'])
export class FindingAiMedia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Finding, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'finding_id' })
  finding!: Finding;

  @Index()
  @ManyToOne(() => FindingAttachment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'finding_attachment_id' })
  findingAttachment!: FindingAttachment;

  @Column({ type: 'boolean', default: false })
  selected!: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'selected_by' })
  selectedBy!: User | null;

  @Column({ name: 'selected_at', type: 'timestamptz', nullable: true })
  selectedAt!: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy!: User | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
