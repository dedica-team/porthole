# Session Overview View — Implementation Plan

## Goal

Replace the current default session route (`/session/:id/map`) with a new **Overview** view (`/session/:id`) that surfaces key session health at a glance: quality metrics, bus matrix, chore progress, and active processes.

---

## 1. New Route

- Add `<Route index element={<SessionOverviewView />} />` under `/session/:id` in `App.tsx`.
- Remove the current redirect from index → `map`; the index route becomes the Overview.
- The existing `map`, `processes`, `editor`, `metrics`, `matrix`, `chores`, `greenkeeping` sub-routes remain unchanged.

---

## 2. New Component: `SessionOverviewView`

**File:** `client/src/pages/MapPage/SessionOverviewView.tsx`

A read-only dashboard composed of four summary cards/panels. No canvas is mounted.

### 2.1 Quality Metrics Summary Card

- Source: reuse data/logic from `MetricsView`.
- Display: compact table or bar chart showing per-group metric averages.
- Link: "View full metrics →" navigates to `/session/:id/metrics`.

### 2.2 Bus Matrix Summary Card

- Source: reuse data/logic from `CollaboratorMatrixView`.
- Display: mini heat-map or top-N highest/lowest coverage cells.
- Link: "View full matrix →" navigates to `/session/:id/matrix`.

### 2.3 Chore Progress Card

- Source: reuse data/logic from `ChoreListsView`.
- Display: per-list progress bars (completed / total chores).
- Link: "View all chores →" navigates to `/session/:id/chores`.

### 2.4 Processes Card

- Source: reuse data from process store (`useProcessStore`).
- Display: count of processes, list of process names with step counts.
- Link: "View in X-Ray →" navigates to `/session/:id/processes`.

---

## 3. Layout

- Two-column grid on wide screens, single column on narrow screens (Tailwind `grid grid-cols-1 md:grid-cols-2 gap-4`).
- Each card: rounded border, subtle background, header with title + "View full →" link, scrollable body capped at a fixed height.
- Consistent with existing Tailwind + shadcn/ui styling used across the app.

---

## 4. Navbar Changes

- Add an **Overview** tab as the first item (icon: `LayoutDashboard` from lucide-react).
- `isActive` when `useMatch({ path: '/session/:id', end: true })`.
- `onClick` navigates to `/session/:id` (index).
- Flight mode tab remains; clicking it navigates to `/session/:id/map` as before.

---

## 5. Data Fetching

- `SessionOverviewView` calls `useMapPageActions()` (already available via `MapActionsContext`) to access landmarks, connections, and map data — same pattern as other views.
- Process data via `useProcessStore()`.
- No new API endpoints required.

---

## 6. Tests

- **`SessionOverviewView.test.tsx`**: unit tests verifying each card renders with mocked store data; "View full →" links point to correct sub-routes.
- **`Navbar.test.tsx`**: add test that index route renders `view-overview` test-id; add test that Overview tab click navigates to index.

---

## 7. File Checklist

| File | Change |
|---|---|
| `App.tsx` | Replace index redirect with `<SessionOverviewView />`; keep `map` sub-route |
| `pages/MapPage/SessionOverviewView.tsx` | **New** — dashboard component |
| `components/Navbar/Navbar.tsx` | Add Overview tab |
| `test/SessionOverviewView.test.tsx` | **New** — unit tests |
| `test/Navbar.test.tsx` | Add Overview tab tests |

---

## 8. Out of Scope

- No changes to existing sub-views (`MetricsView`, `CollaboratorMatrixView`, etc.).
- No new backend endpoints.
- No changes to the map canvas or store shape.
