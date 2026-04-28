# Architecture Decisions — Org Flow Simulator

_Last updated: 2026-04-28_

---

## Context

Org Flow Simulator is a real-time agile backlog simulation tool aimed at agile coaches. It demonstrates the impact of team structure on Lead Time — designed as a "show, don't tell" tool for management workshops.

The product follows a **freemium SaaS model**:
- **Free tier (MVP):** fully client-side, accessible to anyone, no accounts required
- **Pro tier (future):** paid, with authentication, cloud persistence, advanced features

---

## Key Decisions

### 1. Deployment target
**Decision:** Public web application hosted on the user's own account — not a local/desktop tool.

**Reason:** Must be accessible to workshop participants and clients without any installation.

---

### 2. Multi-user / collaboration
**Decision:** No real-time collaboration. Each user runs their own independent simulation instance.

**Reason:** The tool is used by individual coaches; no need for shared state across users.

---

### 3. MVP persistence strategy
**Decision:** localStorage only — no backend, no accounts, no cloud persistence in MVP.

**Reason:** Fastest path to a working product. Persistence was explicitly deferred to avoid over-engineering the first version.

---

### 4. Frontend framework
**Decision:** **Next.js** (App Router) with **React** and **TypeScript**.

**Reasons:**
- The prototype is already built in React — natural continuation.
- Next.js adds production structure, file-based routing, and API routes ready for future backend needs.
- TypeScript provides type safety familiar to Java developers.
- Best-in-class developer experience with Vercel.

---

### 5. Hosting platform
**Decision:** **Vercel** (Hobby/Pro plan).

**Reasons:**
- Created by the same team as Next.js — first-class support for all Next.js features (ISR, Server Components, Image Optimization).
- Zero-ops: automatic HTTPS, global CDN, preview deploys per branch.
- Free tier is sufficient for MVP traffic.
- Scales naturally when Pro tier is introduced (Vercel Postgres, KV, Edge Functions available).

---

### 6. Architecture pattern — MVP
**Decision:** **Architecture 1 — Vercel-native monolith.**

Next.js handles both frontend (React simulation UI) and future backend (API routes / Server Actions). No separate backend service in MVP.

**Reason:** Minimum operational overhead. The simulation engine runs 100% in the browser; no backend is needed yet. When Pro tier arrives, API routes are ready to use without restructuring.

---

### 7. Architecture pattern — Pro tier (future)
**Decision (tentative):** Evaluate at Pro tier kickoff. Two realistic paths:

- **Path A — Stay monolith (Architecture 1 extended):** Add Auth.js + Vercel Postgres + Stripe. Sufficient if Pro is primarily about persistence and saved scenarios.
- **Path B — Add dedicated Java backend (Architecture 4 — Spring Boot on Railway):** Preferred if Pro tier involves heavy Jira integration, batch PDF report generation, or enterprise features (SSO, audit logs, compliance).

**Reason for Java backend preference:**
- Owner is an experienced Java developer — leverages existing skills.
- Atlassian (Jira) has the most mature integration libraries in the Java ecosystem.
- JVM excels at CPU-bound computations (complex simulations, statistics, Monte Carlo).
- Spring Boot ecosystem (Security, Batch, Actuator) provides enterprise-grade features out of the box.
- Easier to hire Java developers, especially for enterprise-targeting products.

---

### 8. Pro tier feature scope (planned)
**Must-have:**
- Advanced simulation scenarios (larger teams, custom roles, task dependencies)
- PDF reports and exports (workshop summaries, before/after comparisons)

**Likely:**
- Jira integration (import real backlog data for simulation)

**Out of scope for now:**
- Real-time collaboration
- Team/organization accounts (multi-tenancy)
- On-premise deployment

---

## Technology Stack Summary

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | Next.js (App Router) | React 18 + TypeScript |
| Styling | TBD (Tailwind CSS recommended) | Current prototype uses plain CSS |
| Simulation engine | Client-side TypeScript | Runs entirely in browser |
| Hosting | Vercel | MVP and Pro frontend |
| Database (Pro) | Vercel Postgres or Neon | PostgreSQL |
| Auth (Pro) | Auth.js (NextAuth) or Clerk | To be decided |
| Backend (Pro, if needed) | Spring Boot on Railway | Java, owner's primary expertise |
| Payments (Pro) | Stripe | Industry standard |
| Jira integration (Pro) | Atlassian Java REST Client | Java backend required |

---

## Migration Path

```
MVP (now)                Pro - Light               Pro - Full
─────────────────────    ──────────────────────    ──────────────────────
Next.js SPA              Next.js + Auth.js          Next.js + Spring Boot
Client-side only    ──▶  Vercel Postgres       ──▶  Jira integration
localStorage             Saved presets              PDF batch reports
No accounts              User accounts              Enterprise SSO
Vercel free tier         Vercel Pro + Stripe        Railway + Vercel
```
