# shadcn/ui Migration Plan

## Ziel

Ablösung aller bestehenden Custom-CSS-Komponenten durch shadcn/ui. Das neue Layout folgt
einem **App-Shell-Muster**: eine permanente **Top-Navbar** und eine kontextsensitive
**rechte Sidebar** ersetzen alle modalen Dialoge und Overlays.

---

## 1. Vorbereitung & Setup

### 1.1 Tailwind CSS installieren

shadcn/ui setzt Tailwind CSS voraus. Da das Projekt aktuell reines CSS Module verwendet,
muss Tailwind ergänzt werden – vorhandene `.module.css`-Dateien bleiben dabei zunächst
unberührt und können schrittweise entfernt werden.

```bash
npm install -D tailwindcss @tailwindcss/vite
```

`vite.config.ts` → Tailwind-Plugin eintragen.  
`index.css` → `@import "tailwindcss"` ergänzen.

### 1.2 shadcn/ui initialisieren

```bash
npx shadcn@latest init
```

Empfohlene Konfiguration:
- Style: **Default**
- Base color: **Zinc** (passt zu einem Strategie-/Dark-Game-Theme)
- CSS variables: **Yes**

### 1.3 Benötigte Komponenten hinzufügen

Nur was tatsächlich verwendet wird – kein Overhead:

```bash
npx shadcn@latest add button badge separator scroll-area tooltip avatar
npx shadcn@latest add sheet          # Sidebar (Drawer-Variante)
npx shadcn@latest add navigation-menu
npx shadcn@latest add alert          # Fehlermeldungen statt Toast-Div
npx shadcn@latest add toggle toggle-group   # LandscapeEditor-Toolbar
```

---

## 2. Neues Layout-Konzept

```
┌─────────────────────────────────────────────────────────────┐
│  NAVBAR  🏰 Landmarks │ Session #abc12345 │ [Spieler-Chips] │ Avatar ▾ │
├──────────────────────────────────────────┬──────────────────┤
│                                          │                  │
│                                          │   SIDEBAR        │
│            HexGrid (Three.js)            │                  │
│                                          │  kontextuell:    │
│                                          │  - kein Tile     │
│                                          │    ausgewählt    │
│                                          │    → leer /      │
│                                          │      Legende     │
│                                          │                  │
│                                          │  - Tile gewählt  │
│                                          │    → Tile-Info   │
│                                          │      + Aktionen  │
│                                          │                  │
│                                          │  - Tower angekl. │
│                                          │    → Tower-Info  │
│                                          │      + Connect   │
│                                          │                  │
│                                          │  - EditorMode    │
│                                          │    → Werkzeuge   │
└──────────────────────────────────────────┴──────────────────┘
```

Die Sidebar ist auf Desktop **permanent sichtbar** (fester Bereich rechts, ~280 px).
Auf Mobile würde sie als `Sheet` (Drawer von rechts) funktionieren – für später.

---

## 3. Neue Komponenten-Struktur

### 3.1 `AppShell` (neu)

`src/components/AppShell/AppShell.tsx`

Wrapper, der Navbar + Sidebar-Slot + Content-Slot zusammenhält.  
Wird in `App.tsx` um die geschützten Routen gelegt – **einmalige** Änderung.

```
<AppShell navbar={<Navbar />} sidebar={<Sidebar />}>
  {children}
</AppShell>
```

### 3.2 `Navbar` (neu, ersetzt HUD `topBar`)

`src/components/Navbar/Navbar.tsx`

| Element | shadcn-Komponente | Quelle (alt) |
|---|---|---|
| Logo + Session-ID | `NavigationMenu` | `HUD.tsx → gameInfo` |
| Spieler-Chips | `Avatar` + `Badge` | `HUD.tsx → CollaboratorCard` |
| Back to Lobby | `Button` variant=ghost | `MapPage.tsx → backBtn` |
| Logout | `Button` variant=ghost | `LobbyPage.tsx → logoutBtn` |

Props kommen direkt aus `useMapStore` / `useAuthStore` – keine Prop-Drilling.

### 3.3 `Sidebar` (neu, ersetzt alle Dialoge)

`src/components/Sidebar/Sidebar.tsx`

Die Sidebar zeigt je nach Zustand **einen von vier Panels**:

| Zustand | Panel | Ersetzt |
|---|---|---|
| nichts ausgewählt | `IdlePanel` – Legende / Spielerübersicht | — |
| Tile ausgewählt (kein Tower) | `TilePanel` – Koordinaten, Terrain, Elevation + „Place Landmark"-Button | `HUD bottomBar` + `ConfirmDialog` |
| Tower ausgewählt | `TowerPanel` – Tower-Info, Level, Connections + „Upgrade"- & „Connect"-Button | `TowerInfoDialog` |
| Editor-Modus aktiv | `EditorPanel` – Tool-Toggle-Group, Terrain-Auswahl, Tile-Info | `LandscapeEditor` |

**Kein `ConfirmDialog` mehr** – die Aktionen werden direkt mit einem `Button`
(mit Lade-Spinner via `disabled` + `loading`-State) in der Sidebar ausgelöst.  
Der „Place Landmark"-Button in `TilePanel` erhält eine kurze Bestätigungszeile
(z. B. „Klicke erneut um zu bestätigen") statt eines modalen Dialogs.

### 3.4 `ConnectingBanner` (vereinfacht)

Das bestehende `connectingBanner`-Div in `MapPage` wird zu einer `Alert`-Komponente
(shadcn) oben in der Sidebar, kein separates Overlay mehr.

### 3.5 `ErrorAlert` (ersetzt `errorToast`)

`src/components/ErrorAlert/ErrorAlert.tsx`

Verwendet shadcn `Alert` mit `variant="destructive"`, angezeigt am unteren Rand
der Sidebar statt als absolut positioniertes Toast-Div.

---

## 4. Seiten-Änderungen

### 4.1 `AuthPage`

- Card → shadcn `Card` + `CardContent`
- GitHub-Button → shadcn `Button` (Icon-Slot für SVG)
- Nur ~5 Zeilen Änderung, `AuthPage.module.css` kann entfallen

### 4.2 `LobbyPage`

- Header → wird Teil der gemeinsamen `Navbar` (AppShell)
- Session-Liste → shadcn `Card` je Session
- „Create New Session" → `Button`
- Join/Open → `Button` variant=outline / default
- `LobbyPage.module.css` kann entfallen
- Aktuell: eigene Header-Logik → nach AppShell verschieben

### 4.3 `MapPage`

Hauptänderungen:
- `<HUD>` entfernen → Inhalt wandert in `Navbar` und `Sidebar`
- `<TowerInfoDialog>` entfernen → Inhalt in `TowerPanel` (Sidebar)
- `<ConfirmDialog>` entfernen → Bestätigung inline in `TilePanel`
- `<LandscapeEditor>` entfernen → Inhalt in `EditorPanel` (Sidebar)
- `connectingBanner` → `Alert` in Sidebar
- `errorToast` → `ErrorAlert` in Sidebar
- `backBtn` → in Navbar
- State-Management (`towerInfoTower`, `pendingPlacement`) bleibt in `mapStore` /
  lokalem State, wird aber über Zustand des Sidebar-Panels gesteuert

---

## 5. Store-Anpassungen (minimal)

`src/store/mapStore.ts`

Neuer State: `sidebarPanel: 'idle' | 'tile' | 'tower' | 'editor'`

Dieser wird gesetzt durch:
- `setSelectedTile` → `'tile'` (wenn kein Tower) oder bleibt, wenn Tower geklickt
- `setTowerInfoTower` → `'tower'`
- `setEditorMode(true)` → `'editor'`
- Deselect / Escape → `'idle'`

`pendingPlacement` wird durch einen `confirmPending: boolean`-Flag im Store ersetzt,
der in `TilePanel` direkt sichtbar ist.

---

## 6. Reihenfolge der Umsetzung

| # | Schritt | Aufwand |
|---|---|---|
| 1 | Tailwind + shadcn init, `components/ui/` committen | klein |
| 2 | `AuthPage` migrieren (isoliert, keine Abhängigkeiten) | klein |
| 3 | `AppShell` + `Navbar` (Grundstruktur, ohne MapPage-Daten) | mittel |
| 4 | `LobbyPage` in AppShell einbetten, Header migrieren | mittel |
| 5 | `Sidebar` Grundstruktur + `IdlePanel` | mittel |
| 6 | `TilePanel` (ersetzt HUD bottomBar + ConfirmDialog) | mittel |
| 7 | `TowerPanel` (ersetzt TowerInfoDialog) | klein |
| 8 | `EditorPanel` (ersetzt LandscapeEditor) | mittel |
| 9 | `ConnectingBanner` → Alert in Sidebar | klein |
| 10 | `ErrorAlert` in Sidebar | klein |
| 11 | Alte `.module.css`-Dateien und Komponenten entfernen | klein |
| 12 | Tests anpassen (Queries auf neue DOM-Struktur) | mittel |

---

## 7. Was sich **nicht** ändert

- `HexGrid` (Three.js-Canvas) – keinerlei Änderung
- `useMapWebSocket` – keinerlei Änderung
- `mapStore` (Store-Logik) – nur minimale Ergänzungen (Panel-State)
- `mapApi` – keinerlei Änderung
- Alle Typen in `types/map.ts` – keinerlei Änderung
- Server-seitiger Code – keinerlei Änderung

---

## 8. Dateien, die entfallen

| Datei | Grund |
|---|---|
| `components/ConfirmDialog/` | → inline in TilePanel |
| `components/TowerInfoDialog/` | → TowerPanel in Sidebar |
| `components/LandscapeEditor/` | → EditorPanel in Sidebar |
| `components/HUD/` | → aufgeteilt in Navbar + Sidebar-Panels |
| Alle `*.module.css` | → durch Tailwind-Klassen ersetzt |

