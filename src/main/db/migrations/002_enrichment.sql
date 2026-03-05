-- Add enrichment columns to vst_plugins
ALTER TABLE vst_plugins ADD COLUMN subcategory TEXT;
ALTER TABLE vst_plugins ADD COLUMN description TEXT;
ALTER TABLE vst_plugins ADD COLUMN icon_url TEXT;
ALTER TABLE vst_plugins ADD COLUMN website TEXT;
ALTER TABLE vst_plugins ADD COLUMN enriched INTEGER NOT NULL DEFAULT 0;

-- Add icon data to daws (base64 data URI)
ALTER TABLE daws ADD COLUMN icon_data TEXT;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_vst_plugins_enriched ON vst_plugins(enriched);
CREATE INDEX IF NOT EXISTS idx_vst_plugins_subcategory ON vst_plugins(subcategory);
