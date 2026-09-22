import {
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
import { Finding } from './Finding.js';
import { User } from './User.js';
import type { FindingAttachment } from './FindingAttachment.js';

@Entity({ name: 'finding_updates' })
export class FindingUpdate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Finding, (finding) => finding.updates, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'finding_id' })
  finding!: Finding;

  @Column({ type: 'text' })
  note!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('FindingAttachment', 'findingUpdate')
  attachments!: FindingAttachment[];
}
