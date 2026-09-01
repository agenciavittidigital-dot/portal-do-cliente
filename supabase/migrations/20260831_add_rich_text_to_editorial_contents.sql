-- Add rich text columns to editorial_contents
-- description_rich / caption_rich store formatted markup.
-- description / caption remain the canonical plain text used by the suggestion system.

ALTER TABLE editorial_contents
  ADD COLUMN IF NOT EXISTS description_rich TEXT,
  ADD COLUMN IF NOT EXISTS caption_rich     TEXT;
