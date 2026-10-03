import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeMediaPermanent1740000010000 implements MigrationInterface {
  name = 'MakeMediaPermanent1740000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE media_assets
        ALTER COLUMN expires_at DROP DEFAULT,
        ALTER COLUMN expires_at DROP NOT NULL
    `);
    await queryRunner.query(`UPDATE media_assets SET expires_at = NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE media_assets
        SET expires_at = created_at + interval '30 days'
        WHERE expires_at IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE media_assets
        ALTER COLUMN expires_at SET NOT NULL,
        ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days')
    `);
  }
}
