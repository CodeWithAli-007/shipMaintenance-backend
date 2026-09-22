import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Finding } from './Finding.js';
import { FindingUpdate } from './FindingUpdate.js';
import { MediaAsset } from './MediaAsset.js';

@Entity({ name: 'finding_attachments' })
@Unique('uq_finding_attachments_media', ['finding', 'mediaAsset'])
export class FindingAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Finding, (finding) => finding.attachments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'finding_id' })
  finding!: Finding;

  @Index()
  @ManyToOne(() => FindingUpdate, (update) => update.attachments, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'finding_update_id' })
  findingUpdate!: FindingUpdate | null;

  @ManyToOne(() => MediaAsset, (asset) => asset.findingAttachments, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'media_asset_id' })
  mediaAsset!: MediaAsset;

  @Column({ type: 'varchar', length: 500, nullable: true })
  caption!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
