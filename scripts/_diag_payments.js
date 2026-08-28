// Diagnóstico read-only — pagamentos e estrutura financeira
// Somente SELECT. Nenhuma alteração em banco, storage ou policies.

const { createClient } = require("../node_modules/@supabase/supabase-js/dist/index.cjs");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente no .env.local");
if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente no .env.local");

const supabase = createClient(url, key, { auth: { persistSession: false } });

function sep(title) {
  console.log("\n" + "=".repeat(60));
  console.log("  " + title);
  console.log("=".repeat(60));
}

async function main() {
  console.log("Diagnostico read-only iniciado.");

  sep("1. AMOSTRA DE 1 REGISTRO: payments");
  {
    const { data, error } = await supabase.from("payments").select("*").limit(1);
    if (error) {
      console.log("  Erro ao acessar payments:", error.message);
    } else if (!data || data.length === 0) {
      console.log("  Tabela payments existe mas esta vazia.");
      console.log("  Colunas mapeadas em lib/data/invoices-client.ts:");
      console.log("    id, client_id, title, description, reference_month,");
      console.log("    amount, currency, due_date, paid_at, status,");
      console.log("    payment_method, boleto_file_path, boleto_url,");
      console.log("    barcode, digitable_line, pix_code,");
      console.log("    receipt_file_path, receipt_url, created_at");
    } else {
      console.log("  Colunas e valores do primeiro registro:");
      for (const col of Object.keys(data[0])) {
        const val = data[0][col];
        const display =
          val === null
            ? "NULL"
            : typeof val === "string" && val.length > 60
            ? val.slice(0, 60) + "..."
            : String(val);
        console.log("    " + col + ": " + display);
      }
    }
  }

  sep("2. CONTAGEM DE REGISTROS: payments");
  {
    const { count, error } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log("  Erro:", error.message);
    } else {
      console.log("  Total de registros em payments: " + count);
    }
  }

  sep("3. AMOSTRA DE 1 REGISTRO: invoices");
  {
    const { data, error } = await supabase.from("invoices").select("*").limit(1);
    if (error) {
      console.log("  Erro ao acessar invoices:", error.message);
    } else if (!data || data.length === 0) {
      console.log("  invoices existe mas esta vazia.");
    } else {
      console.log("  Colunas detectadas:");
      for (const col of Object.keys(data[0])) {
        console.log("    - " + col + " (" + typeof data[0][col] + ")");
      }
    }
  }

  sep("4. RLS POLICIES: payments");
  {
    const { data, error } = await supabase
      .from("pg_policies")
      .select("policyname, cmd, roles, qual, with_check")
      .eq("tablename", "payments")
      .eq("schemaname", "public");
    if (error) {
      console.log("  pg_policies nao acessivel via PostgREST:", error.message);
    } else if (!data || data.length === 0) {
      console.log("  Nenhuma policy RLS encontrada para payments.");
    } else {
      for (const p of data) {
        console.log(JSON.stringify(p, null, 2));
      }
    }
  }

  sep("5. RLS POLICIES: invoices");
  {
    const { data, error } = await supabase
      .from("pg_policies")
      .select("policyname, cmd, roles, qual, with_check")
      .eq("tablename", "invoices")
      .eq("schemaname", "public");
    if (error) {
      console.log("  pg_policies nao acessivel:", error.message);
    } else if (!data || data.length === 0) {
      console.log("  Nenhuma policy RLS encontrada para invoices.");
    } else {
      for (const p of data) {
        console.log(JSON.stringify(p, null, 2));
      }
    }
  }

  sep("6. STORAGE BUCKETS");
  {
    const { data: buckets, error: bucketsError } =
      await supabase.storage.listBuckets();
    if (bucketsError) {
      console.log("  Erro:", bucketsError.message);
    } else if (!buckets || buckets.length === 0) {
      console.log("  Nenhum bucket encontrado.");
    } else {
      for (const b of buckets) {
        console.log(
          "  bucket: " + b.name +
          " | public: " + b.public +
          " | created: " + b.created_at
        );
      }
    }
  }

  sep("7. STORAGE: pasta clients/ em portal-files");
  {
    const { data: files, error: filesError } = await supabase.storage
      .from("portal-files")
      .list("clients", { limit: 10, offset: 0 });
    if (filesError) {
      console.log("  Erro:", filesError.message);
    } else if (!files || files.length === 0) {
      console.log("  Pasta clients/ vazia ou inexistente.");
    } else {
      for (const f of files) {
        console.log("  " + f.name + "/");
      }
    }
  }

  sep("8. TABELA: payment_events");
  {
    const { count, error } = await supabase
      .from("payment_events")
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log("  payment_events: " + error.message);
    } else {
      console.log("  payment_events existe. Registros: " + count);
    }
  }

  console.log("\nDiagnostico concluido. Nenhuma alteracao foi feita.");
}

main().catch((err) => {
  console.error("Erro fatal no diagnostico:", err.message);
  process.exit(1);
});
