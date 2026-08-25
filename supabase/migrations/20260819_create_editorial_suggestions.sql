-- Migration: 20260819_create_editorial_suggestions
-- Tabela de sugestões de alteração em descrição/legenda do calendário editorial.
-- proposed_text nullable: NULL representa exclusão do trecho selecionado.
--
-- IMPORTANTE: Não executar automaticamente.
-- Aplicar manualmente via SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS editorial_suggestions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id       UUID         NOT NULL REFERENCES editorial_contents(id) ON DELETE CASCADE,
  author_id        UUID         REFERENCES profiles(id),
  field            TEXT         NOT NULL CHECK (field IN ('description', 'caption')),
  original_start   INTEGER      NOT NULL,
  original_end     INTEGER      NOT NULL,
  original_text    TEXT         NOT NULL,
  proposed_text    TEXT,
  status           TEXT         NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'rejected', 'conflict')),
  resolved_by      UUID         REFERENCES profiles(id),
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT editorial_suggestions_range CHECK (original_end > original_start)
);

CREATE INDEX IF NOT EXISTS editorial_suggestions_content_status_idx
  ON editorial_suggestions (content_id, status);

ALTER TABLE editorial_suggestions ENABLE ROW LEVEL SECURITY;
-- Zero policies. Acesso exclusivo via service role (createAdminClient).
-- Consultas diretas por sessão autenticada ou anônima são negadas por padrão.
