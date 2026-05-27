import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadUserContext } from "@/lib/data/user-context";
import type { AdminUserRow } from "@/lib/data/users-admin";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UserCreateResponse {
  success: boolean;
  profileId?: string;
  authUserCreated?: boolean;
  tempPassword?: string;
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

function generateTempPassword(): string {
  const upper   = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower   = "abcdefghjkmnpqrstuvwxyz";
  const digits  = "23456789";
  const symbols = "@#$!";
  const pool    = upper + lower + digits + symbols;

  const raw = randomBytes(16);
  const chars: string[] = [
    upper[raw[0] % upper.length],
    upper[raw[1] % upper.length],
    lower[raw[2] % lower.length],
    lower[raw[3] % lower.length],
    digits[raw[4] % digits.length],
    digits[raw[5] % digits.length],
    symbols[raw[6] % symbols.length],
    pool[raw[7] % pool.length],
    pool[raw[8] % pool.length],
    pool[raw[9] % pool.length],
    pool[raw[10] % pool.length],
    pool[raw[11] % pool.length],
  ];

  // Fisher-Yates shuffle usando bytes adicionais
  const shuffle = randomBytes(12);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffle[i % shuffle.length] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

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

  const clientId = typeof b.clientId === "string" ? b.clientId.trim() : "";
  if (!clientId) return errRes("Selecione um cliente.", 400);

  const role =
    typeof b.role === "string" && ["admin", "finance", "team", "custom"].includes(b.role)
      ? b.role
      : "team";

  const status: "active" | "inactive" = b.status === "inactive" ? "inactive" : "active";

  const admin = createAdminClient();

  // ── Verificar cliente ──────────────────────────────────────────────────────
  const { data: clientRow } = await admin
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();

  if (!clientRow) return errRes("Cliente não encontrado.", 404);
  const clientName = String(clientRow.name ?? "");

  // ── Verificar se já existe profile com este email ──────────────────────────
  const { data: profilesByEmail } = await admin
    .from("profiles")
    .select("id, auth_user_id, name, status, global_role")
    .eq("email", email);

  const existingProfile = profilesByEmail?.[0] ?? null;

  let profileId: string;
  let authUserId: string;
  let authUserCreated = false;
  let tempPassword: string | undefined;

  if (existingProfile) {
    // Profile já existe — verificar vínculo
    profileId = String(existingProfile.id);
    authUserId = String(existingProfile.auth_user_id ?? "");

    const { data: existingLink } = await admin
      .from("client_users")
      .select("id, client_id")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (existingLink) {
      if (String(existingLink.client_id) === clientId) {
        return errRes("Este usuário já está vinculado a este cliente.", 409);
      }
      return errRes(
        "Este e-mail já está vinculado a outro cliente. Edite o usuário existente para alterar o vínculo.",
        409
      );
    }
    // Profile sem vínculo → criar apenas client_users + permissões
  } else {
    // ── Criar usuário no Supabase Auth ─────────────────────────────────────
    const tmpPwd = generateTempPassword();

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tmpPwd,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authError || !authData?.user) {
      console.error("[createUser] Erro no Auth:", authError?.message ?? "sem dado");
      return errRes("Erro ao criar usuário no Auth.", 500, authError?.message);
    }

    authUserId = authData.user.id;
    tempPassword = tmpPwd;
    authUserCreated = true;

    // ── Criar profile (idempotente: trigger pode ter criado) ───────────────
    const { data: newProfile, error: profileError } = await admin
      .from("profiles")
      .insert({ auth_user_id: authUserId, name, email, global_role: "client_user", status })
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

  // ── Criar vínculo client_users ─────────────────────────────────────────────
  const { data: clientUserRow, error: clientUserError } = await admin
    .from("client_users")
    .insert({ profile_id: profileId, client_id: clientId, role })
    .select("id")
    .single();

  if (clientUserError || !clientUserRow) {
    console.error("[createUser] Erro ao criar client_users:", clientUserError?.message);
    if (authUserCreated) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
      await admin.from("profiles").delete().eq("id", profileId).then(() => {}, () => {});
    }
    return errRes("Erro ao vincular cliente.", 500, clientUserError?.message);
  }

  const clientUserId = String(clientUserRow.id);

  // ── Aplicar preset de permissões ───────────────────────────────────────────
  let permissionCount = 0;
  const presetKeys = ROLE_PRESETS[role] ?? [];

  if (presetKeys.length > 0) {
    const { data: permRows } = await admin
      .from("permissions")
      .select("id")
      .in("key", presetKeys);

    if (permRows && permRows.length > 0) {
      await admin.from("user_permissions").insert(
        permRows.map((p) => ({ client_user_id: clientUserId, permission_id: String(p.id) }))
      );
      permissionCount = permRows.length;
    }
  }

  // ── Montar retorno ─────────────────────────────────────────────────────────
  const newUser: AdminUserRow = {
    id: profileId,
    authUserId,
    name,
    email,
    globalRole: "client_user",
    status,
    clientId,
    clientName,
    clientUserRole: role,
    permissionCount,
  };

  return NextResponse.json<UserCreateResponse>(
    { success: true, profileId, authUserCreated, tempPassword, newUser },
    { status: 201 }
  );
}
