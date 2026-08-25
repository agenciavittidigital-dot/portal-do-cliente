"use client";

import { useState, useCallback, useEffect } from "react";

export interface SuggestionRow {
  id: string;
  field: "description" | "caption";
  original_start: number;
  original_end: number;
  original_text: string;
  proposed_text: string | null;
  status: "pending" | "accepted" | "rejected" | "conflict";
  authorName: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

interface SubmitParams {
  field: "description" | "caption";
  original_start: number;
  original_end: number;
  original_text: string;
  proposed_text: string | null;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  conflict?: boolean;
}

interface UseEditorialSuggestionsResult {
  suggestions: SuggestionRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  submit: (params: SubmitParams) => Promise<ActionResult>;
  accept: (suggestionId: string) => Promise<ActionResult>;
  reject: (suggestionId: string, note?: string) => Promise<ActionResult>;
}

export function useEditorialSuggestions(
  contentId: string | null,
  enabled: boolean,
): UseEditorialSuggestionsResult {
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!contentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/editorial/${contentId}/suggestions`);
      const data = (await res.json()) as {
        success: boolean;
        suggestions?: SuggestionRow[];
        error?: string;
      };
      if (data.success) {
        setSuggestions(data.suggestions ?? []);
      } else {
        setError(data.error ?? "Erro ao carregar sugestões.");
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    if (enabled && contentId) {
      refresh();
    } else {
      setSuggestions([]);
      setError(null);
    }
  }, [enabled, contentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useCallback(
    async (params: SubmitParams): Promise<ActionResult> => {
      if (!contentId) return { success: false, error: "Sem conteúdo." };
      try {
        const res = await fetch(`/api/admin/editorial/${contentId}/suggestions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = (await res.json()) as { success: boolean; error?: string };
        if (data.success) {
          await refresh();
          return { success: true };
        }
        return { success: false, error: data.error ?? "Erro ao enviar sugestão." };
      } catch {
        return { success: false, error: "Erro de conexão." };
      }
    },
    [contentId, refresh],
  );

  const accept = useCallback(
    async (suggestionId: string): Promise<ActionResult> => {
      if (!contentId) return { success: false, error: "Sem conteúdo." };
      try {
        const res = await fetch(
          `/api/admin/editorial/${contentId}/suggestions/${suggestionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "accept" }),
          },
        );
        const data = (await res.json()) as {
          success: boolean;
          error?: string;
          conflict?: boolean;
        };
        if (data.success) {
          await refresh();
          return { success: true };
        }
        if (res.status === 409) {
          await refresh();
          return { success: false, conflict: true, error: data.error };
        }
        return { success: false, error: data.error ?? "Erro ao aceitar sugestão." };
      } catch {
        return { success: false, error: "Erro de conexão." };
      }
    },
    [contentId, refresh],
  );

  const reject = useCallback(
    async (suggestionId: string, note?: string): Promise<ActionResult> => {
      if (!contentId) return { success: false, error: "Sem conteúdo." };
      try {
        const res = await fetch(
          `/api/admin/editorial/${contentId}/suggestions/${suggestionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reject", note }),
          },
        );
        const data = (await res.json()) as { success: boolean; error?: string };
        if (data.success) {
          await refresh();
          return { success: true };
        }
        return { success: false, error: data.error ?? "Erro ao rejeitar sugestão." };
      } catch {
        return { success: false, error: "Erro de conexão." };
      }
    },
    [contentId, refresh],
  );

  return { suggestions, loading, error, refresh, submit, accept, reject };
}
