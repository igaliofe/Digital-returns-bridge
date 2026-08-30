# Digital Returns Bridge

A reverse-logistics system for product returns, built with Jakarta EE 10. A web portal for service
representatives, warehouse staff and managers, plus a native Android app for drivers and
storekeepers in the field.

Java advanced studies workshop project.

![Dashboard](docs/images/dashboard.png)

## What it does

A return travels through the company on one digital file, from the customer's phone call to the
warehouse decision:

- **Service rep** (web) opens a return through a 3-step wizard: identify customer → pick the item
  from their purchase history → fill in the return details, photos and a signature.
- **Driver** (Android) sees their pickups, sticks a physical barcode label on the item and scans it,
  photographs it, and collects a customer signature.
- **Warehouse** (web + Android) scans the barcode to pull up the full file, inspects the item and
  records a routing decision.
- **Manager** (web) watches KPIs and manages users, customers, products and drivers.

Barcodes are physical stickers the drivers carry — the system does not manage a barcode pool. It
links the scanned code to the return, and the warehouse later uses it to find the file.

## Tech stack

| Layer | Technology |
|---|---|
| Server | Jakarta EE 10 on WildFly 36, Java 17 |
| Web UI | JSF (Facelets) + PrimeFaces |
| API | JAX-RS |
| Persistence | JPA / Hibernate, PostgreSQL 15 |
| Mobile | Native Android (Java), Retrofit + Glide |
| Images | Cloudinary |
| Tests | JUnit 5, Mockito, AssertJ, Playwright |

## Quick start

Requires Docker Desktop 24+ and a [Cloudinary](https://cloudinary.com) account (free tier).

```bash
cp infra/.env.example infra/.env    # fill in POSTGRES_PASSWORD and the three CLOUDINARY_* values
make build
make up
```

Wait about a minute, then open <http://localhost:8080/login.xhtml>.

```bash
make logs     # ready when you see: Deployed "ROOT.war"
make down     # stop
make clean    # stop and wipe the database
```

On Windows, or to install without Docker, see the [installation guide](docs/installation.md).

## Logging in

Authentication is by phone number only, no password. Users come from `database/seed.sql`:

| Phone | Role | Lands on |
|---|---|---|
| `0501111111` | Service rep | Dashboard |
| `0502222222` | Driver | Pickup list (Android) |
| `0503333333` | Warehouse | Warehouse receiving |
| `0504444444` | Manager | Dashboard |

The seed also loads 20 customers, 30 products, 94 purchase-history rows and 45 return requests
spread across all eight statuses, so every screen has real content.

## Android app

```bash
cd android-driver-app
./gradlew installDebug -PdrbApiBaseUrl=http://10.0.2.2:8080/api/
```

Log in as the driver or warehouse user above. `10.0.2.2` is the emulator's alias for the host; for a
physical device use the computer's LAN IP. Details in the
[installation guide](docs/installation.md#android-app).

## Tests

```bash
mvn -pl server -am test          # 81 unit tests
cd e2e && npm ci && npx playwright install chromium && npm test    # 268 browser tests
```

The Playwright suite resets the Docker stack before it runs, so don't point it at data you care
about.

## Status flow

```
OPEN → WAITING_FOR_PICKUP → BARCODE_ASSIGNED → PICKED_UP → ARRIVED_TO_WAREHOUSE → INSPECTED → CLOSED
  │                                                              │
  └──────────────► NEEDS_MORE_INFO ◄─────────────────────────────┘
                        └──────► WAITING_FOR_PICKUP
```

Transitions are enforced server-side in `ReturnRequestService`. Concurrent edits to the same return
are caught by a JPA `@Version` optimistic lock.

## Layout

```
server/               Jakarta EE 10 WAR — JSF, JAX-RS, JPA
android-driver-app/   Native Android app (driver + storekeeper)
database/             schema.sql, seed.sql, ERD
infra/                Docker Compose and WildFly configuration
e2e/                  Playwright browser suite
docs/                 Documentation and screenshots
```

## Documentation

- [Installation guide](docs/installation.md) — Docker, macOS, Windows, troubleshooting
- [Architecture](docs/architecture.md) — layers, wizard flow, status transitions
- [REST API reference](docs/api.md)
- [Screens](docs/screens.md) — routes and activities
- [Database ERD](database/erd.md)

### Submission documents (Hebrew)

- [תיעוד פונקציונליות המשתמש](docs/user-functionality.he.md) · [Word](docs/word/1-תיאור-פונקציונליות.docx)
- [מסמך תכנון](docs/design.he.md) · [Word](docs/word/2-מסמך-תכנון.docx)
