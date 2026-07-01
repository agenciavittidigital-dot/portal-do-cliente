"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, User, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateProfileName, updateAvatarPath } from "@/app/actions/configuracoes";
import type { ActionState } from "@/app/actions/configuracoes";

const INITIAL: ActionState = { error: null, success: false };

interface PerfilFormProps {
  authUserId: string;
  initialName: string;
  initialEmail: string;
  initialAvatarUrl: string | null;
  currentAvatarPath: string | null;
}

export function PerfilForm({
  authUserId,
  initialName,
  initialEmail,
  initialAvatarUrl,
  currentAvatarPath,
}: PerfilFormProps) {
  const [nameState, nameAction, namePending] = useActionState(updateProfileName, INITIAL);

  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarPending, startAvatarTransition] = useTransition();
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setAvatarError("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Imagem muito grande. Máximo 5 MB.");
      return;
    }

    setAvatarError(null);
    setAvatarSuccess(false);

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${authUserId}/avatar.${ext}`;

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    startAvatarTransition(async () => {
      const supabase = createClient();

      // Remove avatar anterior se existia com extensão diferente
      if (currentAvatarPath && currentAvatarPath !== path) {
        await supabase.storage.from("avatars").remove([currentAvatarPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setAvatarError("Erro ao enviar imagem. Tente novamente.");
        setPreviewUrl(initialAvatarUrl);
        return;
      }

      const result = await updateAvatarPath(path);
      if (result.error) {
        setAvatarError(result.error);
        setPreviewUrl(initialAvatarUrl);
        return;
      }

      setAvatarSuccess(true);
    });
  }

  async function handleRemoveAvatar() {
    if (!currentAvatarPath && !previewUrl) return;
    setAvatarError(null);
    setAvatarSuccess(false);

    startAvatarTransition(async () => {
      if (currentAvatarPath) {
        const supabase = createClient();
        await supabase.storage.from("avatars").remove([currentAvatarPath]);
      }
      const result = await updateAvatarPath(null);
      if (result.error) {
        setAvatarError(result.error);
        return;
      }
      setPreviewUrl(null);
      setAvatarSuccess(true);
    });
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-vitti-fg">Perfil</h2>
        <p className="text-sm text-vitti-fg-muted mt-0.5">
          Gerencie seu nome e foto de perfil
        </p>
      </div>

      {/* Card: Avatar */}
      <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6">
        <p className="text-sm font-medium text-vitti-fg mb-4">Foto de perfil</p>

        <div className="flex items-center gap-5">
          {/* Avatar preview */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200/80 flex items-center justify-center shadow-sm">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Avatar"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <User size={28} className="text-vitti-blue/30" />
              )}
            </div>

            {/* Loading overlay */}
            {avatarPending && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <Loader2 size={16} className="text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={avatarPending}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-vitti-fg hover:border-vitti-blue/40 hover:text-vitti-blue transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera size={13} />
              {previewUrl ? "Alterar foto" : "Enviar foto"}
            </button>

            {previewUrl && (
              <button
                type="button"
                disabled={avatarPending}
                onClick={handleRemoveAvatar}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 text-xs font-light text-red-400 hover:border-red-300 hover:text-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={12} />
                Remover foto
              </button>
            )}

            <p className="text-[10px] text-vitti-fg-muted font-light">
              JPG, PNG ou WebP — máx. 5 MB
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {avatarError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-500">
            <AlertCircle size={12} />
            {avatarError}
          </div>
        )}
        {avatarSuccess && !avatarError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600">
            <CheckCircle2 size={12} />
            Foto atualizada com sucesso.
          </div>
        )}
      </div>

      {/* Card: Nome */}
      <form action={nameAction}>
        <div className="rounded-2xl border border-white bg-white/60 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 space-y-4">
          <p className="text-sm font-medium text-vitti-fg">Informações pessoais</p>

          {/* E-mail (somente leitura) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-vitti-fg-muted uppercase tracking-wide">
              E-mail
            </label>
            <input
              type="text"
              readOnly
              value={initialEmail}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-vitti-fg-muted cursor-default select-all"
            />
            <p className="text-[10px] text-vitti-fg-muted/60 font-light">
              O e-mail não pode ser alterado.
            </p>
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <label
              htmlFor="name"
              className="text-[11px] font-medium text-vitti-fg-muted uppercase tracking-wide"
            >
              Nome
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={initialName}
              placeholder="Seu nome completo"
              maxLength={100}
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-vitti-fg placeholder:text-vitti-fg-muted/40 focus:outline-none focus:ring-2 focus:ring-vitti-blue/20 focus:border-vitti-blue/50 transition-all"
            />
          </div>

          {/* Feedback */}
          {nameState.error && (
            <div className="flex items-center gap-2 text-xs text-red-500">
              <AlertCircle size={12} />
              {nameState.error}
            </div>
          )}
          {nameState.success && !nameState.error && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle2 size={12} />
              Nome atualizado com sucesso.
            </div>
          )}

          <button
            type="submit"
            disabled={namePending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-vitti-blue text-white text-sm font-medium hover:bg-vitti-blue/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {namePending && <Loader2 size={13} className="animate-spin" />}
            Salvar nome
          </button>
        </div>
      </form>
    </div>
  );
}
