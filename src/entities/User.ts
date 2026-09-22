import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './enums.js';
import type { Client } from './Client.js';
import type { Team } from './Team.js';
import type { TeamMember } from './TeamMember.js';
import type { Project } from './Project.js';
import type { ProjectMember } from './ProjectMember.js';
import type { ProjectBackofficeMember } from './ProjectBackofficeMember.js';
import type { Finding } from './Finding.js';
import type { FindingComment } from './FindingComment.js';
import type { MediaAsset } from './MediaAsset.js';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
    default: UserRole.TECHNICIAN,
  })
  role!: UserRole;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('Client', 'createdBy')
  createdClients!: Client[];

  @OneToMany('Team', 'createdBy')
  createdTeams!: Team[];

  @OneToMany('TeamMember', 'user')
  teamMemberships!: TeamMember[];

  @OneToMany('Project', 'createdBy')
  createdProjects!: Project[];

  @OneToMany('ProjectMember', 'user')
  projectMemberships!: ProjectMember[];

  @OneToMany('ProjectBackofficeMember', 'user')
  projectBackofficeMemberships!: ProjectBackofficeMember[];

  @OneToMany('Finding', 'createdBy')
  createdFindings!: Finding[];

  @OneToMany('FindingComment', 'user')
  findingComments!: FindingComment[];

  @OneToMany('MediaAsset', 'uploadedBy')
  uploadedMedia!: MediaAsset[];
}
