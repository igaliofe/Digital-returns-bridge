# Digital Returns Bridge

A Jakarta EE 10 reverse-logistics management system for product returns, built as a Java advanced studies workshop project.

## System Overview

Digital Returns Bridge provides a complete digital flow for product returns between:
- **Service Representatives** (JSF web UI) — open return requests via a **3-step Create Return wizard** (identify customer → select purchase → new return)
- **Drivers** (Android app) — pick up items, scan barcodes, capture photos and signatures
- **Warehouse Staff** (JSF web UI **and** Android storekeeper flow) — receive items by barcode, inspect, make routing decisions
- **Managers** (JSF web UI) — monitor KPIs and manage system data

Purchase history (`customer_purchases`) powers wizard Step 2. When a return is created from a selected purchase row, the server sets `handled=true` on that purchase in the same transaction.

All **24 Figma screens** are implemented: styling is web via `resources/css/drb.css` (Inter font, design tokens), Android via shared theme resources. Known UI fidelity gaps and their fixes are tracked in [docs/figma-ui-gaps.md](docs/figma-ui-gaps.md).

## How Barcodes Work

**The system does NOT manage a barcode pool.** Drivers carry physical barcode stickers. When picking up an item, the driver sticks a label on the product and scans it with the Android app camera (or types it manually). The system links that barcode to the return request. The warehouse later scans the barcode to pull up the full digital file.

---

## Running the Full Project

There are two ways to run the project: **Docker Compose** (recommended, runs everything automatically) or **manually** (each component separately).

### Option 1 — Docker Compose (recommended)

Runs PostgreSQL + WildFly server together with a single command.

**Prerequisites:** Docker Desktop 24+, Docker Compose v2

#### Step 1 — Configure environment

```bash
cp infra/.env.example infra/.env
```

Open `infra/.env` and fill in your real values:

```
POSTGRES_PASSWORD=change_me_in_production
CLOUDINARY_CLOUD_NAME=your_cloud_name   # from cloudinary.com
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
WILDFLY_ADMIN_PASSWORD=change_me_in_production
```

> **Cloudinary is required for image uploads.** The rest of the system works without it — Cloudinary calls will return a 400 error until credentials are set.

#### Step 2 — Build & start

```bash
make build    # builds the Docker image (Maven inside Docker, no local Java needed)
make up       # starts postgres + server in the background
```

#### Step 3 — Wait for startup (~30 seconds)

```bash
make logs     # watch server logs; ready when you see "Deployed ROOT.war"
```

#### Step 4 — Open the web UI

| URL | Description |
|---|---|
| http://localhost:8080/login.xhtml | Main web UI (login page) |
| http://localhost:9990 | WildFly management console |

Log in with any phone number from the seed data:

| Phone | Role |
|---|---|
| `0501111111` | Service Rep |
| `0502222222` | Driver |
| `0503333333` | Warehouse |
| `0504444444` | Manager |

#### Useful commands

```bash
make logs     # tail server logs
make down     # stop everything
make shell    # open a shell inside the server container
make clean    # stop + delete containers, volumes, and build artifacts
```

---

### Option 2 — Manual (without Docker)

#### Prerequisites

- Java 17 JDK
- Maven 3.9+
- WildFly 36 ([download](https://www.wildfly.org/downloads/))
- PostgreSQL 15

#### Step 1 — Start PostgreSQL and create the database

```bash
psql -U postgres -c "CREATE DATABASE drb;"
psql -U postgres -c "CREATE USER drb WITH PASSWORD 'drb_secret';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE drb TO drb;"

# Load schema then seed data
psql -U drb -d drb -f database/schema.sql
psql -U drb -d drb -f database/seed.sql
```

> **Existing Docker volumes**: the initdb scripts only run on a *fresh* `postgres_data` volume, so an already-initialized database will not pick up schema changes automatically — reset the volume (`make clean`) or re-run `database/schema.sql` manually.

#### Step 2 — Configure the WildFly datasource

```bash
# Install the PostgreSQL JDBC driver into WildFly
cp /path/to/postgresql-42.x.jar $WILDFLY_HOME/standalone/deployments/

# Run the CLI script to register the datasource
$WILDFLY_HOME/bin/jboss-cli.sh --file=infra/wildfly/configure-datasource.cli
```

The JNDI name used is `java:/jdbc/DrbDS`. The `standalone-snippet.xml` in `infra/wildfly/` shows the full datasource XML block if you prefer to edit `standalone.xml` directly.

#### Step 3 — Set environment variables

```bash
export CLOUDINARY_CLOUD_NAME=your_cloud_name
export CLOUDINARY_API_KEY=your_api_key
export CLOUDINARY_API_SECRET=your_api_secret
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=drb
export POSTGRES_USER=drb
export POSTGRES_PASSWORD=drb_secret
```

#### Step 4 — Build and deploy the server

```bash
mvn -pl server -am clean package
cp server/target/server-1.0-SNAPSHOT.war $WILDFLY_HOME/standalone/deployments/ROOT.war

# Start WildFly
$WILDFLY_HOME/bin/standalone.sh
```

The app is ready when the console prints `Deployed "ROOT.war"`.

---

### Android App (Driver + Storekeeper)

The Android app is **multi-role**: after login, `NavigationHelper` routes `DRIVER` users to the pickup flow and `WAREHOUSE` users to the storekeeper flow (receiving queue, scan, inspection). The storekeeper uses the same warehouse REST endpoints as the JSF receiving screen.

#### Prerequisites

- Android Studio Hedgehog (2023.1) or later
- Android device or emulator running API 24+

#### Step 1 — Point the app at your server

The API base URL is set with the `drbApiBaseUrl` Gradle property (default lives in `android-driver-app/gradle.properties`). It **must** end with `/api/`.

- **Emulator:** the default `http://10.0.2.2:8080/api/` already works (`10.0.2.2` maps to the host's localhost).
- **Real device:** set it to your computer's LAN IP. Either edit the `drbApiBaseUrl` line in `gradle.properties`, or pass it at build time:

```bash
./gradlew :app:assembleDebug \
  -PdrbApiBaseUrl=http://192.168.1.50:8080/api/
```

For a real device, the phone and the server machine must be on the **same Wi-Fi/LAN**, and the server must be reachable on port `8080` (Docker Compose already binds `0.0.0.0:8080`; for a manual WildFly run start it with `-b 0.0.0.0` and allow port 8080 through your firewall).

> The app talks to the server over plain HTTP, so `android:usesCleartextTraffic="true"` is set in the manifest. Keep this in mind if you later move to HTTPS.

#### Step 2 — Build and install

```bash
cd android-driver-app
./gradlew :app:assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

Install with:
```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

Or open the project in Android Studio and press **Run**.

#### Step 3 — Grant permissions and log in

On first launch, **allow the Camera permission** when prompted (used for barcode scanning and photos). Log in with seed phone numbers:

| Phone | Role | Home screen |
|---|---|---|
| `0502222222` | Driver | Pickup list |
| `0503333333` | Warehouse (storekeeper) | Receiving queue |

The app resolves `drivers.id` from the logged-in user via `DriverIdResolver` (not the raw `userId` from `/auth/me`).

---

## Run Tests (server only)

```bash
mvn -pl server -am test
# 80 tests, 0 failures
```

---

## Project Structure

```
digital-returns-bridge/
├── server/               Jakarta EE 10 WAR (JSF + JAX-RS + JPA)
├── android-driver-app/   Native Android Java app
├── database/             PostgreSQL DDL (schema.sql, seed.sql, ERD)
├── infra/                Docker Compose, WildFly config, deployment scripts
├── docs/                 Architecture, API reference, screen descriptions
├── Makefile              Convenience wrapper for Docker Compose
└── README.md             This file
```

---

## Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_DB` | Database name | `drb` |
| `POSTGRES_USER` | Database username | `drb` |
| `POSTGRES_PASSWORD` | Database password | — must set |
| `JDBC_URL` | Full JDBC connection URL | auto-set in Docker |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | — uploads fail without it |
| `CLOUDINARY_API_KEY` | Cloudinary API key | — uploads fail without it |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | — uploads fail without it |
| `WILDFLY_ADMIN_USER` | WildFly admin console user | `admin` |
| `WILDFLY_ADMIN_PASSWORD` | WildFly admin console password | — must set |

---

## Status Flow

```
OPEN → WAITING_FOR_PICKUP → BARCODE_ASSIGNED → PICKED_UP → ARRIVED_TO_WAREHOUSE → INSPECTED → CLOSED
  │                                                              │
  └──────────────► NEEDS_MORE_INFO ◄─────────────────────────────┘
                        │   ("Request More Info" from the warehouse)
                        └──────► WAITING_FOR_PICKUP (re-enter the pickup flow)
```

`NEEDS_MORE_INFO` is reachable from `OPEN` (service rep) and from `ARRIVED_TO_WAREHOUSE` (warehouse "Request More Info" button), and routes back to `WAITING_FOR_PICKUP`. See [docs/architecture.md](docs/architecture.md) for the full allowed-transition table.

### Key enums & fields

- **ItemCondition** (driver + warehouse): `LIKE_NEW_ORIGINAL_PACKAGING`, `LIKE_NEW_NO_PACKAGING`, `USED`, `USED_MINOR_DEFECT`, `SIGNIFICANTLY_DEFECTIVE` (replaces the old `PackageCondition`).
- **ReturnReason / DefectType / DefectStage / DefectLocation**: structured service-rep & driver classification fields.
- **WarehouseDecision** (routing): `STOCK_AS_NEW_114`, `CLASS_B`, `SHAPIIM_155`, `REDESIGN_208`, `FROZEN_FURTHER_HANDLING`, `REPAIR`, `DISPOSE`.
- **ImageType**: `SERVICE_GENERAL_IMAGE`, `SERVICE_DEFECT_IMAGE`, `SERVICE_REP_SIGNATURE`, `DRIVER_PRODUCT_IMAGE`, `DRIVER_DISTANT_IMAGE`, `DRIVER_DEFECT_IMAGE`, `DRIVER_SIGNATURE`, `WAREHOUSE_IMAGE`.
- Products carry a catalog `imageUrl`; service reps record delivery date, quantity, warranty/used flags and a drawn signature; drivers and service reps capture multiple typed photos and drawn signatures. Full field list in [docs/api.md](docs/api.md) and [database/erd.md](database/erd.md).

## Further Reading

- [docs/initial-plan.he.html](docs/initial-plan.he.html) — lecturer-facing Hebrew specification (printable)
- [docs/figma-ui-gaps.md](docs/figma-ui-gaps.md) — Figma UI fidelity gaps & resolution log
- [docs/architecture.md](docs/architecture.md) — system architecture, wizard flow, and status transition diagram
- [docs/api.md](docs/api.md) — full REST API reference (purchase endpoints, `purchaseId`, handled rule)
- [docs/screens.md](docs/screens.md) — 24 Figma screens mapped to routes/activities
- [infra/README.md](infra/README.md) — detailed deployment and troubleshooting guide
