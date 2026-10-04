# Build Progress

## Phase 1: Foundation — IN PROGRESS

**Started:** 2026-10-04

### Completed
- [ ] Root project config (gitignore, workspaces, tsconfig, vercel.json, .env)
- [ ] Server foundation (config.ts, db.ts, app.ts)
- [ ] Data models (Organization, Shop, User, Membership, Plan, Subscription, PlatformAdmin, Counter, AuditLog)
- [ ] Server middleware (auth, tenant, roleGuard, errorHandler, rateLimiter, requireFeature)
- [ ] Entitlements service + AI provider interface
- [ ] Auth module (service, routes, validation)
- [ ] Auth tests + tenant isolation tests + entitlement tests
- [ ] API entry point (api/index.ts)
- [ ] Seed script
- [ ] Web foundation (Vite, Tailwind, i18n, PWA setup)
- [ ] Web auth screens (login page, layout, protected route)
- [ ] Dependencies installed, lint clean, typecheck clean, tests pass, build passes

### Phase 1 Gate (must pass before Phase 2)
- [ ] Login works on deployed Vercel preview
- [ ] Tenant isolation tests pass (Shop A user cannot read Shop B data)
- [ ] Entitlement tests pass with BILLING_ENABLED=false
- [ ] Lint: 0 errors, 0 warnings
- [ ] TypeScript: 0 errors
- [ ] All tests pass
- [ ] Production build: success
- [ ] Lighthouse scores recorded

### Known Issues
None yet.

---

## Phases Ahead
- Phase 2: Inventory core (products, suppliers, purchases, movements)
- Phase 3: Sales (POS, receipts, voids, customers, expenses)
- Phase 4: Stock counts + dashboard
- Phase 5: Reports + exports
- Phase 6: AI assistant + briefing
- Phase 7: Subscriptions + platform admin
- Phase 8: Hardening + handover
