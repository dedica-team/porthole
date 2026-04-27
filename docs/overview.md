# Porthole – Product Overview

> Assess and maintain your application landscape quality — together.

## The Problem

Modern software teams operate dozens of services, libraries, and integrations. The architecture exists in people's heads, in out-of-date diagrams, and scattered wikis. Non-functional requirements (NFRs) like availability, latency, or security posture are tracked in separate dashboards that nobody looks at during planning. Risks are discovered late. New team members spend weeks just understanding what is where.

## What Porthole Does

Porthole gives your team a **single, collaborative, always-up-to-date map** of your application landscape. It is not a static diagram — it is a living workspace where quality data, risks, and ownership are maintained continuously.

### Core Capabilities

#### 🗺️ Collaborative Application Landscape Map
- Place every system, service, component, or external dependency as a **Landmark** on an interactive hex-grid map.
- Model **connections** between systems to visualise dependencies, data flows, and integration points.
- Multiple team members edit the map simultaneously; all changes are broadcast in real time via WebSocket.

#### 📋 NFR & Quality Metric Tracking
- Define **Quality Metrics** at the map level (e.g. *Availability*, *P99 Latency*, *MTTR*, *Security Score*, *Test Coverage*) — anything your team considers important.
- Assign a concrete **value**, an optional **link** (to a dashboard, SLA document, or ticket), and a **quality level** (`OK`, `WARNING`, `ERROR`) for each metric on each system.
- A **worst-of roll-up** automatically aggregates all metric levels per system and displays a colour-coded status indicator directly on the 3-D model on the map.

| Level     | Colour      | Meaning                                |
|-----------|-------------|----------------------------------------|
| `NONE`    | Grey        | Metric defined, no value set yet       |
| `OK`      | Green       | Within acceptable range                |
| `WARNING` | Amber       | Needs attention                        |
| `ERROR`   | Red         | Critical — immediate action required   |

#### ⚠️ Risk Assessment
- The visual health indicators (blinking status lights on each landmark) make critical systems immediately visible without opening a spreadsheet.
- Link metric entries directly to incident postmortems, runbooks, or risk registers.
- Use `WARNING` and `ERROR` levels to drive your team's next architecture review agenda.

#### 👥 Shared Team Picture
- Every edit — a new landmark, an updated metric, a changed connection — is pushed to all connected clients instantly.
- Lobby and access control ensure only authorised team members can view or edit a map.
- The **Collaborator Matrix** view shows which team member is responsible for which part of the landscape.

#### 🔗 Dependency Modelling
- Draw typed connections between landmarks to represent REST calls, event streams, database access, or any other integration.
- Visualise cascading risk: if a foundational service is in `ERROR`, dependent services are easy to identify.

---

## Typical Use Cases

| Scenario | How Porthole Helps |
|---|---|
| **Architecture review** | Walk the team through the live map; colour-coded health status highlights where quality is degrading. |
| **NFR definition & tracking** | Define SLOs as quality metrics, set target levels, and assign owners — all on the map. |
| **Incident post-mortem** | Update metric levels and link to the postmortem; the history is preserved in the map. |
| **Onboarding new engineers** | The map is the first stop — systems, their quality, and their connections in one place. |
| **Risk workshop** | Collaboratively mark systems as `WARNING`/`ERROR` and model mitigation paths. |
| **Sprint planning** | Use the map to identify which systems need quality investment in the upcoming sprint. |

---

## Key Concepts

| Concept | Description |
|---|---|
| **Map** | The workspace — contains all landmarks, connections, and metric definitions for one application landscape. |
| **Landmark** | A system, service, component, or external dependency placed on the map. |
| **Connection** | A directed or undirected link between two landmarks representing a dependency or integration. |
| **Quality Metric** | A map-wide metric definition (name + description) that can be evaluated for each landmark. |
| **Landmark Metric Entry** | The concrete evaluation of a metric for a specific landmark: value, link, and quality level. |
| **Quality Level** | `NONE` / `OK` / `WARNING` / `ERROR` — the health status of a single metric entry. |
| **Worst-of Status** | The highest (worst) quality level across all metric entries for a landmark, shown as a blinking status light on the map. |

---

## Architecture at a Glance

```
Browser (React + Three.js)
  │  real-time updates via WebSocket
  ▼
Spring Boot Server (Kotlin)
  │  persists state with EclipseStore
  ▼
JSON / EclipseStore persistence layer
```

Authentication is handled via GitHub OAuth; JWT tokens are used for session management.

---

## Roadmap Highlights

- Global quality dashboard aggregating metrics across all landmarks
- Threshold-based automatic level calculation (e.g. `value > 5 % → ERROR`)
- Metric categories and tags
- CSV / JSON export of metric data
- WebAuthn / passkey authentication
- Terrain and landscape editor

See the [`docs/`](.) folder for detailed feature plans.

