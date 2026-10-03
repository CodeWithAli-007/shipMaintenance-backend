import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AddProjectBackofficeMembers1740000001000 } from './1740000001000-AddProjectBackofficeMembers.js';
import { AddEncryptedProjectChat1740000006000 } from './1740000006000-AddEncryptedProjectChat.js';

export class RemoveProjectChat1740000011000 implements MigrationInterface {
  name = 'RemoveProjectChat1740000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_membership_outbox`);
    await queryRunner.query(`DROP TABLE IF EXISTS project_chat_rooms`);
    await queryRunner.query(`DROP TABLE IF EXISTS matrix_user_identities`);
    await queryRunner.query(`DROP TABLE IF EXISTS project_backoffice_members`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await new AddProjectBackofficeMembers1740000001000().up(queryRunner);
    await new AddEncryptedProjectChat1740000006000().up(queryRunner);
  }
}
