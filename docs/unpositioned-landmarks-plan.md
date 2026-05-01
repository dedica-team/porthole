# Plan: Unpositioned Landmarks Feature (Simplified)

## Overview
Allow creating landmarks in the MetricsView without requiring map coordinates. Users can create landmarks with just metadata (name, type, description, group, link) first, and optionally assign coordinates to them later through existing mechanisms (re-use `placeLandmark` or similar).

This provides a lightweight way to manage landmark metadata independently from position assignment.

## Current State
- Landmarks are created exclusively in TilePanel via `placeLandmark` API which requires coordinates (q, r)
- Landmark type requires a `coordinate: HexCoordinate` field (not optional)
- MetricsView only displays existing landmarks in a metrics table
- No way to create landmarks purely from the metrics/metadata perspective

## Implementation Roadmap

### Phase 1: Type System & Core Data Model

#### 1.1 Update Frontend Type Definitions
**File**: `client/src/types/map.ts`
- Make `coordinate: HexCoordinate` optional in the `Landmark` interface
- Add helper function: `isUnpositioned(landmark): boolean` to check if landmark has no coordinates
- Export helper: `isPositioned(landmark): boolean` for positioned landmarks

**Changes**:
```typescript
export interface Landmark {
  id: string;
  name: string;
  ownerId: string;
  coordinate?: HexCoordinate;  // Now optional!
  type: LandmarkType;
  description?: string;
  groupId?: string;
  link?: string;
  metrics?: Record<string, LandmarkMetricEntry>;
}

export function isUnpositioned(landmark: Landmark): boolean {
  return !landmark.coordinate;
}

export function isPositioned(landmark: Landmark): boolean {
  return !!landmark.coordinate;
}
```

#### 1.2 Update Backend Domain Model
**File**: `server/src/main/kotlin/team/dedica/landmarks/domain/Landmark.kt`
- Make `coordinate: HexCoordinate?` nullable in Kotlin
- All existing validation and logic remain the same
- Queries that require coordinates (connections, spatial checks) filter/validate as needed

### Phase 2: Backend API Extension

#### 2.1 Add Controller Endpoint Only (No New Use Case Needed)
**File**: `server/src/main/kotlin/team/dedica/landmarks/adapter/in/web/MapController.kt`

Add endpoint:
- **`POST /maps/{id}/landmarks/unpositioned`**
  - Request body: `{ name: string, type: LandmarkType, description?: string, groupId?: string, link?: string }`
  - Response: `MapState`
  - Auth: Collaborator only
  - Validation: Reuse existing landmark validation logic (unique name/slug, valid type, non-decorative)
  - Implementation: 
    - Validate collaborator permission (existing check)
    - Validate name is not empty (existing check)
    - Validate type is valid and non-decorative (existing check)
    - Check slug uniqueness (existing check)
    - Create Landmark object with `coordinate = null`
    - Persist and broadcast via MapState
    - Return updated MapState

**Rationale**: We don't need a separate Use Case because landmark creation validation is identical to `placeLandmark`. The only difference is coordinates being `null`. Reuse the existing validation logic in a new endpoint instead of duplicating it in a new Use Case.

### Phase 3: Frontend API Layer

#### 3.1 Extend mapApi.ts
**File**: `client/src/api/mapApi.ts`

Add function:
```typescript
export async function createUnpositionedLandmark(
  mapId: UUID,
  name: string,
  type: LandmarkType,
  description?: string,
  groupId?: string,
  link?: string
): Promise<MapState>
```

### Phase 4: MetricsView Enhancement

#### 4.1 Add Landmark Creation Dialog
**File**: `client/src/components/MetricsView/MetricsView.tsx`

Changes:
1. Add new state: `showCreateLandmarkDialog: boolean`
2. Add "Create Landmark" button in header (next to "Add Metric" button)
3. Create new dialog component `CreateLandmarkDialog` (similar to `MetricTemplateSelector`)
   - Fields: 
     - Name (required, max 60 chars)
     - Type (required, dropdown, exclude decorative types like WALL)
     - Description (optional, max 200 chars)
     - Group (optional, dropdown)
     - Link (optional, URL validation)
   - Submit button calls `onCreateUnpositionedLandmark` handler

#### 4.2 Extend MetricsView Props
Add to MetricsView props interface:
```typescript
onCreateUnpositionedLandmark?: (
  name: string, 
  type: LandmarkType, 
  description?: string, 
  groupId?: string, 
  link?: string
) => void;
```

#### 4.3 Update Landmark Display in Metrics Table
- Unpositioned landmarks (coordinate is null/undefined) are displayed normally in the metrics table
- Add visual indicator for unpositioned landmarks:
  - Grey-out landmark row or show "No position" badge next to landmark name
  - Or: Show "📍 No position" prefix in landmark name
- Allow editing metrics for unpositioned landmarks (same as positioned ones)

### Phase 5: MapPage Integration

#### 5.1 Add MapPage Handler
**File**: `client/src/pages/MapPage/MapPage.tsx`

Add handler:
```typescript
const handleCreateUnpositionedLandmark = useCallback((
  name: string, 
  type: LandmarkType, 
  description?: string, 
  groupId?: string, 
  link?: string
) => {
  withAction(() => createUnpositionedLandmark(currentMap!.id, name, type, description, groupId, link));
}, [currentMap, withAction]);
```

Pass handler to MetricsView props as `onCreateUnpositionedLandmark={handleCreateUnpositionedLandmark}`

#### 5.2 TilePanel - Click Empty Tile, Then Position Immediately (Optional for MVP)
**File**: `client/src/components/Sidebar/panels/TilePanel.tsx`

Future enhancement (not required for MVP):
- When user clicks an empty tile, sidebar switches to a "Position Landmark" list state
- Sidebar shows all unpositioned landmarks (name, type, optional group color/badge)
- Clicking one landmark immediately positions it on the selected tile
- After success, sidebar returns to normal tile state and positioned landmark appears on map

Implementation notes:
- Reuse selected tile from existing `TilePanel` flow (`selectedTile` in store)
- Trigger one action on click: position selected landmark at `selectedTile.q/r`
- Keep list disabled while request is loading to prevent double-submit
- Show inline error if placement fails (tile conflict, permission, stale state)

Note: This still needs backend support to link an existing unpositioned landmark to coordinates.
For MVP, this section remains optional and can be implemented after creation-only flow is stable.

### Phase 6: Data Handling & Filtering

#### 6.1 HexGrid Filtering
**File**: `client/src/components/HexGrid/HexGrid.tsx`

Ensure unpositioned landmarks are:
- Not rendered on the map (they have no coordinates to render at)
- Excluded from landmark picking/raycasting logic
- Excluded from 3D mesh generation for landmarks

Add filtering:
```typescript
const positionedLandmarks = Object.values(currentMap?.landmarks ?? {})
  .filter(l => l.coordinate != null);  // Only render landmarks with coordinates
```

#### 6.2 Backend Query Updates
Update Landmark queries to:
- Default: return all landmarks (positioned and unpositioned)
- Positioned-only queries for spatial operations (connections, terrain rendering, proximity checks)
- Filter as needed: `WHERE coordinate IS NOT NULL` for positioned landmarks only

### Phase 7: Validation & Edge Cases

#### 7.1 Validation Rules
- **Non-decorative types only**: WALL and other decorative types cannot be unpositioned (they require UUID-based identity)
- **Name conflicts**: Slug-based uniqueness still applies (same as positioned landmarks)
- **Ownership**: Only collaborators can create landmarks
- **Groups**: Unpositioned landmarks can belong to groups normally
- **Metrics**: Unpositioned landmarks can have metrics assigned immediately
- **Connections**: Unpositioned landmarks cannot be connection origins/targets (they have no position)

#### 7.2 UI States
- Unpositioned landmarks show in MetricsView with "No position" indicator/badge
- Unpositioned landmarks do NOT appear on the 3D hex map
- Unpositioned landmarks appear in metrics table normally and can have metrics assigned
- Landmark name slug validation still enforced at creation time

### Phase 8: Testing

#### 8.1 Backend Tests
- Controller endpoint: happy path (create unpositioned), validation errors (invalid name, duplicate slug, decorative type), 404s, 403s for non-collaborators
- Landmark model: nullable coordinate handling, serialization/deserialization with null coordinate

#### 8.2 Frontend Tests
- MetricsView: Create landmark dialog opens/closes, form validation, slug uniqueness check
- MapPage: Handler properly calls API, state updates correctly
- HexGrid: Unpositioned landmarks filtered from rendering
- Landmark name display: "No position" indicator shows correctly

#### 8.3 Integration Tests
- Create unpositioned landmark, verify appears in metrics view with badge
- Assign metrics to unpositioned landmark, verify persists
- Verify unpositioned landmark does not appear on 3D map
- Edit unpositioned landmark metadata (name, type, group, link)

## Implementation Priority

**Must Have (MVP)**:
1. Type system updates (Phase 1)
2. Backend use case & endpoint (Phase 2)
3. Frontend API function (Phase 3)
4. MetricsView creation dialog (Phase 4)
5. MapPage handler integration (Phase 5.1)
6. HexGrid filtering for rendering (Phase 6.1)
7. Validation (Phase 7.1)

**Should Have**:
1. Visual indicators for unpositioned landmarks (Phase 4.3)
2. Comprehensive testing (Phase 8)

**Nice to Have**:
1. Future: TilePanel positioning UI (Phase 5.2) - can be added later
2. Batch operations

## File Checklist

### Backend
- [ ] `Landmark.kt` - make coordinate nullable
- [ ] `MapController.kt` - add 1 endpoint for unpositioned landmark creation (reuse existing validation logic)
- [ ] Tests for new endpoint

### Frontend
- [ ] `client/src/types/map.ts` - update Landmark type, add helpers
- [ ] `client/src/api/mapApi.ts` - add createUnpositionedLandmark function
- [ ] `client/src/components/MetricsView/MetricsView.tsx` - add dialog state and button
- [ ] `client/src/components/MetricsView/CreateLandmarkDialog.tsx` - new component
- [ ] `client/src/pages/MapPage/MapPage.tsx` - add handler, pass to MetricsView
- [ ] `client/src/components/HexGrid/HexGrid.tsx` - filter unpositioned landmarks
- [ ] Tests and integration tests

## Acceptance Criteria

1. **Creation**: User can create a landmark in MetricsView without coordinates
2. **Type Safety**: Landmark model properly handles optional coordinates (frontend + backend)
3. **Metrics**: Unpositioned landmarks can have metrics assigned immediately after creation
4. **Display**: Unpositioned landmarks appear in metrics view with "No position" badge
5. **Map Rendering**: Unpositioned landmarks do not appear on the 3D map (HexGrid)
6. **Validation**: System validates landmark name uniqueness and type validity
7. **Future Ready**: Architecture supports positioning these landmarks later without major refactoring
