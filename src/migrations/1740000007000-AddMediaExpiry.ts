import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaExpiry1740000007000 implements MigrationInterface {
  name = 'AddMediaExpiry1740000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE media_assets
        ADD COLUMN expires_at timestamptz
    `);
    await queryRunner.query(`
      UPDATE media_assets
        SET expires_at = created_at + interval '30 days'
    `);
    await queryRunner.query(`
      ALTER TABLE media_assets
        ALTER COLUMN expires_at SET NOT NULL,
        ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days')
    `);
    await queryRunner.query(`
      CREATE INDEX idx_media_assets_expires_at ON media_assets (expires_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_media_assets_expires_at`);
    await queryRunner.query(`ALTER TABLE media_assets DROP COLUMN IF EXISTS expires_at`);
  }
}
