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
import { CommentVisibility } from './enums.js';
import { Finding } from './Finding.js';
import { User } from './User.js';

@Entity({ name: 'finding_comments' })
export class FindingComment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Finding, (finding) => finding.comments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'finding_id' })
  finding!: Finding;

  @ManyToOne(() => User, (user) => user.findingComments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'text' })
  comment!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: CommentVisibility,
    enumName: 'comment_visibility',
    default: CommentVisibility.TECHNICIAN_VISIBLE,
  })
  visibility!: CommentVisibility;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
