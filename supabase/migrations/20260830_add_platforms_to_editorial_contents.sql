-- Migration: 20260830_add_platforms_to_editorial_contents
-- Adiciona suporte a múltiplas plataformas (Instagram, Facebook etc.) nos conteúdos editoriais.
--
-- IMPORTANTE: Não executar diretamente. Revisar e aplicar via
-- painel do Supabase ou supabase db push após aprovação.

ALTER TABLE editorial_contents
  ADD COLUMN platforms TEXT[] NOT NULL DEFAULT '{}';
