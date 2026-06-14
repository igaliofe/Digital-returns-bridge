# Initial Plan

The lecturer-facing specification is maintained in Hebrew:

**[docs/initial-plan.he.html](initial-plan.he.html)** — open in a browser or print to PDF for submission.

## Summary (English)

Digital Returns Bridge is a Jakarta EE 10 reverse-logistics system with:

- **JSF web UI** (13 routes) for Service Reps, Warehouse staff, and Managers — styled to match [Figma](https://www.figma.com/design/QLMlsSFt51XHxZAyUNeI2U/Digital-Returns-Bridge-%E2%80%94-Screen-Designs) via `resources/css/drb.css`
- **Android app** (10 Activities, 11 Figma frames — shared `LoginActivity`; multi-role) for Drivers and Storekeepers (`WAREHOUSE`) — Material styling aligned with Figma
- **3-step Create Return wizard**: Identify Customer → Item Selection (purchase history) → New Return Request
- **Purchase history** (`customer_purchases`): wizard Step 2 lists prior orders; creating a return with `purchaseId` sets `handled = true`
- **REST API** documented in [docs/api.md](api.md)
- **24 Figma screens** mapped in [docs/screens.md](screens.md)
- **UI validation**: [docs/figma-ui-gaps.md](figma-ui-gaps.md) — no gaps identified after Agent 6 pixel-perfect pass

See also [docs/architecture.md](architecture.md), [README.md](../README.md).
