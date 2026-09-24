import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEncryptedProjectChat1740000006000 implements MigrationInterface {
  name = 'AddEncryptedProjectChat1740000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE matrix_user_identities (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        matrix_user_id varchar(255) NOT NULL UNIQUE,
        matrix_username varchar(128) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE project_chat_rooms (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
        matrix_room_id varchar(255) UNIQUE,
        sync_status varchar(20) NOT NULL DEFAULT 'PENDING',
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE chat_membership_outbox (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        operation varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'PENDING',
        attempts int NOT NULL DEFAULT 0,
        last_error text,
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_chat_outbox_pending
        ON chat_membership_outbox(status, next_attempt_at)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_chat_outbox_project ON chat_membership_outbox(project_id)
    `);

    await queryRunner.query(`
      INSERT INTO project_backoffice_members(project_id, user_id, added_by)
      SELECT p.id, p.created_by, p.created_by
      FROM projects p
      WHERE p.created_by IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM project_backoffice_members pbm
          WHERE pbm.project_id = p.id AND pbm.user_id = p.created_by AND pbm.active = true
        )
    `);
    await queryRunner.query(`
      INSERT INTO project_chat_rooms(project_id)
      SELECT id FROM projects
    `);
    await queryRunner.query(`
      INSERT INTO chat_membership_outbox(project_id, operation)
      SELECT id, 'CREATE_ROOM' FROM projects
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_membership_outbox`);
    await queryRunner.query(`DROP TABLE IF EXISTS project_chat_rooms`);
    await queryRunner.query(`DROP TABLE IF EXISTS matrix_user_identities`);
  }
}
