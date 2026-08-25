-- Migration: 20260819_create_manual_sales
-- Purpose: tabela de vendas manuais para Meta Ads e Google Ads.
--
-- IMPORTANTE: Não executar diretamente. Revisar e aplicar via
-- painel do Supabase ou supabase db push após aprovação.

CREATE TABLE IF NOT EXISTS manual_sales (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel        TEXT          NOT NULL CHECK (channel IN ('meta_ads', 'google_ads')),
  date           DATE          NOT NULL,
  campaign_id    TEXT,
  campaign_name  TEXT,
  purchases      INTEGER       NOT NULL DEFAULT 1 CHECK (purchases >= 1),
  purchase_value DECIMAL(12,2) NOT NULL CHECK (purchase_value > 0),
  notes          TEXT,
  created_by     UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_sales_client_channel_date_idx
  ON manual_sales (client_id, channel, date);

-- RLS habilitado. Zero policies.
-- Acesso exclusivo via service role (createAdminClient).
-- Qualquer acesso direto por client autenticado ou anônimo é negado por padrão.
ALTER TABLE manual_sales ENABLE ROW LEVEL SECURITY;
