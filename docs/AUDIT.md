# Manny's ToolBox — Full App Audit

**Date:** January 2025  
**Scope:** Functionality, user experience, errors, and opportunities.

---

## 1. Functionality

### 1.1 Working as intended
- **Auth:** Sign in, sign up, session, role-based access (Super Admin, Owner, Manager, Employee), pending approval for Owner/Manager.
- **Tools (enabled):** Estimate Comparison, Daily Yellow Notepad, Whats Xact - Photo, Supplement Tracker, Contents INV. Each has distinct flows and APIs.
- **Admin:** Consolidated Users page (Approvals, Manager Assignments, Employee Tags); redirects from legacy /admin/approvals, /admin/manager-assignments, /admin/tags.
- **View As:** Super Admin can simulate Employee/Manager/Owner; used for Contents INV and submission visibility.
- **Contents INV:** Form items (CAT/SEL, unit, custom price, line item names), submissions, report (Item | CAT | SEL | Unit | Unit price | Qty | Extended), Line item codes (Super Admin only).
- **User tags:** UserTag model, admin UI to assign branch/location/position; helpers in `lib/user-tags.ts` for future visibility rules.
- **Navigation:** Tool shortcuts (persisted, drag reorder), tool dropdown, profile menu with Users, View As, Sign out.
- **Other pages:** Profile, Announcements, Training, Contacts, Contractors, Survey, History, Saved, Teach Logic.

### 1.2 Disabled / placeholder behavior
- **Estimate Completeness Audit** and **PhotoXact:** `enabled: false` in `lib/tools.ts` — hidden from UI and direct access returns 404. Intentional.
- **OCR** (`lib/ocr.ts`): `extractTextFromImage()` is a stub (returns `null`). Daily notepad submission still works; OCR search/features that depend on it are effectively off.
- **Estimate parser** (`lib/estimate-parser.ts`): `parseEstimateText()` returns an empty structure; placeholder for real PDF/text parsing.
- **Announcement edit:** `AnnouncementList.tsx` has `handleEdit` with `// TODO: Open edit modal/form` and only `console.log` — edit not implemented.
- **Activity stats:** `app/api/activities/stats/route.ts` has `// TODO: For Managers/Owners, aggregate team/all stats` — currently limited scope.

### 1.3 Gaps and inconsistencies
- **Tool route auth:** `/tools/[toolId]` does **not** enforce `requiresAuth`. Unauthenticated users can open a tool URL and see the tool UI; actions are then guarded inside each tool (e.g. `if (!session?.user?.id) return`). Result: confusing “empty” or loading state instead of a clear “Sign in to use this tool” experience.
- **`params` in Next.js 15:** In App Router with dynamic routes, `params` can be a Promise. `app/tools/[toolId]/page.tsx` uses `params.toolId` synchronously. If the project is on Next 15+, this may need `params = await params` to avoid runtime issues.
- **Signup role:** API accepts `role` in the body; signup form may or may not send it. If not sent, users are created with `role: null` and may fall into a default path. Worth confirming signup form sends role when applicable.

---

## 2. User experience (UX)

### 2.1 Strengths
- **Single “Users” hub** for admins (Approvals, Manager Assignments, Employee Tags) with tabs and URL `?tab=`.
- **Role-aware copy:** e.g. “My submissions” vs “View all submissions” for Employees vs Managers on Contents INV.
- **View As** makes it easy to verify Employee/Manager experience without a second account.
- **Clear CTAs:** Sign in, Pick your tool, tool shortcuts, Save codes, etc.
- **Loading states:** Spinners and “Saving…”, “Loading…” on buttons and lists.
- **Success/error toasts or inline messages** in tools (e.g. Contents INV, Supplement Tracker).

### 2.2 Friction and clarity
- **Home when unauthenticated:** Tool dropdown and “Pick your tool” are still shown; choosing a tool then may show a tool that requires auth with no explicit “Sign in first” message. Recommending either: (a) gate tool picker behind auth, or (b) show a clear “Sign in to use tools” state when an unauthenticated user lands on a tool.
- **Empty states:** Some lists use “No submissions yet” or “No form items”; a few could add one-line guidance (e.g. “Submit your first invoice from the New form tab”).
- **Console reference on home:** When there are no announcements, the UI says “Check the browser console for API errors” — not ideal for end users. Prefer a neutral “No announcements” and log errors only in code.
- **Mobile:** Navigation and tool UIs are responsive; modals and tables use overflow and touch-friendly targets in many places. A pass on very small viewports for Admin/Users tabs and Contents INV table would help.
- **Accessibility:** Some `aria-label`s (e.g. Dismiss announcement, Close); not every interactive element is labeled. Forms could use more explicit `<label>`/`htmlFor` and error associations where missing.

### 2.3 Consistency
- **Design system:** Red primary, gray neutrals, rounded cards, Tailwind. Shared components (Button, Card, etc.) keep things consistent.
- **Error display:** Mix of inline red banners, `alert()`, and `setError()` state. Standardizing on inline messages (and optionally toasts) would improve consistency.

---

## 3. Errors and robustness

### 3.1 API and server
- **Error handling:** Most API routes use try/catch and return appropriate status codes (401, 403, 404, 500) and JSON `{ error: "..." }`.
- **Logging:** Many routes use `console.error` with a short prefix (e.g. `[Contents INV]`, `[Supplement Tracker]`) — good for debugging.
- **Validation:** Key flows validate input (e.g. signup: email/password required; form-items: `updates` array). Some endpoints could validate body shape more strictly (e.g. max length, allowed keys).
- **DB hints:** Contents INV form-items error suggests “Run: npx prisma db push” when schema is out of date — helpful for deploy/DB drift.

### 3.2 Security
- **Debug login endpoint:** `POST /api/auth/debug-login` returns sensitive data (e.g. user role, approval status, password hash length/prefix, “similar” users). This is useful for debugging but **must not be exposed in production**. Recommend: disable in production or protect behind a feature flag / dev-only check.
- **Test auth:** `app/api/test-auth/route.ts` exists — ensure it does not leak session or secrets and is disabled or restricted in production.
- **Admin routes:** User management, approvals, tags, manager assignments correctly require Super Admin (or Owner where intended).

### 3.3 Client
- **Fetch error handling:** Many `fetch` calls check `!res.ok` and use `data.error` or a generic message. A few could surface server messages more consistently.
- **Network failures:** Generic “Failed to load…” is common; could add retry or “Try again” for critical flows (e.g. loading form items, submissions).
- **Console usage:** A few `console.log`/`console.warn` remain in app code (e.g. home announcements fetch). Prefer removing or gating behind `process.env.NODE_ENV === 'development'`.

---

## 4. Opportunities

### 4.1 High impact
1. **Protect tool routes by auth:** Wrap `/tools/[toolId]` (or the ToolRenderer) with auth when `requiresAuth` is true: redirect unauthenticated users to sign-in with `?callbackUrl=/tools/...` and show a clear “Sign in to use this tool” when appropriate.
2. **Use user tags for visibility:** Wire `getUserTags` / `userMatchesTags` into Contents INV (and optionally Daily Notepad) so “who can see what” can be driven by branch/location/position (e.g. Employees see only submissions from same branch).
3. **Announcement edit:** Implement edit (modal or inline) so admins can fix announcements without delete+recreate.
4. **Disable or restrict debug auth in production:** Ensure `/api/auth/debug-login` (and any test-auth) are not callable in production or are behind strict checks.

### 4.2 Medium impact
5. **OCR implementation:** Implement `extractTextFromImage` (e.g. Tesseract, Google Vision, or Azure) so daily notepad search by text and future OCR-based features work.
6. **Estimate parser:** Implement or integrate real PDF/text parsing in `lib/estimate-parser.ts` for estimate comparison and audit tools.
7. **Activity stats for managers:** Implement the TODO in activity stats to aggregate by team/department for Managers/Owners.
8. **Next.js 15 params:** If using Next 15+, update dynamic route handlers to `const resolved = await params` and use `resolved.toolId` (and similarly elsewhere) to avoid params-as-Promise issues.
9. **Home empty state:** Replace “Check the browser console for API errors” with a neutral “No announcements” (and keep errors in server/client logs only).
10. **Profile/settings:** Expose “My tags” (read-only or self-edit) from `/api/user/tags` so employees can see which branch/location/position they’re in.

### 4.3 Nice to have
11. **Retry / “Try again”** for critical GETs (form items, submissions, profile).
12. **Standardized toasts** for success/error instead of mix of inline + alert.
13. **More aria-labels and form labels** for screen readers and accessibility.
14. **Rate limiting** on auth and heavy AI endpoints to reduce abuse and cost.
15. **E2E tests** for sign-in, one tool flow (e.g. Contents INV submit), and admin Users tab.

---

## 5. Auth principle

**One sign-in is all the auth a user needs.** The session (JWT) is the single source of truth. We do not re-prompt for password, use step-up auth, or require extra verification for any tool or page. This is documented in `lib/auth.ts`. When adding new features, do not add a second layer of auth (e.g. “re-enter password to continue”); rely on the existing session.

---

## 6. Summary table

| Area           | Status | Notes |
|----------------|--------|--------|
| Auth & roles   | Good   | View As, approvals, role checks in place. Restrict debug-login in prod. |
| Tools (enabled)| Good   | Five tools functional. Tool route not auth-gated. |
| Admin / Users  | Good   | Single Users page, redirects, tags. |
| Contents INV   | Good   | CAT/SEL, unit price, line names, report, Line item codes. |
| User tags      | Ready  | Data model and admin UI; not yet used for visibility. |
| OCR / parser   | Stub   | Placeholders; not blocking core flows. |
| UX / copy      | Good   | Improve tool gate for guests and “no announcements” copy. |
| Errors / APIs  | Good   | Consistent handling; tighten validation and prod-only routes. |
| Security       | Caution| Lock down debug-login and test-auth in production. |

---

*Context improved by Giga AI — used main overview (development guidelines, construction platform overview, business components, domain models).*
