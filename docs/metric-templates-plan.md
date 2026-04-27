# Plan: Metric Templates

## Übersicht

Beim Anlegen einer neuen Qualitätsmetrik soll der Nutzer aus einer vordefinierten Liste von **Metric-Templates** wählen können. Die Templates basieren auf den **12 Factors** für Microservice-/Cloud-native-Anwendungen und sind als statische JSON-Datei im Client gebündelt. Außerdem wird das Formular zum Anlegen neuer Metriken aus dem Tabellenbereich der `MetricsView` heraus in die **Sidebar** verlagert.

---

## Teil 1 – Template-Datenmodell

### Datenstruktur `MetricTemplate`

Sowohl im Server als auch im Client wird das folgende schlichte Datenmodell verwendet:

```ts
interface MetricTemplate {
  id: string;       // stabiler Slug, z. B. "codebase" – kein UUID
  name: string;
  description: string;
}
```

Die `id` ist nur zur Listenidentifikation im Client relevant. Die eigentliche `QualityMetric`-ID wird weiterhin server-seitig (UUID) generiert.

### Template-Inhalte (12 Factors)

Die Templates basieren auf den 12 Factors und umfassen:

| id | name | Kernaussage |
|---|---|---|
| `codebase` | Codebase | One codebase, many deploys |
| `dependencies` | Dependencies | Explicitly declare & isolate |
| `config` | Config | Store config in environment |
| `backing-services` | Backing Services | Treat as attached resources |
| `build-release-run` | Build / Release / Run | Strictly separate stages |
| `processes` | Processes | Stateless, share-nothing |
| `port-binding` | Port Binding | Self-contained HTTP via port |
| `concurrency` | Concurrency | Scale out via process model |
| `disposability` | Disposability | Fast startup, graceful shutdown |
| `dev-prod-parity` | Dev / Prod Parity | Keep environments similar |
| `logs` | Logs | Treat as event streams |
| `admin-processes` | Admin Processes | Run as one-off processes |

Diese Liste wird serverseitig als JSON-Ressourcendatei abgelegt (siehe Teil 5).

---

## Teil 2 – Template-Auswahldialog (neues Component)

### Neue Datei `client/src/components/MetricsView/MetricTemplateSelector.tsx`

Ein **Popover/Dialog**, der:

1. Eine **Suchleiste** (`<Input>`) oben enthält.
2. Darunter eine scrollbare **Liste aller Templates** anzeigt, gefiltert nach dem Suchbegriff (Übereinstimmung in `name` oder `description`, case-insensitive).
3. Beim Klick auf ein Template:
   - Den `name` und `description` des Templates in die aufrufenden Felder überträgt.
   - Das Popover/Dialog schließt.
4. Einen **„Skip / Enter manually"-Button** enthält, um das Template-Auswahl zu überspringen und direkt ein leeres Formular zu öffnen.

**Technologie:** Shadcn `<Dialog>` oder `<Popover>` (je nachdem, was bereits in `components/ui` vorhanden ist – bevorzugt `<Dialog>`, weil er mehr Platz bietet und zur bestehenden Modal-Nutzung passt).

**Props:**
```ts
interface MetricTemplateSelectorProps {
  open: boolean;
  onSelect: (name: string, description: string) => void;
  onSkip: () => void;
  onClose: () => void;
}
```

**Internes State:**
- `searchQuery: string` – Filtertext.
- Die gefilterte Liste wird per `useMemo` aus dem statischen Import berechnet.

**Render-Struktur (grob):**
```
<Dialog open={open}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Choose a Template</DialogTitle>
      <DialogDescription>Select a 12-factor metric or skip to enter manually.</DialogDescription>
    </DialogHeader>
    <Input placeholder="Search templates…" value={searchQuery} onChange={…} autoFocus />
    <ScrollArea className="max-h-80">
      {filteredTemplates.map(t => (
        <button key={t.id} onClick={() => onSelect(t.name, t.description)}>
          <span className="font-semibold">{t.name}</span>
          <span className="text-muted-foreground text-xs">{t.description}</span>
        </button>
      ))}
      {filteredTemplates.length === 0 && <p>No templates match.</p>}
    </ScrollArea>
    <DialogFooter>
      <Button variant="ghost" onClick={onSkip}>Enter manually</Button>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Teil 3 – Änderungen in `MetricsPanel.tsx` (Sidebar)

Das Formular zum Anlegen neuer Metriken **bleibt** in der Sidebar (`MetricsPanel`), aber der **„Add Metric"-Workflow** wird um den Template-Dialog erweitert:

### Änderungen:

1. **Neuer State** `showTemplateSelector: boolean` (initiell `false`).
2. **Neuer State** `showManualForm: boolean` (initiell `false`) – wird gesetzt, wenn der Nutzer „Enter manually" wählt oder ein Template ausgewählt hat (dann mit vorausgefüllten Werten).
3. **Trigger-Button** „+ Add Metric" öffnet nicht mehr direkt das Formular, sondern setzt `showTemplateSelector = true`.
4. **`<MetricTemplateSelector>`** wird eingebunden:
   - `onSelect(name, desc)` → setzt `addName = name`, `addDesc = desc`, schließt Selector, öffnet das manuelle Formular (vorausgefüllt, damit der Nutzer noch anpassen kann).
   - `onSkip()` → schließt Selector, öffnet leeres manuelles Formular.
   - `onClose()` → schließt Selector ohne weitere Aktion.
5. Das **manuelle Formular** (Name-Input + Textarea + Submit-Button) erscheint **inline unterhalb** der Metrikliste in der Sidebar, sobald `showManualForm === true`. Wenn das Formular abgesendet oder abgebrochen wird, wird es wieder ausgeblendet und `showTemplateSelector` / `showManualForm` zurückgesetzt.

**Ablauf (User Journey):**
```
Nutzer klickt „+ Add Metric"
  → MetricTemplateSelector öffnet sich
     ├─ Nutzer sucht/wählt Template  → Formular öffnet sich (vorausgefüllt) → Nutzer bestätigt
     ├─ Nutzer klickt „Enter manually" → Formular öffnet sich (leer) → Nutzer füllt aus
     └─ Nutzer klickt „Cancel"        → alles geschlossen, kein State
```

---

## Teil 4 – Änderungen in `MetricsView.tsx` (Hauptansicht / Tabelle)

Das **„Add Metric"-Formular am unteren Rand** der `MetricsView` wird **entfernt**:

- Der gesamte `<div className="shrink-0 border-t border-border px-6 py-3 bg-card">` Block (Zeilen ~437–467) wird gelöscht.
- Die Props `onCreateMetric` in `MetricsView` bleiben **nicht mehr direkt** im Render-Baum der View benötigt; die Prop selbst kann **entfernt** werden, da das Anlegen ausschließlich über die Sidebar läuft.

> **Hinweis:** Die Props-Schnittstelle von `MetricsView` muss entsprechend aktualisiert werden (`onCreateMetric` entfernen). Alle Aufrufer (MapPage) übergeben diese Prop dann nur noch an die `Sidebar`/`MetricsPanel`.

**Stattdessen** erhält die Header-Zeile der MetricsView einen kleinen **„+ Add"**-Button (Icon-only, öffnet via `useMapStore` den Sidebar-Panel `'metrics'`), damit der Nutzer aus der Tabelle heraus schnell in die Sidebar navigieren kann – ohne dass das Formular in der Tabelle selbst liegt.

```tsx
// In der Header-Zeile:
<Button size="icon" variant="ghost" className="h-6 w-6 ml-auto"
  onClick={() => setSidebarPanel('metrics')}
  title="Add metric in sidebar">
  <Plus className="h-3.5 w-3.5" />
</Button>
```

---

## Teil 5 – Server-Änderungen

### 5a – Template-Ressourcendatei

Neue Datei `server/src/main/resources/metricTemplates.json` – identische Struktur wie oben (JSON-Array mit `id`, `name`, `description`). Die Datei liegt im Classpath und wird beim Start einmalig geladen.

### 5b – Domain-Klasse / DTO

Neue Kotlin-Klasse `MetricTemplate(val id: String, val name: String, val description: String)` im Package `team.dedica.porthole.domain` (oder direkt als einfaches DTO im Adapter-Layer).

### 5c – Use-Case / Port

Neuer Input-Port `GetMetricTemplatesUseCase` mit einer einzigen Methode:

```kotlin
interface GetMetricTemplatesUseCase {
    fun getTemplates(): List<MetricTemplate>
}
```

### 5d – Adapter (Persistence / JSON)

Neue Klasse `JsonMetricTemplateRepository` im Package `team.dedica.porthole.adapter.out.persistence`:
- Lädt `metricTemplates.json` aus dem Classpath via `ResourceLoader` oder `@Value("classpath:metricTemplates.json")`.
- Parst das JSON mit Jackson `ObjectMapper` einmalig (z. B. `@PostConstruct` oder lazy `by lazy`).
- Implementiert `GetMetricTemplatesUseCase`.

### 5e – REST-Controller

Neuer Endpunkt in einem bestehenden oder neuen Controller:

```
GET /api/metric-templates
```

- **Auth:** wie alle anderen `/api/**`-Endpunkte – JWT-gesichert, kein besonderer Schutz.
- **Response:** `200 OK` mit `Content-Type: application/json`, Body = JSON-Array der Templates.
- **Caching:** `Cache-Control: max-age=3600` empfohlen, da die Liste statisch ist.

### 5f – Client-API-Layer

Neue Funktion in `client/src/api/mapApi.ts` (oder neue Datei `metricTemplateApi.ts`):

```ts
export async function fetchMetricTemplates(): Promise<MetricTemplate[]> {
  const res = await fetch('/api/metric-templates', {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to load metric templates');
  return res.json();
}
```

### 5g – Laden der Templates im Client

`MetricTemplateSelector` lädt die Templates beim ersten Öffnen via `useEffect` + `fetchMetricTemplates()`. Bis die Antwort eintrifft, wird ein Ladespinner gezeigt. Fehler werden inline angezeigt (kein globaler Error-State nötig).

---

## Dateiübersicht der Änderungen

| Datei | Aktion |
|---|---|
| `server/src/main/resources/metricTemplates.json` | **neu erstellen** – 12-Factor-Templates als JSON |
| `server/…/domain/MetricTemplate.kt` | **neu erstellen** – Domain-Klasse / DTO |
| `server/…/application/port/in/GetMetricTemplatesUseCase.kt` | **neu erstellen** – Input-Port |
| `server/…/adapter/out/persistence/JsonMetricTemplateRepository.kt` | **neu erstellen** – lädt JSON aus Classpath |
| `server/…/adapter/in/web/MetricTemplateController.kt` | **neu erstellen** – `GET /api/metric-templates` |
| `client/src/api/mapApi.ts` (oder neue `metricTemplateApi.ts`) | **anpassen** – `fetchMetricTemplates()` hinzufügen |
| `client/src/components/MetricsView/MetricTemplateSelector.tsx` | **neu erstellen** – Dialog mit Suche + Fetch |
| `client/src/components/Sidebar/panels/MetricsPanel.tsx` | **anpassen** – Template-Selector einbinden, Workflow anpassen |
| `client/src/components/MetricsView/MetricsView.tsx` | **anpassen** – „Add Metric"-Formular entfernen, `onCreateMetric`-Prop entfernen, `+`-Button in Header |
| `client/src/pages/MapPage/MapPage.tsx` | **ggf. anpassen** – `onCreateMetric`-Prop nicht mehr an `MetricsView` übergeben |

---

## Entscheidungen

1. **Dialog:** Es wird `<Dialog>` (Shadcn) verwendet.
2. **GET-Endpunkt:** Die Templates werden **nicht** als statische JSON-Datei gebündelt, sondern über einen dedizierten Server-Endpunkt bereitgestellt (siehe Teil 1 und Teil 5 unten).
3. **Duplikate:** Mehrfach-Nutzung desselben Templates ist erlaubt; keine Duplikat-Erkennung.





