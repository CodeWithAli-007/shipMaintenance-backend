import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectPriority1740000004000 implements MigrationInterface {
  name = 'AddProjectPriority1740000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE project_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH')
    `);
    await queryRunner.query(`
      ALTER TABLE projects
        ADD COLUMN priority project_priority NOT NULL DEFAULT 'MEDIUM'
    `);
    await queryRunner.query(`
      CREATE INDEX idx_projects_priority ON projects (priority)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_projects_priority`);
    await queryRunner.query(`ALTER TABLE projects DROP COLUMN IF EXISTS priority`);
    await queryRunner.query(`DROP TYPE IF EXISTS project_priority`);
  }
}
