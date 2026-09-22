import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates PostgreSQL enums, extensions, tables, indexes, and triggers
 * matching the Shipping Maintenance Core schema.
 */
export class InitialSchema1740000000000 implements MigrationInterface {
  name = 'InitialSchema1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('BACKOFFICE', 'TECHNICIAN');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE entity_status AS ENUM ('ACTIVE', 'INACTIVE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE project_status AS ENUM (
          'OPEN', 'IN_PROGRESS', 'WAITING_FOR_INFO',
          'UNDER_REVIEW', 'COMPLETED', 'CLOSED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE assignment_type AS ENUM ('MANUAL', 'TEAM');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE finding_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE finding_status AS ENUM (
          'OPEN', 'NEEDS_INFO', 'UNDER_REVIEW', 'REVIEWED', 'CLOSED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE comment_visibility AS ENUM ('TECHNICIAN_VISIBLE', 'INTERNAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'TECHNICIAN',
        password_hash TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_users_is_active ON users (is_active)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        client_code VARCHAR(100) UNIQUE,
        address_line_1 VARCHAR(255),
        address_line_2 VARCHAR(255),
        city VARCHAR(100),
        postal_code VARCHAR(50),
        country VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        status entity_status NOT NULL DEFAULT 'ACTIVE',
        created_by UUID REFERENCES users (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_clients_name ON clients (name)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_clients_status ON clients (status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vessels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
        name VARCHAR(255) NOT NULL,
        imo_number VARCHAR(30) UNIQUE,
        vessel_type VARCHAR(100),
        current_location VARCHAR(255),
        description TEXT,
        status entity_status NOT NULL DEFAULT 'ACTIVE',
        created_by UUID REFERENCES users (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_vessels_client_id ON vessels (client_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_vessels_status ON vessels (status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        status entity_status NOT NULL DEFAULT 'ACTIVE',
        created_by UUID REFERENCES users (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_teams_status ON teams (status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        added_by UUID REFERENCES users (id) ON DELETE SET NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        removed_by UUID REFERENCES users (id) ON DELETE SET NULL,
        removed_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_team_members_active
        ON team_members (team_id, user_id)
        WHERE active = TRUE
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_team_members_team_id ON team_members (team_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_team_members_user_id ON team_members (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vessel_id UUID NOT NULL REFERENCES vessels (id) ON DELETE RESTRICT,
        project_code VARCHAR(50) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        notes TEXT,
        vessel_location_snapshot VARCHAR(255),
        status project_status NOT NULL DEFAULT 'OPEN',
        created_by UUID REFERENCES users (id) ON DELETE SET NULL,
        started_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_projects_vessel_id ON projects (vessel_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_projects_status ON projects (status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        assignment_type assignment_type NOT NULL,
        team_id UUID REFERENCES teams (id) ON DELETE RESTRICT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        assigned_by UUID REFERENCES users (id) ON DELETE SET NULL,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        unassigned_by UUID REFERENCES users (id) ON DELETE SET NULL,
        unassigned_at TIMESTAMPTZ,
        CONSTRAINT CHK_project_assignments_team CHECK (
          (assignment_type = 'TEAM' AND team_id IS NOT NULL)
          OR (assignment_type = 'MANUAL' AND team_id IS NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_project_assignments_project_id ON project_assignments (project_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        project_assignment_id UUID REFERENCES project_assignments (id) ON DELETE SET NULL,
        source_type assignment_type NOT NULL,
        source_team_id UUID REFERENCES teams (id) ON DELETE SET NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        added_by UUID REFERENCES users (id) ON DELETE SET NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        removed_by UUID REFERENCES users (id) ON DELETE SET NULL,
        removed_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_project_members_active
        ON project_members (project_id, user_id)
        WHERE active = TRUE
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_project_members_project_id ON project_members (project_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_project_members_user_id ON project_members (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS findings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        finding_number INTEGER NOT NULL,
        title VARCHAR(255),
        description TEXT NOT NULL,
        severity finding_severity NOT NULL DEFAULT 'MEDIUM',
        status finding_status NOT NULL DEFAULT 'OPEN',
        equipment_name VARCHAR(255),
        equipment_model VARCHAR(255),
        equipment_location VARCHAR(255),
        created_by UUID REFERENCES users (id) ON DELETE SET NULL,
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_findings_project_number UNIQUE (project_id, finding_number)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_findings_project_id ON findings (project_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_findings_severity ON findings (severity)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_findings_status ON findings (status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finding_updates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        finding_id UUID NOT NULL REFERENCES findings (id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        created_by UUID REFERENCES users (id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_finding_updates_finding_id ON finding_updates (finding_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uploaded_by UUID REFERENCES users (id) ON DELETE SET NULL,
        media_type media_type NOT NULL,
        original_filename VARCHAR(512) NOT NULL,
        mime_type VARCHAR(255) NOT NULL,
        storage_provider VARCHAR(100) NOT NULL,
        storage_key VARCHAR(1024) NOT NULL,
        external_file_id VARCHAR(255),
        thumbnail_key VARCHAR(1024),
        file_size_bytes BIGINT,
        duration_seconds INTEGER,
        width INTEGER,
        height INTEGER,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_media_assets_uploaded_by ON media_assets (uploaded_by)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_media_assets_storage_provider ON media_assets (storage_provider)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finding_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        finding_id UUID NOT NULL REFERENCES findings (id) ON DELETE CASCADE,
        finding_update_id UUID REFERENCES finding_updates (id) ON DELETE CASCADE,
        media_asset_id UUID NOT NULL REFERENCES media_assets (id) ON DELETE RESTRICT,
        caption VARCHAR(500),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_finding_attachments_media UNIQUE (finding_id, media_asset_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_finding_attachments_finding_id ON finding_attachments (finding_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_finding_attachments_finding_update_id ON finding_attachments (finding_update_id)`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_finding_attachment_update()
      RETURNS TRIGGER AS $$
      DECLARE
        update_finding_id UUID;
      BEGIN
        IF NEW.finding_update_id IS NULL THEN
          RETURN NEW;
        END IF;
        SELECT finding_id INTO update_finding_id
        FROM finding_updates WHERE id = NEW.finding_update_id;
        IF update_finding_id IS NULL THEN
          RAISE EXCEPTION 'finding_update_id % does not exist', NEW.finding_update_id;
        END IF;
        IF update_finding_id <> NEW.finding_id THEN
          RAISE EXCEPTION 'finding_update must belong to the same finding';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_finding_attachments_update_check ON finding_attachments;
      CREATE TRIGGER trg_finding_attachments_update_check
        BEFORE INSERT OR UPDATE ON finding_attachments
        FOR EACH ROW EXECUTE FUNCTION enforce_finding_attachment_update();
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finding_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        finding_id UUID NOT NULL REFERENCES findings (id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        comment TEXT NOT NULL,
        visibility comment_visibility NOT NULL DEFAULT 'TECHNICIAN_VISIBLE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_finding_comments_finding_id ON finding_comments (finding_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_finding_comments_visibility ON finding_comments (visibility)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS finding_comments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS finding_attachments CASCADE`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS enforce_finding_attachment_update CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS media_assets CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS finding_updates CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS findings CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS project_members CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS project_assignments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS projects CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS team_members CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS teams CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS vessels CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS clients CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE`);

    await queryRunner.query(`DROP TYPE IF EXISTS comment_visibility`);
    await queryRunner.query(`DROP TYPE IF EXISTS media_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS finding_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS finding_severity`);
    await queryRunner.query(`DROP TYPE IF EXISTS assignment_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS project_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS entity_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role`);
  }
}
