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
import { Client } from './Client.js';
import { User } from './User.js';
import type { Project } from './Project.js';

@Entity({ name: 'vessels' })
export class Vessel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Client, (client) => client.vessels, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'imo_number', type: 'varchar', length: 30, unique: true, nullable: true })
  imoNumber!: string | null;

  @Column({ name: 'vessel_type', type: 'varchar', length: 100, nullable: true })
  vesselType!: string | null;

  @Column({ name: 'current_location', type: 'varchar', length: 255, nullable: true })
  currentLocation!: string | null;

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

  @OneToMany('Project', 'vessel')
  projects!: Project[];
}
