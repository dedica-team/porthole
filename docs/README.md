# Porthole Documentation

Porthole is a collaborative application landscape mapping and quality tracking platform. It allows software teams to model architectures on an interactive 3D hex grid, assess non-functional requirements (NFRs), track workflows, and maintain operational health in real time.

---

## Architecture & Tech Stack

- **Backend**: Micronaut (Kotlin) following Hexagonal Architecture (Ports & Adapters) with REST endpoints and WebSocket broadcasting for real-time synchronization.
- **Frontend**: React, TypeScript, Three.js (orthographic X-ray and 3D perspective views), Tailwind CSS, and shadcn/ui.
- **Persistence**: In-memory domain aggregates persisted atomically to JSON storage (`mapStates.json`, `users.json`).
- **Communication**: REST for commands and queries; WebSocket for live state broadcast to all active session participants.

---

## Core Domain Concepts

### 1. Maps, Sessions & Terrain
- **Map / Session**: The top-level workspace containing landmarks, connections, metrics, processes, and chores.
- **Hex Grid & Terrain**: Axial coordinate grid (`q, r`) with configurable elevation (0–10) and biomes (`WATER`, `GRASS`, `FOREST`, `ROCKS`). Elevation 0 (water) is impassable.

### 2. Landmarks & Groups
- **Landmarks**: Architectural components (services, databases, clients) represented by 14 visual types. Landmarks hold metadata (name, slug ID, description, owner, group) and can be positioned on the grid or kept unpositioned in the catalog.
- **Groups**: Categorization containers with custom colors to visually cluster related landmarks.

### 3. Connections & Processes
- **Connections**: Physical links between landmarks routed dynamically via A* pathfinding on walkable tiles. Types: `PIPE`, `TELEGRAPH`, `STREET`.
- **Processes & Stages**: Logical business/data workflows mapped across sequential stages. Stages reference underlying connections with directional flow (`FORWARD`, `REVERSE`, `BIDIRECTIONAL`) and appear as visual overlays with heatmaps.

### 4. Quality Metrics & Health Indicators
- **Metric Definitions**: Map-wide quality metrics (e.g., Twelve-Factor criteria, SLOs, latency, test coverage) creatable manually or via built-in templates.
- **Metric Evaluations**: Per-landmark evaluations with a value, external link (dashboard/runbook), and level (`NONE`, `OK`, `WARNING`, `ERROR`).
- **Worst-of Roll-up**: Landmarks display a status indicator reflecting their most severe metric level (`ERROR` > `WARNING` > `OK` > `NONE`), radiating heatmaps in X-ray view.
- **Automated Metric Push & Ingestion API**: Headless REST API (`POST /api/sessions/{id}/metrics/{metricId}/values`) and JQ transformation pipeline for batch ingestion from CI/CD runners (GitLab, GitHub, SonarQube, Wiz) authenticated via scoped HMAC JWTs. Complete OpenAPI specification available in `server/src/main/resources/openapi.yaml` and served live at `GET /api/openapi.yaml`.

### 5. Collaboration, Matrix & Chores
- **Collaborator Matrix**: Responsibility grid mapping team members to landmarks with engagement levels (`NONE`, `LOW`, `MEDIUM`, `HIGH`).
- **Chore Todo Lists**: Landmark-linked checklists with task status (`NONE`, `ONGOING`, `BLOCKED`, `DONE`), assignees, and links.
- **Greenkeeping Rotations**: Recurring stewardship rotations with sequential turn advancement across team members.

---

## Security & Access Control

### Authentication
Porthole issues self-contained `HttpOnly` JWT cookies upon authentication via:
- **GitHub OAuth**: Team member login with OAuth state validation.
- **Keycloak OIDC**: Enterprise SSO with PKCE and automatic OIDC discovery.
- **Passkeys (WebAuthn)**: Passwordless biometric/security key authentication.

### Authorization & Session Modes
- **Roles**: `VIEWER` (read-only), `REQUEST_PENDING`, `COLLABORATOR` (edit access), and `ADMIN`.
- **Collaboration Modes**:
  - `OPEN`: Authenticated users can view and edit freely.
  - `REQUEST`: Authenticated users can view; editing requires collaborator approval.
  - `PRIVATE`: Map is restricted to explicit collaborators and admins.
- **Global Admins**: Configured via `PORTHOLE_ADMIN_USER_IDS` environment variable. Admins can delete any session, join any map, export session JSON, and reassign landmark ownership.
