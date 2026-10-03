import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignCoreSchemaV31740000008000 implements MigrationInterface {
  name = 'AlignCoreSchemaV31740000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE clients
        ALTER COLUMN city TYPE varchar(150),
        ALTER COLUMN postal_code TYPE varchar(30)
    `);
    await queryRunner.query(`
      ALTER TABLE projects
        ALTER COLUMN project_code TYPE varchar(100)
    `);
    await queryRunner.query(`
      ALTER TABLE media_assets
        ALTER COLUMN original_filename TYPE varchar(500),
        ALTER COLUMN original_filename DROP NOT NULL,
        ALTER COLUMN mime_type TYPE varchar(150),
        ALTER COLUMN mime_type DROP NOT NULL,
        ALTER COLUMN storage_provider TYPE varchar(80),
        ALTER COLUMN storage_key TYPE text,
        ALTER COLUMN external_file_id TYPE text,
        ALTER COLUMN thumbnail_key TYPE text,
        ALTER COLUMN duration_seconds TYPE numeric USING duration_seconds::numeric,
        ALTER COLUMN metadata DROP NOT NULL,
        ALTER COLUMN metadata DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE finding_attachments
        ALTER COLUMN caption TYPE text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE finding_attachments
        ALTER COLUMN caption TYPE varchar(500)
    `);
    await queryRunner.query(`
      UPDATE media_assets SET metadata = '{}'::jsonb WHERE metadata IS NULL
    `);
    await queryRunner.query(`
      UPDATE media_assets
        SET original_filename = COALESCE(original_filename, 'unknown'),
            mime_type = COALESCE(mime_type, 'application/octet-stream')
      WHERE original_filename IS NULL OR mime_type IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE media_assets
        ALTER COLUMN duration_seconds TYPE int USING ROUND(duration_seconds)::int,
        ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
        ALTER COLUMN metadata SET NOT NULL,
        ALTER COLUMN thumbnail_key TYPE varchar(1024),
        ALTER COLUMN external_file_id TYPE varchar(255),
        ALTER COLUMN storage_key TYPE varchar(1024),
        ALTER COLUMN storage_provider TYPE varchar(100),
        ALTER COLUMN mime_type TYPE varchar(255),
        ALTER COLUMN mime_type SET NOT NULL,
        ALTER COLUMN original_filename TYPE varchar(512),
        ALTER COLUMN original_filename SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE projects
        ALTER COLUMN project_code TYPE varchar(50)
    `);
    await queryRunner.query(`
      ALTER TABLE clients
        ALTER COLUMN city TYPE varchar(100),
        ALTER COLUMN postal_code TYPE varchar(50)
    `);
  }
}
