import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailAuth1740000012000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
      CREATE TABLE auth_email_challenges (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose varchar(10) NOT NULL CHECK (purpose IN ('login', 'reset')),
        code_hash varchar(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        issued_at timestamptz NOT NULL,
        attempts smallint NOT NULL DEFAULT 0,
        UNIQUE (user_id, purpose)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE auth_email_challenges');
    await queryRunner.query('ALTER TABLE users DROP COLUMN must_change_password');
  }
}
