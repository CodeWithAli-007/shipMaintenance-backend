import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssignmentType } from './enums.js';
import { Project } from './Project.js';
import { ProjectAssignment } from './ProjectAssignment.js';
import { Team } from './Team.js';
import { User } from './User.js';

@Entity({ name: 'project_members' })
@Index('uq_project_members_active', ['project', 'user'], {
  unique: true,
  where: '"active" = true',
})
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Project, (project) => project.members, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Index()
  @ManyToOne(() => User, (user) => user.projectMemberships, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => ProjectAssignment, (assignment) => assignment.members, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'project_assignment_id' })
  projectAssignment!: ProjectAssignment | null;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: AssignmentType,
    enumName: 'assignment_type',
  })
  sourceType!: AssignmentType;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_team_id' })
  sourceTeam!: Team | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'added_by' })
  addedBy!: User | null;

  @CreateDateColumn({ name: 'added_at', type: 'timestamptz' })
  addedAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'removed_by' })
  removedBy!: User | null;

  @Column({ name: 'removed_at', type: 'timestamptz', nullable: true })
  removedAt!: Date | null;
}
