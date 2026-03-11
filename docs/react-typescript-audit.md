# React + TypeScript Audit (12-point review)

Date: 2026-03-11  
Scope: `src/**`, `supabase/functions/**`, and project tooling in root

## Executive summary

- The main quality risks are concentrated in three areas: **TypeScript safety** (`any` sprawl), **large multi-responsibility page components**, and **very limited automated tests**.
- Current lint status is poor (197 findings, 186 errors), with `@typescript-eslint/no-explicit-any` accounting for 179 findings.
- The fastest path to stability is:
  1. Type-hardening dashboard/payment/expense modules.
  2. Breaking large pages into feature containers + presentational components.
  3. Expanding tests from the current smoke test to behavior-first integration tests.

---

## Checks run

- `npm run lint` → failed (`197` findings: `186` errors, `11` warnings).
- `npm test -- --run` → passed (`1` test), but logs warnings (`act(...)` and React Router future flags).
- `npx eslint . -f json -o /tmp/eslint-report.json` + node summary script.
- `find src -type f \( -name '*.tsx' -o -name '*.ts' \) -print0 | xargs -0 wc -l | sort -nr | head -n 20`.
- `rg -n "size=\"icon\"|<button|onClick=\{.*\}" src/pages src/components | head -n 80`.

---

## 1) DRY (Don’t Repeat Yourself)

### Findings
- Repeated date-navigation controls (previous/next month icon buttons) appear in multiple pages (`Expenses`, `Payments`, `Inventory`) with nearly identical logic/UI.
- Repeated destructive-action patterns (`AlertDialog` + delete mutation + duplicate confirmation copy) appear across `Payments`, `ShoppingLists`, `RecurringExpenses`, and `Inventory`.
- Repeated Supabase mutation error toast patterns are embedded inline across multiple page components.

### Suggestions
- Create shared `MonthNavigator` component (props: `currentDate`, `onPrev`, `onNext`, `label`).
- Extract generic `ConfirmDestructiveActionDialog` with standardized CTA copy/states.
- Add `useMutationToast` helper to centralize success/error messaging.

## 2) Eliminate unused/dead code

### Findings
- The codebase contains demo-oriented routes/components (`SidebarDemoPage`, `BackgroundPathsDemoPage`, `components/ui/demo*`) that may be non-essential in production paths.
- Lint findings are dominated by typing, so unused-code detection is currently underpowered (rules like `no-unused-vars` are not the main failing signal).

### Suggestions
- Decide if demo pages are production requirements; if not, gate or remove them.
- Add a dead-export pass (e.g., `ts-prune`) and remove unused exports/components.
- Add stricter lint for unused imports/locals if not already enforced through TypeScript compiler options.

## 3) Consistent TypeScript usage

### Findings
- `@typescript-eslint/no-explicit-any`: **179 findings** (top lint offender).
- `supabase/functions/generate-report/index.ts` uses `@ts-nocheck`, bypassing type safety.
- `@typescript-eslint/no-empty-object-type` appears in UI primitives (`command.tsx`, `textarea.tsx`), indicating weak or placeholder type modeling.

### Suggestions
- Prioritize replacing `any` in high-churn files first (`CardsTab`, `AdminTab`, `Payments`, `RecurringExpenses`, edge functions).
- Remove `@ts-nocheck` incrementally by typing input/output contracts and utility functions.
- Standardize object shapes with explicit interfaces/types from `src/integrations/supabase/types.ts` instead of ad hoc `any`.

## 4) Well-structured components

### Findings
- Several components exceed 250 LOC and mix fetching, transformation, and presentation:
  - `src/pages/Expenses.tsx` (1062)
  - `src/components/dashboard/CardsTab.tsx` (647)
  - `src/pages/GroupSettings.tsx` (624)
  - `src/pages/Dashboard.tsx` (570)
  - `src/pages/Payments.tsx` (564)
  - `src/components/dashboard/AdminTab.tsx` (519)
- Large files increase cognitive load and make regression testing harder.

### Suggestions
- Split by responsibility:
  - `*.container.tsx` for orchestration/data hooks.
  - `*.view.tsx` for pure rendering.
  - `*.selectors.ts` for computed data.
- Set an internal soft limit (e.g., 250 LOC for component modules) to trigger refactor review.

## 5) Efficient state management

### Findings
- Dashboard-area tabs carry many props and handlers, a sign of prop-heavy orchestration.
- Some state appears duplicated between parent/page scope and nested dialogs/tabs.

### Suggestions
- Introduce feature-scoped contexts only where state is truly cross-tab (e.g., shared payment dialog state).
- Keep ephemeral form state local to dialog-level components.
- Prefer derived state via memoized selectors over storing duplicated derived values.

## 6) Proper React hooks usage

### Findings
- `react-hooks/exhaustive-deps` warnings exist in:
  - `src/contexts/AuthContext.tsx`
  - `src/pages/AcceptInvite.tsx`
- Current test output also shows `act(...)` warnings, suggesting async state updates in tests are not fully synchronized.

### Suggestions
- Resolve exhaustive-deps warnings by stabilizing callbacks (`useCallback`) or moving effect logic to custom hooks.
- Update tests to await async updates (`findBy*`, `waitFor`, explicit `act`) to remove warning noise and avoid false positives.

## 7) Separation of logic and presentation

### Findings
- Business rules and data access remain embedded in page modules (`Expenses`, `Payments`, `Dashboard`, `GroupSettings`).
- Rendering and mutation logic are tightly coupled, reducing reuse and testability.

### Suggestions
- Introduce a feature service layer (e.g., `src/features/payments/api.ts`) for Supabase interactions.
- Keep UI components data-agnostic where possible; pass normalized view models.

## 8) Proper error handling

### Findings
- Error handling is inconsistent: many operations rely on inline toasts without shared normalization.
- No explicit app-level React Error Boundary is present around the routed application shell.

### Suggestions
- Add global `ErrorBoundary` around route rendering with actionable fallback.
- Create `normalizeAppError(error: unknown)` to convert API/runtime errors into consistent user feedback.
- Standardize mutation/query wrappers that always map technical errors to UX-safe messages.

## 9) Performance and optimizations

### Findings
- Large pages likely recompute substantial derived data in render paths.
- Frequent inline callback creation in dense trees (tables/lists/cards) can increase render churn.
- Potentially large lists (expenses/members/inventory) are rendered directly, without virtualization.

### Suggestions
- Move expensive transforms to memoized selectors (`useMemo`) and pure utility modules.
- Memoize row/card components where prop identity is stable.
- Add virtualization for very large datasets (or paginate/incrementally load where UX allows).

## 10) Project organization and structure

### Findings
- Current structure is mostly technical-layer based (`pages`, `components`, `hooks`) while domain complexity is high.
- Dashboard-related logic is split across `pages` and `components/dashboard`, making boundaries less explicit.

### Suggestions
- Move toward feature-first organization for complex domains:
  - `src/features/dashboard/*`
  - `src/features/expenses/*`
  - `src/features/payments/*`
- Keep `components/ui/*` strictly generic; move domain-specific UI near its feature.

## 11) Accessibility (a11y)

### Findings
- Multiple icon-only action buttons exist; some use `title` but do not consistently expose accessible names (`aria-label`).
- Some clickable UI elements use non-semantic interactive elements (e.g., `Badge` with `onClick` in `Inventory`) which may be keyboard-inaccessible.

### Suggestions
- Enforce explicit `aria-label` on icon-only buttons.
- Replace clickable non-button elements with semantic `<button>` or add full keyboard/role support.
- Add `eslint-plugin-jsx-a11y` checks and key flow tests for keyboard navigation.

## 12) Adequate testing

### Findings
- Test suite currently has one smoke test (`src/test/example.test.tsx`) and lacks feature behavior coverage.
- Critical flows (auth, invite acceptance, expenses, payments) are not protected by integration/e2e tests.

### Suggestions (priority)
1. Add integration tests (RTL + MSW) for invite acceptance, expense CRUD, and payment status transitions.
2. Extract and unit-test pure selectors/formatters from large pages.
3. Add e2e smoke coverage (Playwright) for login → dashboard → core CRUD happy paths.

---

## Prioritized remediation backlog

1. **Type Safety Sprint**: reduce `any` in `CardsTab`, `AdminTab`, `Payments`, and edge functions.
2. **Decomposition Sprint**: split `Expenses`, `Dashboard`, and `GroupSettings` into container/view + feature modules.
3. **Reliability Sprint**: add Error Boundary + unified error normalization.
4. **Testing Sprint**: move from smoke-only to behavior-first integration tests.
5. **A11y Sprint**: audit icon buttons and clickable non-semantic elements.
