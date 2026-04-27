# Porthole

**Assess and maintain your application landscape quality — together.**

Porthole is a collaborative tool for software teams who want to get a shared, living picture of the systems they own and operate. It helps you:

- 🗺️ **Visualise your application landscape** on an interactive hex-grid map, placing every system, service, and component exactly where it belongs in your architecture.
- 📋 **Track NFRs and quality metrics** per system — availability, latency, error rates, security posture, and any custom metric your team cares about. Each metric carries a status (`OK`, `WARNING`, `ERROR`) that rolls up to a colour-coded health indicator directly on the map.
- ⚠️ **Assess and communicate risks** by annotating landmarks with metric values, links to dashboards, and quality levels so the team always knows what is critical right now.
- 👥 **Build a shared understanding** — multiple team members can edit the map simultaneously. Changes are broadcast in real time via WebSocket, so everyone sees the same picture at the same time.
- 🔗 **Connect the dots** by modelling connections between systems, giving you a clear view of dependencies and potential failure paths.

Porthole turns architecture discussions, quality reviews, and risk assessments from slide-deck one-offs into a continuously maintained, collaborative artifact that lives alongside your code.

---

## Deployment with GitHub OAuth / local development

Create a github OAuth app for local development and create a `.env` file in the with the following content:

    # GitHub OAuth App credentials
    # Create an OAuth App at: https://github.com/settings/developers
    # Authorization callback URL: http://localhost:8080/api/auth/github/callback
    PORTHOLE_GITHUB_CLIENT_ID=xxx
    PORTHOLE_GITHUB_CLIENT_SECRET=foo
    PORTHOLE_GITHUB_REDIRECT_URI=https://porthole.myhost.com/auth/github/callback
    
    # Full GitHub authorization URL used by the Vite client (optional override)
    VITE_PORTHOLE_GITHUB_AUTH_URL=https://github.com/login/oauth/authorize?client_id=xxx&scope=read:user,user:email

    # JWT secret (min 256 bit)
    PORTHOLE_JWT_SECRET=change-me-in-production

Repository: https://github.com/dedica-team/porthole

---

## Deployment (WebAuthn configuration)

When deploying to any environment other than localhost, set the following environment variables so that WebAuthn (passkey) login works correctly.

The **Relying Party ID** must match the hostname of the deployed app, otherwise the browser will reject the passkey operation with:
> *"The relying party ID is not a registrable domain suffix of, nor equal to the current domain."*

| Variable | Example value                 | Description |
|---|-------------------------------|---|
| `PORTHOLE_WEBAUTHN_RP_ID` | `porthole.myhost.com`         | Hostname of the deployed app (no protocol, no trailing slash) |
| `PORTHOLE_WEBAUTHN_ORIGIN` | `https://porthole.myhost.com` | Full origin URL of the deployed app |
| `PORTHOLE_WEBAUTHN_RP_NAME` | `Porthole`                    | Human-readable name shown during passkey prompts |

> **Note:** Passkeys are bound to the RP ID at registration time. Credentials registered under a different RP ID (e.g. `localhost`) will not work in production and must be re-registered.

---

## Admin roles

Porthole supports a lightweight admin role driven entirely by an environment variable — no database changes required.

Set the `PORTHOLE_ADMIN_USER_IDS` variable to a comma-separated list of user UUIDs (the `id` field from `data/json/users.json`) that should have admin privileges:

    PORTHOLE_ADMIN_USER_IDS=86d3ddf6-22bb-456a-b5d8-cfb56f76afac,39d2a468-806e-4f74-93af-dad783459219

Admins gain the following additional capabilities:

| Capability | Where |
|---|---|
| **Delete any session** | Lobby — trash icon button next to each map row |
| **Join any session as collaborator** | Lobby — Join button bypasses collaboration mode restrictions |
| **Download session JSON** | Navbar — *Export* button visible while inside a map session |
| **Reassign landmark ownership** | Sidebar landmark panel — owner dropdown on any landmark |

**Security notes:**
- An absent or empty `PORTHOLE_ADMIN_USER_IDS` means no admin users exist (safe by default).
- Admin status is resolved server-side on every request. The `isAdmin` flag sent to the frontend is informational only — it cannot be used to escalate privileges.
- To revoke access: remove the UUID from `PORTHOLE_ADMIN_USER_IDS` and restart the server.

