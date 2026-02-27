# Plugin Release Checklist (WearOn Shopify)

## 1) Preflight
- [ ] Repo clean (`git status`)
- [ ] `shopify.app.toml` uses correct app/client id + scopes
- [ ] API endpoints configured to v1 paths:
  - `/api/v1/stores/config`
  - `/api/v1/credits/shopper`
- [ ] Store credit variant configured (`shopify_variant_id`)
- [ ] Allowed domains/CORS configured on backend

## 2) Functional Readiness
- [ ] Product-page-only block rendering works
- [ ] Shadow DOM widget mounts correctly
- [ ] Privacy acknowledge gate works
- [ ] Age gate (13+) works with expiry behavior
- [ ] Absorb mode flow works end-to-end
- [ ] Resell mode flow works end-to-end
- [ ] Credit top-up link opens correctly
- [ ] Balance polling updates state after top-up

## 3) UX / Accessibility
- [ ] No user-facing “buy/purchase” wording in widget
- [ ] ARIA labels present and meaningful
- [ ] Live region status updates are clear
- [ ] Focus-visible outline present
- [ ] Touch targets are >= 44px
- [ ] Forced-colors mode remains usable

## 4) Testing
- [ ] Unit tests pass (`vitest`)
- [ ] Privacy flow tests pass
- [ ] Widget behavior tests pass
- [ ] Accessibility tests pass
- [ ] Size rec display tests pass

## 5) Deploy
- [ ] `shopify app build`
- [ ] `shopify app deploy`
- [ ] Validate on dev store product page
- [ ] Validate absorb + resell mode from real config

## 6) Rollback
- [ ] Keep prior release tag/commit
- [ ] If regression found, redeploy previous known-good commit
- [ ] Confirm storefront recovery + event tracking health
