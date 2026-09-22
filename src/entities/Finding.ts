import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { FindingSeverity, FindingStatus } from './enums.js';
import { Project } from './Project.js';
import { User } from './User.js';
import type { FindingUpdate } from './FindingUpdate.js';
import type { FindingAttachment } from './FindingAttachment.js';
import type { FindingComment } from './FindingComment.js';

@Entity({ name: 'findings' })
@Unique('uq_findings_project_number', ['project', 'findingNumber'])
export class Finding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Project, (project) => project.findings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ name: 'finding_number', type: 'int' })
  findingNumber!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: FindingSeverity,
    enumName: 'finding_severity',
    default: FindingSeverity.MEDIUM,
  })
  severity!: FindingSeverity;

  @Index()
  @Column({
    type: 'enum',
    enum: FindingStatus,
    enumName: 'finding_status',
    default: FindingStatus.OPEN,
  })
  status!: FindingStatus;

  @Column({ name: 'equipment_name', type: 'varchar', length: 255, nullable: true })
  equipmentName!: string | null;

  @Column({ name: 'equipment_model', type: 'varchar', length: 255, nullable: true })
  equipmentModel!: string | null;

  @Column({
    name: 'equipment_location',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  equipmentLocation!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: User | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('FindingUpdate', 'finding')
  updates!: FindingUpdate[];

  @OneToMany('FindingAttachment', 'finding')
  attachments!: FindingAttachment[];

  @OneToMany('FindingComment', 'finding')
  comments!: FindingComment[];
}
