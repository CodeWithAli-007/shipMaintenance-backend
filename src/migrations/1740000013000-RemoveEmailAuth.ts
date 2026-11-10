import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AddEmailAuth1740000012000 } from './1740000012000-AddEmailAuth.js';

export class RemoveEmailAuth1740000013000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Invalidate the shared invitation password before removing its sign-in guard.
    await queryRunner.query(`
      UPDATE auth_sessions SET revoked_at = now()
      WHERE revoked_at IS NULL
        AND user_id IN (SELECT id FROM users WHERE must_change_password);
      UPDATE users SET password_hash = NULL WHERE must_change_password;
    `);
    await new AddEmailAuth1740000012000().down(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await new AddEmailAuth1740000012000().up(queryRunner);
  }
}
