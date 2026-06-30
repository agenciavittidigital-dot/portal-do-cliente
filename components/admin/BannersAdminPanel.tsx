"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import {
  Image as ImageIcon,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Upload,
  AlertTriangle,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────────

interface BannerRow {
  id: string;
  storagePath: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  signedUrl?: string; // injected server-side on load
}

interface BannerListResponse {
  success: boolean;
  banners?: BannerRow[];
  error?: string;
}

interface BannerMutateResponse {
  success: boolean;
  banner?: BannerRow;
  error?: string;
  detail?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-light text-white/50 block">{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] font-light text-white/80 placeholder-white/25 focus:outline-none focus:border-vitti-medium/50 transition-colors disabled:opacity-50"
    />
  );
}

// ── Delete Confirm Modal ─────────────────────────────────────────────────────────

function DeleteConfirmModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative bg-[#0d1117] border border-white/[0.08] rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400/70 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-light text-white/80">Excluir banner</p>
            <p className="text-[11px] font-light text-white/50 leading-relaxed">
              Tem certeza que deseja excluir este banner? Essa ação não poderá ser desfeita.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-[10px] font-light px-3 py-2 rounded-lg border border-white/[0.10] text-white/50 hover:text-white/75 transition-all disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 text-[10px] font-light px-3 py-2 rounded-lg border border-red-400/30 text-red-400/70 hover:border-red-400/60 hover:text-red-400/90 transition-all disabled:opacity-40"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Banner Form (create / edit) ──────────────────────────────────────────────────

function BannerForm({
  banner,
  onClose,
  onSaved,
}: {
  banner?: BannerRow;
  onClose: () => void;
  onSaved: (b: BannerRow) => void;
}) {
  const isEdit = Boolean(banner);
  const fileRef = useRef<HTMLInputElement>(null);

  const [linkUrl, setLinkUrl] = useState(banner?.linkUrl ?? "");
  const [sortOrder, setSortOrder] = useState(String(banner?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(banner?.signedUrl ?? null);

  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!isEdit && !selectedFile) {
      setFieldError("Selecione uma imagem para o banner.");
      return;
    }
    setFieldError(null);
    setApiError(null);
    setSubmitting(true);

    const fd = new FormData();
    if (selectedFile) {
      fd.append("file", selectedFile);
      if (isEdit && banner?.storagePath) {
        fd.append("oldStoragePath", banner.storagePath);
      }
    }
    fd.append("linkUrl", linkUrl.trim());
    fd.append("sortOrder", sortOrder);
    fd.append("isActive", String(isActive));

    try {
      const url = isEdit ? `/api/admin/banners/${banner!.id}` : "/api/admin/banners";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, body: fd });
      const json: BannerMutateResponse = await res.json();
      if (!json.success || !json.banner) {
        setApiError(json.error ?? "Erro desconhecido.");
        return;
      }
      setSuccess(true);
      onSaved(json.banner);
    } catch {
      setApiError("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  }, [isEdit, banner, selectedFile, linkUrl, sortOrder, isActive, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={!success ? onClose : undefined} />
      <div className="relative w-full max-w-md h-full bg-[#0d1117] border-l border-white/[0.06] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0d1117]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-vitti-medium/15 border border-vitti-medium/20 flex items-center justify-center">
              <ImageIcon size={11} className="text-vitti-light/50" />
            </div>
            <p className="text-[11px] font-light text-white/80">
              {isEdit ? "Editar banner" : "Novo banner"}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors">
            <X size={13} className="text-white/40" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-5">
          {success ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400/70" />
                <p className="text-sm font-light text-white/80">
                  Banner {isEdit ? "atualizado" : "criado"} com sucesso
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full text-[10px] font-light py-2.5 rounded-xl border border-white/[0.12] text-white/55 hover:text-white/80 hover:border-white/20 transition-all"
              >
                Fechar
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Preview */}
              <div
                className="relative w-full rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.03] aspect-[16/7] flex items-center justify-center cursor-pointer group"
                onClick={() => fileRef.current?.click()}
              >
                {previewUrl ? (
                  <>
                    <Image src={previewUrl} alt="Preview" fill className="object-contain" unoptimized />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <p className="text-[10px] font-light text-white/80">Trocar imagem</p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-white/30">
                    <Upload size={20} />
                    <p className="text-[10px] font-light">Clique para selecionar a imagem</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={submitting}
              />

              <Field label="Link (opcional)">
                <TextInput
                  value={linkUrl}
                  onChange={setLinkUrl}
                  placeholder="https://..."
                  disabled={submitting}
                />
                {linkUrl.trim() && (
                  <p className="text-[8px] font-light text-white/30 mt-0.5">
                    O banner será clicável e abrirá em nova aba.
                  </p>
                )}
              </Field>

              <Field label="Ordem de exibição">
                <TextInput
                  value={sortOrder}
                  onChange={setSortOrder}
                  placeholder="0"
                  type="number"
                  disabled={submitting}
                />
              </Field>

              <Field label="Status">
                <div className="flex gap-2 mt-0.5">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      onClick={() => setIsActive(v)}
                      disabled={submitting}
                      className={`text-[9px] font-light px-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
                        isActive === v
                          ? v
                            ? "border-emerald-400/30 text-emerald-400/70 bg-emerald-400/5"
                            : "border-red-400/25 text-red-400/60 bg-red-400/5"
                          : "border-white/[0.10] text-white/40 hover:border-white/20"
                      }`}
                    >
                      {v ? "Ativo" : "Inativo"}
                    </button>
                  ))}
                </div>
              </Field>

              {(fieldError || apiError) && (
                <div className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2.5">
                  <p className="text-[10px] font-light text-red-400/70">{fieldError ?? apiError}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 text-[10px] font-light py-2.5 rounded-xl border border-vitti-medium/30 text-vitti-light/60 hover:border-vitti-medium/60 hover:text-vitti-light/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    {isEdit ? "Salvando…" : "Criando banner…"}
                  </>
                ) : (
                  <>
                    <ImageIcon size={11} />
                    {isEdit ? "Salvar alterações" : "Criar banner"}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Banner Card ──────────────────────────────────────────────────────────────────

function BannerCard({
  banner,
  onEdit,
  onDelete,
  onToggle,
}: {
  banner: BannerRow;
  onEdit: (b: BannerRow) => void;
  onDelete: (b: BannerRow) => void;
  onToggle: (b: BannerRow) => void;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-black/[0.07] bg-black/[0.02] px-4 py-3">
      {/* Thumbnail */}
      <div className="relative w-24 h-12 rounded-lg overflow-hidden bg-black/[0.02] border border-black/[0.07] shrink-0">
        {banner.signedUrl ? (
          <Image src={banner.signedUrl} alt="Banner" fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={14} className="text-[#5F6368]/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[8px] font-light px-1.5 py-0.5 rounded-full border ${
              banner.isActive
                ? "border-emerald-400/25 text-emerald-400/70 bg-emerald-400/[0.06]"
                : "border-black/[0.08] text-[#5F6368]/55"
            }`}
          >
            {banner.isActive ? "Ativo" : "Inativo"}
          </span>
          <span className="text-[8px] font-light text-[#5F6368]/50">Ordem {banner.sortOrder}</span>
        </div>
        {banner.linkUrl ? (
          <p className="text-[10px] font-light text-[#5F6368]/60 truncate flex items-center gap-1">
            <ExternalLink size={9} className="shrink-0 text-[#5F6368]/40" />
            {banner.linkUrl}
          </p>
        ) : (
          <p className="text-[9px] font-light text-[#5F6368]/40 italic">Sem link</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggle(banner)}
          title={banner.isActive ? "Desativar" : "Ativar"}
          className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors"
        >
          {banner.isActive ? (
            <EyeOff size={12} className="text-[#5F6368]/40 hover:text-[#5F6368]/80" />
          ) : (
            <Eye size={12} className="text-[#5F6368]/40 hover:text-emerald-600/70" />
          )}
        </button>
        <button
          onClick={() => onEdit(banner)}
          title="Editar"
          className="p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors"
        >
          <Pencil size={12} className="text-[#5F6368]/40 hover:text-vitti-medium/70" />
        </button>
        <button
          onClick={() => onDelete(banner)}
          title="Excluir"
          className="p-1.5 rounded-lg hover:bg-red-400/[0.06] transition-colors"
        >
          <Trash2 size={12} className="text-[#5F6368]/40 hover:text-red-500/60" />
        </button>
      </div>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────────────────────

interface Props {
  initialBanners: BannerRow[];
}

export function BannersAdminPanel({ initialBanners }: Props) {
  const [banners, setBanners] = useState<BannerRow[]>(initialBanners);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [deletingBanner, setDeletingBanner] = useState<BannerRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleSaved = useCallback((saved: BannerRow) => {
    setBanners((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...saved, signedUrl: prev[idx].signedUrl };
        return next.sort((a, b) => a.sortOrder - b.sortOrder);
      }
      return [saved, ...prev].sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deletingBanner) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/banners/${deletingBanner.id}`, { method: "DELETE" });
      const json: { success: boolean; error?: string } = await res.json();
      if (!json.success) throw new Error(json.error);
      setBanners((prev) => prev.filter((b) => b.id !== deletingBanner.id));
      setDeletingBanner(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingBanner]);

  const handleToggle = useCallback(async (banner: BannerRow) => {
    setTogglingId(banner.id);
    try {
      const fd = new FormData();
      fd.append("isActive", String(!banner.isActive));
      const res = await fetch(`/api/admin/banners/${banner.id}`, { method: "PATCH", body: fd });
      const json: BannerMutateResponse = await res.json();
      if (json.success && json.banner) {
        setBanners((prev) =>
          prev.map((b) =>
            b.id === banner.id ? { ...json.banner!, signedUrl: b.signedUrl } : b
          )
        );
      }
    } catch {
      // silently ignore
    } finally {
      setTogglingId(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-light text-[#5F6368]/55">
          {banners.length} banner{banners.length !== 1 ? "s" : ""} cadastrado{banners.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-[9px] font-light px-3 py-2 rounded-full border border-emerald-400/20 text-emerald-400/60 hover:border-emerald-400/40 hover:text-emerald-400/80 transition-all"
        >
          <Plus size={10} />
          Novo banner
        </button>
      </div>

      {/* List */}
      {banners.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-14">
          <ImageIcon size={24} className="text-[#5F6368]/25" />
          <p className="text-[11px] font-light text-[#5F6368]/50">Nenhum banner cadastrado.</p>
          <p className="text-[10px] font-light text-[#5F6368]/40">
            O carrossel da Home usará as imagens padrão enquanto não houver banners ativos.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {banners.map((b) => (
            <div key={b.id} className={togglingId === b.id ? "opacity-50 pointer-events-none" : ""}>
              <BannerCard
                banner={b}
                onEdit={setEditing}
                onDelete={setDeletingBanner}
                onToggle={handleToggle}
              />
            </div>
          ))}
        </div>
      )}

      {/* Note */}
      <div className="rounded-xl border border-black/[0.05] bg-black/[0.02] px-4 py-3">
        <p className="text-[9px] font-light text-[#5F6368]/55 leading-relaxed">
          Banners são exibidos na Home do Portal do Parceiro ordenados pelo campo{" "}
          <span className="text-[#5F6368]/70">Ordem</span>. Se não houver banners ativos, o carrossel
          usa as imagens padrão da Vitti.
        </p>
      </div>

      {/* Create drawer */}
      {creating && (
        <BannerForm
          onClose={() => setCreating(false)}
          onSaved={(b) => {
            handleSaved(b);
            setCreating(false);
          }}
        />
      )}

      {/* Edit drawer */}
      {editing && (
        <BannerForm
          banner={editing}
          onClose={() => setEditing(null)}
          onSaved={(b) => {
            handleSaved(b);
            setEditing(null);
          }}
        />
      )}

      {/* Delete confirm */}
      {deletingBanner && (
        <DeleteConfirmModal
          loading={deleteLoading}
          onConfirm={handleDelete}
          onCancel={() => { setDeletingBanner(null); setDeleteError(null); }}
        />
      )}

      {deleteError && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/[0.04] px-3 py-2.5">
          <p className="text-[10px] font-light text-red-400/70">{deleteError}</p>
        </div>
      )}
    </div>
  );
}
