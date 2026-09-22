import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Portal roles are Backoffice and Technician only. Any legacy ADMIN becomes BACKOFFICE.
 */
export class DropAdminRole1740000002000 implements MigrationInterface {
  name = 'DropAdminRole1740000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users SET role = 'BACKOFFICE' WHERE role::text = 'ADMIN'
    `);

    await queryRunner.query(`
      ALTER TYPE user_role RENAME TO user_role_old
    `);
    await queryRunner.query(`
      CREATE TYPE user_role AS ENUM ('BACKOFFICE', 'TECHNICIAN')
    `);
    await queryRunner.query(`
      ALTER TABLE users
        ALTER COLUMN role DROP DEFAULT,
        ALTER COLUMN role TYPE user_role
          USING role::text::user_role,
        ALTER COLUMN role SET DEFAULT 'TECHNICIAN'::user_role
    `);
    await queryRunner.query(`DROP TYPE user_role_old`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE user_role RENAME TO user_role_old
    `);
    await queryRunner.query(`
      CREATE TYPE user_role AS ENUM ('ADMIN', 'BACKOFFICE', 'TECHNICIAN')
    `);
    await queryRunner.query(`
      ALTER TABLE users
        ALTER COLUMN role DROP DEFAULT,
        ALTER COLUMN role TYPE user_role
          USING role::text::user_role,
        ALTER COLUMN role SET DEFAULT 'TECHNICIAN'::user_role
    `);
    await queryRunner.query(`DROP TYPE user_role_old`);
  }
}
