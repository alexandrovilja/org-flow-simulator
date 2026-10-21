# Architecture Decisions — Org Flow Simulator

_Last updated: 2026-10-21_

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

### 9. User feedback delivery (feat-024)
**Decision:** The free tier stays without its own backend. Feedback is sent from the browser to **Web3Forms** (`fetch` POST to `https://api.web3forms.com/submit`, no new dependency), which emails it to the author. The Web3Forms access key lives in `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` and is therefore visible in the browser bundle.

**Scope of data leaving the browser:** only what the user consciously submits in the "Send feedback" dialog (role, usefulness rating, two free-text answers, interest in a call, optional email), plus the active mode and the date. This is the first and only data the free tier sends to a third party; simulation state, team setup and backlog never leave the browser.

**Reasons:**
- No server code and no secret to manage; free for up to 250 submissions per month.
- Web3Forms' free plan accepts submissions only from the browser (server-side use requires a paid plan plus server IP allowlisting), so the key must be public. Per Web3Forms, the key is not a secret — it only aliases the author's email address; misuse can at most send the author email, and the key can be rotated.
- Vercel warns about public variables with "KEY" in the name; the warning was reviewed and accepted (2026-10-21).

**Alternative considered:** a Next.js Route Handler on Vercel that holds a secret key and sends email through Resend. Rejected for now as extra work for a small risk; it remains the upgrade path if volume, abuse or data-handling needs grow (consistent with decision 6 — API routes are ready when needed).

---

## Technology Stack Summary

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | Next.js (App Router) | React 18 + TypeScript |
| Styling | TBD (Tailwind CSS recommended) | Current prototype uses plain CSS |
| Simulation engine | Client-side TypeScript | Runs entirely in browser |
| User feedback | Web3Forms (browser `fetch`) | Emails feedback to the author; public access key (decision 9) |
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
