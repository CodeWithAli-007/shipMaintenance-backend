import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectBackofficeMembers1740000001000
  implements MigrationInterface
{
  name = 'AddProjectBackofficeMembers1740000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_backoffice_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        added_by UUID REFERENCES users (id) ON DELETE SET NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        removed_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_project_backoffice_members_active
        ON project_backoffice_members (project_id, user_id)
        WHERE active = TRUE
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_project_backoffice_members_project_id
        ON project_backoffice_members (project_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_project_backoffice_members_user_id
        ON project_backoffice_members (user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS project_backoffice_members CASCADE`,
    );
  }
}
