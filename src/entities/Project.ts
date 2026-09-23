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
import { ProjectStatus, ProjectPriority } from './enums.js';
import { Vessel } from './Vessel.js';
import { User } from './User.js';
import type { ProjectAssignment } from './ProjectAssignment.js';
import type { ProjectMember } from './ProjectMember.js';
import type { ProjectBackofficeMember } from './ProjectBackofficeMember.js';
import type { Finding } from './Finding.js';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Vessel, (vessel) => vessel.projects, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vessel_id' })
  vessel!: Vessel;

  @Column({ name: 'project_code', type: 'varchar', length: 50, unique: true })
  projectCode!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    name: 'vessel_location_snapshot',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  vesselLocationSnapshot!: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ProjectStatus,
    enumName: 'project_status',
    default: ProjectStatus.OPEN,
  })
  status!: ProjectStatus;

  @Index()
  @Column({
    type: 'enum',
    enum: ProjectPriority,
    enumName: 'project_priority',
    default: ProjectPriority.MEDIUM,
  })
  priority!: ProjectPriority;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: User | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('ProjectAssignment', 'project')
  assignments!: ProjectAssignment[];

  @OneToMany('ProjectMember', 'project')
  members!: ProjectMember[];

  @OneToMany('ProjectBackofficeMember', 'project')
  backofficeMembers!: ProjectBackofficeMember[];

  @OneToMany('Finding', 'project')
  findings!: Finding[];
}
