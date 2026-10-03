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

  @Column({ name: 'original_filename', type: 'varchar', length: 500, nullable: true })
  originalFilename!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 150, nullable: true })
  mimeType!: string | null;

  @Index()
  @Column({ name: 'storage_provider', type: 'varchar', length: 80 })
  storageProvider!: string;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey!: string;

  @Column({ name: 'external_file_id', type: 'text', nullable: true })
  externalFileId!: string | null;

  @Column({ name: 'thumbnail_key', type: 'text', nullable: true })
  thumbnailKey!: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes!: string | null;

  @Column({ name: 'duration_seconds', type: 'numeric', nullable: true })
  durationSeconds!: string | null;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true })
  contentHash!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @OneToMany('FindingAttachment', 'mediaAsset')
  findingAttachments!: FindingAttachment[];
}
