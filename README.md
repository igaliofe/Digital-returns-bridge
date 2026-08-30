# Digital Returns Bridge

A reverse-logistics system for product returns, built with Jakarta EE 10.
A web portal for service representatives, warehouse staff and managers, plus a
native Android app for drivers and storekeepers in the field.

Java advanced studies workshop project.

## What it does

A return travels through the company on one digital file, from the customer's
phone call to the warehouse decision:

- **Service rep** (web) opens a return through a 3-step wizard: identify customer
  -> pick the item from their purchase history -> fill in details, photos and a signature.
- **Driver** (Android) sees their pickups, sticks a physical barcode label on the
  item and scans it, photographs it, and collects a customer signature.
- **Warehouse** (web + Android) scans the barcode to pull up the full file,
  inspects the item and records a routing decision.
- **Manager** (web) watches KPIs and manages users, customers, products and drivers.

Barcodes are physical stickers the drivers carry -- the system does not manage a
barcode pool. It links the scanned code to the return, and the warehouse later
uses it to find the file.

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

## Quick start (Docker)

Requires Docker Desktop 24+ and a free Cloudinary account (cloudinary.com).

    cp infra/.env.example infra/.env

Then edit `infra/.env` and fill in `POSTGRES_PASSWORD` and the three
`CLOUDINARY_*` values. Cloudinary is required -- image and signature uploads
fail without real credentials.

    make build
    make up
    make logs      # ready when you see: Deployed "ROOT.war"

Wait about a minute, then open <http://localhost:8080/login.xhtml>

Stop with `make down`, or `make clean` to also wipe the database.

On Windows there is no `make`; run the same thing directly:

    docker compose -f infra\docker-compose.yml --env-file infra\.env build
    docker compose -f infra\docker-compose.yml --env-file infra\.env up -d

## Logging in

Authentication is by phone number only, no password. Seeded users:

| Phone | Role | Lands on |
|---|---|---|
| 0501111111 | Service rep | Dashboard |
| 0502222222 | Driver | Pickup list (Android) |
| 0503333333 | Warehouse | Warehouse receiving |
| 0504444444 | Manager | Dashboard |

The database is seeded automatically on first start with 20 customers,
30 products, 94 purchase-history rows and 45 return requests across all eight
statuses, so every screen has real content.

## Android app

    cd android-driver-app
    ./gradlew installDebug -PdrbApiBaseUrl=http://10.0.2.2:8080/api/

Log in as the driver or warehouse user above. `10.0.2.2` is the emulator's alias
for the host machine; for a physical device use the computer's LAN IP instead.
Allow the camera permission on first launch -- it is used for barcode scanning
and photos.

## Running without Docker

Requires Java 17, Maven 3.9+, PostgreSQL 15 and WildFly 36.0.1. The one step
that catches people out: the PostgreSQL JDBC driver must be installed as a
**WildFly module** (`modules/org/postgresql/main/` with a `module.xml`), not
dropped into `deployments/`. The full macOS and Windows walkthrough is in
`docs/installation.md` in this project.

## Tests

    mvn -pl server -am test        # 81 unit tests

    cd e2e && npm ci && npx playwright install chromium && npm test    # 268 browser tests

The Playwright suite resets the Docker stack before it runs, so do not point it
at data you care about.

## Project structure

    server/               Jakarta EE 10 WAR -- JSF, JAX-RS, JPA
    android-driver-app/   Native Android app (driver + storekeeper)
    database/             schema.sql, seed.sql, ERD
    infra/                Docker Compose and WildFly configuration
    e2e/                  Playwright browser suite
    docs/                 Documentation and screenshots

## Documentation

All inside the project folder:

- `docs/installation.md` -- full setup for Docker, macOS and Windows, plus troubleshooting
- `docs/architecture.md` -- layers, wizard flow, status transitions
- `docs/api.md` -- REST API reference
- `database/erd.md` -- database ERD
- `docs/word/1-תיאור-פונקציונליות.docx` -- user functionality document (Hebrew)
- `docs/word/2-מסמך-תכנון.docx` -- design document (Hebrew)
