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
} from 'typeorm';
import { AssignmentType } from './enums.js';
import { Project } from './Project.js';
import { Team } from './Team.js';
import { User } from './User.js';
import type { ProjectMember } from './ProjectMember.js';

@Entity({ name: 'project_assignments' })
@Check(
  `("assignment_type" = 'TEAM' AND "team_id" IS NOT NULL) OR ("assignment_type" = 'MANUAL' AND "team_id" IS NULL)`,
)
export class ProjectAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Project, (project) => project.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({
    name: 'assignment_type',
    type: 'enum',
    enum: AssignmentType,
    enumName: 'assignment_type',
  })
  assignmentType!: AssignmentType;

  @ManyToOne(() => Team, (team) => team.projectAssignments, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'team_id' })
  team!: Team | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by' })
  assignedBy!: User | null;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unassigned_by' })
  unassignedBy!: User | null;

  @Column({ name: 'unassigned_at', type: 'timestamptz', nullable: true })
  unassignedAt!: Date | null;

  @OneToMany('ProjectMember', 'projectAssignment')
  members!: ProjectMember[];
}
