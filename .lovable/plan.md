

## Plano: Aplicar todos os efeitos visuais da landing em todas as páginas internas

### Problema identificado

O componente `ScrollReveal` foi criado mas **nunca usado** em nenhuma página. Além disso, várias páginas internas não usam `PageHero` e não têm nenhuma animação de entrada. Os efeitos decorativos de fundo (gradientes radiais, formas com blur) da referência também estão ausentes das páginas internas.

### O que será feito

**1. Adicionar PageHero nas páginas que não o utilizam**

Páginas que precisam receber o `PageHero` com `TextEffect` e `AnimatedGroup`:
- `Expenses.tsx` — "Despesas"
- `Payments.tsx` — "Pagamentos"
- `Bulletin.tsx` — "Mural"
- `HouseRules.tsx` — "Regras da Casa"
- `Inventory.tsx` — "Estoque"
- `ShoppingLists.tsx` — "Compras"
- `Invites.tsx` — "Convites"
- `RecurringExpenses.tsx` — "Recorrências"
- `Profile.tsx` — "Meu Perfil"

**2. Envolver o conteúdo principal de cada página com `ScrollReveal`/`ScrollRevealGroup`**

Cada seção de conteúdo (cards, listas, tabelas, grids) será envolvida com `ScrollRevealGroup` para que os elementos apareçam com animação blur-slide conforme o usuário rola a página. Isso vale para **todas** as páginas listadas acima e também para as que já usam PageHero (Members, Polls, AuditLog, PersonalDashboard, GroupSettings, Dashboard).

**3. Adicionar formas decorativas de fundo no layout**

Inspirado na referência, adicionar ao `AppLayout.tsx` (na área `<main>`) os elementos decorativos com gradientes radiais e blur, semelhantes aos da landing:

```text
┌──────────────────────────────────┐
│  Header (já tem blur ao scroll) │
├────────┬─────────────────────────┤
│Sidebar │  ◌ gradiente radial     │
│        │  ◌ formas com blur      │
│        │  ◌ conteúdo com         │
│        │    ScrollReveal          │
│        │                         │
└────────┴─────────────────────────┘
```

### Detalhes técnicos

- Cada página receberá `import { ScrollReveal, ScrollRevealGroup } from "@/components/ui/scroll-reveal"` e `import { PageHero } from "@/components/layout/PageHero"`
- Os cards/seções de conteúdo serão envoltos em `<ScrollRevealGroup preset="blur-slide">` com stagger
- Elementos individuais grandes (como dialogs de formulário) usarão `<ScrollReveal>`
- Background decorativo será adicionado como `div` com `pointer-events-none absolute` no `AppLayout.tsx`, usando gradientes radiais translúcidos similares aos da referência
- Total de arquivos editados: ~14 (9 páginas + Dashboard + AppLayout + possivelmente ajustes menores)

