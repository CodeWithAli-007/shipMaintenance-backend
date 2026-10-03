import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiAnalysisSchema1740000009000 implements MigrationInterface {
  name = 'AddAiAnalysisSchema1740000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE ai_analysis_type AS ENUM ('MEDIA_EVIDENCE', 'FINDING_ANALYSIS');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE ai_analysis_status AS ENUM (
          'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'OUTDATED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE media_assets
        ADD COLUMN IF NOT EXISTS content_hash varchar(64)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_media_assets_content_hash
        ON media_assets (content_hash)
        WHERE content_hash IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_type ai_analysis_type NOT NULL,
        media_asset_id UUID NULL REFERENCES media_assets(id) ON DELETE CASCADE,
        finding_id UUID NULL REFERENCES findings(id) ON DELETE CASCADE,
        status ai_analysis_status NOT NULL DEFAULT 'PENDING',
        model_name varchar(150),
        prompt_version varchar(50),
        source_hash varchar(64),
        input_hash varchar(64),
        input_snapshot jsonb,
        source_text_snapshot text,
        result jsonb,
        evidence_text text,
        transcript_text text,
        requested_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        error_message text,
        analyzed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_ai_analysis_type_fks CHECK (
          (
            analysis_type = 'MEDIA_EVIDENCE'
            AND media_asset_id IS NOT NULL
            AND finding_id IS NULL
          )
          OR (
            analysis_type = 'FINDING_ANALYSIS'
            AND finding_id IS NOT NULL
            AND media_asset_id IS NULL
          )
        ),
        CONSTRAINT uq_ai_analysis_media_evidence UNIQUE (media_asset_id),
        CONSTRAINT uq_ai_analysis_finding UNIQUE (finding_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_analysis_type ON ai_analysis (analysis_type)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_analysis_status ON ai_analysis (status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finding_ai_media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
        finding_attachment_id UUID NOT NULL REFERENCES finding_attachments(id) ON DELETE CASCADE,
        selected boolean NOT NULL DEFAULT FALSE,
        selected_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        selected_at timestamptz,
        updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_finding_ai_media_attachment UNIQUE (finding_id, finding_attachment_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_finding_ai_media_finding
        ON finding_ai_media (finding_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_finding_ai_media_selected
        ON finding_ai_media (finding_id, selected)
        WHERE selected = TRUE
    `);

    // Ensure attachment belongs to the same finding
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_finding_ai_media_attachment()
      RETURNS trigger AS $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM finding_attachments fa
          WHERE fa.id = NEW.finding_attachment_id
            AND fa.finding_id = NEW.finding_id
        ) THEN
          RAISE EXCEPTION 'finding_attachment_id must belong to finding_id';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_finding_ai_media_attachment ON finding_ai_media
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_finding_ai_media_attachment
      BEFORE INSERT OR UPDATE ON finding_ai_media
      FOR EACH ROW EXECUTE FUNCTION check_finding_ai_media_attachment()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_finding_ai_media_attachment ON finding_ai_media`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS check_finding_ai_media_attachment()`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS finding_ai_media`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_analysis`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_media_assets_content_hash`);
    await queryRunner.query(
      `ALTER TABLE media_assets DROP COLUMN IF EXISTS content_hash`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS ai_analysis_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS ai_analysis_type`);
  }
}
