\# Portal do Cliente Vitti



\## Visão geral



Este projeto é o Portal do Cliente da Vitti Digital.



O objetivo é criar uma plataforma web premium, moderna e segura para clientes acompanharem:



\- dados e métricas de performance;

\- relatórios;

\- financeiro;

\- notas fiscais;

\- boletos/pagamentos;

\- calls;

\- comunicados;

\- educação futura.



O projeto deve ser desenvolvido em etapas, sem tentar construir tudo de uma vez.



\---



\## Stack principal



\- Next.js com App Router

\- TypeScript

\- Tailwind CSS

\- Supabase

\- Supabase Auth

\- Supabase Storage

\- Recharts

\- Lucide React

\- Framer Motion



\---



\## Identidade visual



Usar estética premium dark, moderna, minimalista e tecnológica.



Cores principais:



\- Preto: `#000000`

\- Azul escuro: `#171F38`

\- Azul médio: `#455CAB`

\- Azul claro: `#638ACC`

\- Branco: `#FFFFFF`



Fonte visual desejada:



\- fina;

\- elegante;

\- moderna;

\- com sensação premium.



Evitar visual genérico de dashboard gratuito.



\---



\## Estrutura do produto



O portal terá duas experiências principais:



\### Cliente



Áreas principais:



\- Home

\- Dados e Métricas

\- Relatórios

\- Financeiro

\- Notas Fiscais

\- Calls

\- Educação



\### Admin Vitti



Áreas principais:



\- Clientes

\- Usuários

\- Permissões

\- Dashboards

\- Métricas

\- Integrações

\- Relatórios

\- Financeiro

\- Calls

\- Comunicados

\- Logs



\---



\## Supabase



O Supabase já foi configurado e validado.



As fases aplicadas no banco foram:



\### Fase 1 — Núcleo



\- `clients`

\- `profiles`

\- `client\_users`

\- `permissions`

\- `user\_permissions`



\### Fase 2 — Dashboards configuráveis



\- `client\_dashboards`

\- `dashboard\_blocks`

\- `metric\_catalog`

\- `dashboard\_block\_metrics`



\### Fase 3 — Windsor e performance



\- `client\_integrations`

\- `sync\_jobs`

\- `performance\_daily`

\- `creative\_assets`



\### Fase 4 — Módulos operacionais



\- `reports`

\- `payments`

\- `invoices`

\- `payment\_events`

\- `calls`

\- `announcements`

\- `education\_items`

\- `activity\_logs`

S

RLS e policies já foram aplicadas.



\---



\## Variáveis de ambiente



O projeto usa `.env.local` com:



```env

NEXT\_PUBLIC\_SUPABASE\_URL=

NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=

SUPABASE\_SERVICE\_ROLE\_KEY=

WINDSOR\_API\_KEY=

