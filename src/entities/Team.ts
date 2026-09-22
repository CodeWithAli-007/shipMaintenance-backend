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
import { EntityStatus } from './enums.js';
import { User } from './User.js';
import type { TeamMember } from './TeamMember.js';
import type { ProjectAssignment } from './ProjectAssignment.js';

@Entity({ name: 'teams' })
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: EntityStatus,
    enumName: 'entity_status',
    default: EntityStatus.ACTIVE,
  })
  status!: EntityStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy!: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('TeamMember', 'team')
  members!: TeamMember[];

  @OneToMany('ProjectAssignment', 'team')
  projectAssignments!: ProjectAssignment[];
}
