import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './Project.js';

export type ChatRoomSyncStatus = 'PENDING' | 'READY' | 'ERROR';

@Entity({ name: 'project_chat_rooms' })
export class ProjectChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @OneToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Index({ unique: true })
  @Column({ name: 'matrix_room_id', type: 'varchar', length: 255, nullable: true })
  matrixRoomId!: string | null;

  @Column({ name: 'sync_status', type: 'varchar', length: 20, default: 'PENDING' })
  syncStatus!: ChatRoomSyncStatus;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
