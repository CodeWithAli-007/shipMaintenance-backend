import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthSessions1740000005000 implements MigrationInterface {
  name = 'AddAuthSessions1740000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE auth_sessions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash varchar(64) NOT NULL UNIQUE,
        csrf_hash varchar(64) NOT NULL,
        user_agent varchar(512),
        ip_address varchar(64),
        expires_at timestamptz NOT NULL,
        last_seen_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id)`);
    await queryRunner.query(`CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS auth_sessions`);
  }
}
