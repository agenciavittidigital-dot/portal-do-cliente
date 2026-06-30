import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";
import type { AdminUserRow } from "@/lib/data/users-admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UserCreateResponse {
  success: boolean;
  profileId?: string;
  authUserCreated?: boolean;
  newUser?: AdminUserRow;
  error?: string;
  detail?: string;
}

// ── Presets de permissões ──────────────────────────────────────────────────────

const ROLE_PRESETS: Record<string, string[]> = {
  admin:   ["view_home", "view_metrics", "view_reports", "view_finance", "view_calls", "view_education"],
  finance: ["view_home", "view_finance", "view_reports"],
  team:    ["view_home", "view_metrics", "view_reports", "view_calls", "view_education"],
  custom:  [],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function errRes(message: string, status: number, detail?: string): Response {
  return NextResponse.json<UserCreateResponse>(
    { success: false, error: message, ...(detail ? { detail } : {}) },
    { status }
  );
}

async function requireAdmin(): Promise<{ ok: true } | { error: Response }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: errRes("Não autenticado.", 401) };
  const ctx = await loadUserContext(user.id);
  if (!ctx.isAdmin) return { error: errRes("Acesso restrito a administradores Vitti.", 403) };
  return { ok: true };
}

// ── POST /api/admin/users ─────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errRes("Body inválido.", 400);
  }

  const b = body as Record<string, unknown>;

  // ── Validação de campos ────────────────────────────────────────────────────
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return errRes("Nome é obrigatório.", 400);

  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errRes("E-mail inválido.", 400);
  }

  const password = typeof b.password === "string" ? b.password.trim() : "";
  if (!password || password.length < 8) {
    return errRes("A senha deve ter no mínimo 8 caracteres.", 400);
  }

  // clientIds[] tem precedência; clientId singular mantém backward compat
  let clientIds: string[] = [];
  if (Array.isArray(b.clientIds)) {
    clientIds = (b.clientIds as unknown[])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
  } else if (typeof b.clientId === "string" && b.clientId.trim()) {
    clientIds = [b.clientId.trim()];
  }

  const globalRole: "client_user" | "vitti_admin" =
    b.globalRole === "vitti_admin" ? "vitti_admin" : "client_user";

  const role =
    typeof b.role === "string" && ["admin", "finance", "team", "custom"].includes(b.role)
      ? b.role
      : "team";

  const status: "active" | "inactive" = b.status === "inactive" ? "inactive" : "active";

  if (globalRole !== "vitti_admin" && clientIds.length === 0) {
    return errRes("Selecione ao menos um portal para o usuário.", 400);
  }

  const admin = createAdminClient();

  // ── Verificar portais solicitados ─────────────────────────────────────────
  const clientNameById = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clientRows } = await admin
      .from("clients")
      .select("id, name")
      .in("id", clientIds);
    for (const c of clientRows ?? []) {
      clientNameById.set(String(c.id), String(c.name ?? ""));
    }
    const missing = clientIds.filter((cid) => !clientNameById.has(cid));
    if (missing.length > 0) {
      return errRes(`Portal(is) não encontrado(s): ${missing.join(", ")}`, 404);
    }
  }
  const primaryClientId = clientIds[0] ?? null;
  const primaryClientName = primaryClientId ? (clientNameById.get(primaryClientId) ?? null) : null;

  // ── Verificar se já existe profile com este email ──────────────────────────
  const { data: profilesByEmail } = await admin
    .from("profiles")
    .select("id, auth_user_id, name, status, global_role")
    .eq("email", email);

  const existingProfile = profilesByEmail?.[0] ?? null;

  let profileId: string;
  let authUserId: string;
  let authUserCreated = false;

  if (existingProfile) {
    // Profile já existe — verificar vínculo
    profileId = String(existingProfile.id);
    authUserId = String(existingProfile.auth_user_id ?? "");

    if (clientIds.length > 0) {
      const { data: existingLinks } = await admin
        .from("client_users")
        .select("client_id")
        .eq("profile_id", profileId)
        .in("client_id", clientIds);
      if (existingLinks && existingLinks.length > 0) {
        const names = existingLinks
          .map((r) => clientNameById.get(String(r.client_id)) ?? String(r.client_id))
          .join(", ");
        return errRes(`Usuário já vinculado ao(s) portal(is): ${names}`, 409);
      }
    }
    // Profile já existe → adicionar novos vínculos sem remover os existentes
  } else {
    // ── Criar usuário no Supabase Auth ─────────────────────────────────────
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError || !authData?.user) {
      console.error("[createUser] Erro no Auth:", authError?.message ?? "sem dado");
      return errRes("Erro ao criar usuário no Auth.", 500, authError?.message);
    }

    authUserId = authData.user.id;
    authUserCreated = true;

    // ── Criar profile (idempotente: trigger pode ter criado) ───────────────
    const { data: newProfile, error: profileError } = await admin
      .from("profiles")
      .insert({ auth_user_id: authUserId, name, email, global_role: globalRole, status })
      .select("id")
      .maybeSingle();

    if (profileError) {
      if (profileError.code === "23505") {
        // Trigger criou o profile — buscar e atualizar
        const { data: triggered } = await admin
          .from("profiles")
          .select("id")
          .eq("auth_user_id", authUserId)
          .maybeSingle();

        if (!triggered) {
          await admin.auth.admin.deleteUser(authUserId).catch(() => {});
          return errRes("Erro ao criar perfil.", 500, profileError.message);
        }

        profileId = String(triggered.id);
        await admin
          .from("profiles")
          .update({ name, global_role: "client_user", status })
          .eq("id", profileId);
      } else {
        await admin.auth.admin.deleteUser(authUserId).catch(() => {});
        return errRes("Erro ao criar perfil.", 500, profileError.message);
      }
    } else if (newProfile) {
      profileId = String(newProfile.id);
    } else {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
      return errRes("Erro ao criar perfil.", 500, "Sem retorno do banco.");
    }
  }

  // ── Criar vínculos client_users (um por portal) ───────────────────────────
  const createdClientUserIds: string[] = [];
  for (const cid of clientIds) {
    const { data: cuRow, error: cuError } = await admin
      .from("client_users")
      .insert({ profile_id: profileId, client_id: cid, role })
      .select("id")
      .single();

    if (cuError || !cuRow) {
      console.error("[createUser] Erro ao criar client_users:", cuError?.message);
      if (createdClientUserIds.length > 0) {
        await admin.from("client_users").delete().in("id", createdClientUserIds).then(() => {}, () => {});
      }
      if (authUserCreated) {
        await admin.auth.admin.deleteUser(authUserId).catch(() => {});
        await admin.from("profiles").delete().eq("id", profileId).then(() => {}, () => {});
      }
      return errRes("Erro ao vincular portal.", 500, cuError?.message);
    }
    createdClientUserIds.push(String(cuRow.id));
  }

  // ── Aplicar preset de permissões (um por portal) ──────────────────────────
  let permissionCount = 0;
  const presetKeys = ROLE_PRESETS[role] ?? [];

  if (presetKeys.length > 0 && createdClientUserIds.length > 0) {
    const { data: permRows } = await admin
      .from("permissions")
      .select("id")
      .in("key", presetKeys);

    if (permRows && permRows.length > 0) {
      const permsToInsert = createdClientUserIds.flatMap((cuid) =>
        permRows.map((p) => ({ client_user_id: cuid, permission_id: String(p.id) }))
      );
      await admin.from("user_permissions").insert(permsToInsert);
      permissionCount = permRows.length;
    }
  }

  // ── Montar retorno ─────────────────────────────────────────────────────────
  const newUser: AdminUserRow = {
    id: profileId,
    authUserId,
    name,
    email,
    globalRole,
    status,
    clientId: primaryClientId,
    clientName: primaryClientName,
    clientUserRole: clientIds.length > 0 ? role : null,
    permissionCount,
    portalCount: clientIds.length,
  };

  return NextResponse.json<UserCreateResponse>(
    { success: true, profileId, authUserCreated, newUser },
    { status: 201 }
  );
}
