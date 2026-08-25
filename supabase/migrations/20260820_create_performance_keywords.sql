-- Migration: 20260820_create_performance_keywords
-- Tabela separada de palavras-chave Google Ads.
--
-- Mantida fora de performance_daily para evitar duplicação de métricas
-- (spend, impressions, clicks etc.) ao fazer SUM nas queries de KPI.
--
-- IMPORTANTE: Não executar automaticamente.
-- Aplicar manualmente via SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS performance_keywords (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  integration_id UUID          NOT NULL REFERENCES client_integrations(id) ON DELETE CASCADE,
  date           DATE          NOT NULL,
  campaign_name  TEXT          NOT NULL,
  keyword_text   TEXT          NOT NULL,
  impressions    INTEGER       NOT NULL DEFAULT 0,
  clicks         INTEGER       NOT NULL DEFAULT 0,
  synced_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT performance_keywords_unique
    UNIQUE (client_id, integration_id, date, campaign_name, keyword_text)
);

CREATE INDEX IF NOT EXISTS performance_keywords_client_date_idx
  ON performance_keywords (client_id, date);

ALTER TABLE performance_keywords ENABLE ROW LEVEL SECURITY;
-- Zero policies. Acesso exclusivo via service role (createAdminClient).
-- Consultas diretas por client autenticado ou anônimo são negadas por padrão.
