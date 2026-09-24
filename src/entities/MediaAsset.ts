import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MediaType } from './enums.js';
import { User } from './User.js';
import type { FindingAttachment } from './FindingAttachment.js';

@Entity({ name: 'media_assets' })
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => User, (user) => user.uploadedMedia, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy!: User | null;

  @Column({
    name: 'media_type',
    type: 'enum',
    enum: MediaType,
    enumName: 'media_type',
  })
  mediaType!: MediaType;

  @Column({ name: 'original_filename', type: 'varchar', length: 512 })
  originalFilename!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 255 })
  mimeType!: string;

  @Index()
  @Column({ name: 'storage_provider', type: 'varchar', length: 100 })
  storageProvider!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 1024 })
  storageKey!: string;

  @Column({ name: 'external_file_id', type: 'varchar', length: 255, nullable: true })
  externalFileId!: string | null;

  @Column({ name: 'thumbnail_key', type: 'varchar', length: 1024, nullable: true })
  thumbnailKey!: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes!: string | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ type: 'jsonb', default: () => ({}) })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @OneToMany('FindingAttachment', 'mediaAsset')
  findingAttachments!: FindingAttachment[];
}
