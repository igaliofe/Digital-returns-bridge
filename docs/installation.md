# Installation Guide

Detailed setup for every supported path. For the short version, see the [README](../README.md).

| Path | For | Section |
|---|---|---|
| Docker on macOS / Linux | Fastest — two commands | [1](#1-docker--macos--linux) |
| Docker on Windows | Same stack, PowerShell (`make` is not available) | [2](#2-docker--windows) |
| Local install, no Docker | WildFly and PostgreSQL on the machine directly | [3](#3-local-install--macos) / [4](#4-local-install--windows) |

## Prerequisites

**Docker path:** Docker Desktop 24+ with Compose v2, and a Cloudinary account (free tier).
No local JDK or Maven needed — the build runs inside `maven:3.9-eclipse-temurin-17` and the runtime
image is `quay.io/wildfly/wildfly:36.0.1.Final-jdk17`.

**Local path:** Java 17 JDK, Maven 3.9+, PostgreSQL 15, WildFly `36.0.1.Final`, PostgreSQL JDBC
driver `42.7.1`, and a Cloudinary account.

**Android app:** Android Studio Hedgehog (2023.1)+ with SDK 34, and a device or emulator on API 24+.
Gradle 8.4 comes via the wrapper.

> **Cloudinary is required.** Images and signatures are stored in Cloudinary, not in the database.
> The `placeholder` defaults let the stack boot, but every flow that uploads an image — creating a
> return, confirming pickup, warehouse receiving — fails until real credentials are set.

---

## 1. Docker — macOS / Linux

```bash
cp infra/.env.example infra/.env     # then fill in the values below
make build
make up
make logs                            # ready when you see: Deployed "ROOT.war"
```

`infra/.env` needs real values for `POSTGRES_PASSWORD` and the three `CLOUDINARY_*` variables. The
`change_me_in_production` and `placeholder` defaults are not valid.

First boot takes about a minute: Compose waits for the PostgreSQL healthcheck before starting the
server, and WildFly then deploys `ROOT.war`.

```bash
curl -sI http://localhost:8080/login.xhtml | head -1   # expect: HTTP/1.1 200 OK
```

### Makefile targets

| Target | Effect |
|---|---|
| `make build` | Build the Docker images |
| `make up` | Start all services in the background |
| `make down` | Stop services, keep volumes |
| `make logs` | Tail server logs |
| `make shell` | Open a bash shell inside the server container |
| `make clean` | Delete containers **and volumes** (including the database), then `mvn clean` |

### The `dev.sh` script

Day-to-day tasks the Makefile does not cover. Run `./dev.sh help` for the full list.

| Task | Effect |
|---|---|
| `./dev.sh up` / `down` / `nuke` | Start / stop / wipe volumes (fresh DB from schema + seed) |
| `./dev.sh docker:rebuild` | Recompile the WAR, rebuild the image, recreate the container |
| `./dev.sh server:restart` | Restart the server container only — fast, no rebuild |
| `./dev.sh app:reinstall` | Rebuild the APK, install it on the connected device, launch it |
| `./dev.sh app:logcat` | Stream logcat for the app process only |
| `./dev.sh logs:server` | Follow the WildFly log |
| `./dev.sh logs:debug [n]` | Fetch the last `n` remote debug log entries (default 50) |
| `./dev.sh logs:clear` | Empty the debug-log buffer |

`dev.sh` requires bash, so on Windows it only runs under Git Bash or WSL.

---

## 2. Docker — Windows

`make` is not present on a stock Windows install and `dev.sh` is a bash script, so run the
`docker compose` commands the Makefile wraps. The result is identical.

```powershell
Copy-Item infra\.env.example infra\.env
notepad infra\.env

docker compose -f infra\docker-compose.yml --env-file infra\.env build
docker compose -f infra\docker-compose.yml --env-file infra\.env up -d
docker compose -f infra\docker-compose.yml --env-file infra\.env logs -f server

(Invoke-WebRequest -UseBasicParsing http://localhost:8080/login.xhtml).StatusCode   # expect: 200
```

### `make` ↔ PowerShell equivalents

| `make` (macOS/Linux) | PowerShell (Windows) |
|---|---|
| `make build` | `docker compose -f infra\docker-compose.yml --env-file infra\.env build` |
| `make up` | `docker compose -f infra\docker-compose.yml --env-file infra\.env up -d` |
| `make down` | `docker compose -f infra\docker-compose.yml --env-file infra\.env down` |
| `make logs` | `docker compose -f infra\docker-compose.yml --env-file infra\.env logs -f server` |
| `make shell` | `docker compose -f infra\docker-compose.yml --env-file infra\.env exec server /bin/bash` |
| `make clean` | `docker compose -f infra\docker-compose.yml --env-file infra\.env down -v --remove-orphans` |

> With Git for Windows installed, Git Bash runs `make` and `./dev.sh` unchanged — provided `make`
> itself is installed (e.g. `choco install make`).

---

## 3. Local install — macOS

### Step 1 — Install the tools

```bash
brew install openjdk@17 maven postgresql@15
brew services start postgresql@15
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
```

### Step 2 — Create the database and load the schema

```bash
psql -d postgres -c "CREATE USER drb WITH PASSWORD 'drb_secret';"
psql -d postgres -c "CREATE DATABASE drb OWNER drb;"

psql -U drb -d drb -f database/schema.sql   # tables and indexes
psql -U drb -d drb -f database/seed.sql     # sample data
```

Order matters: `schema.sql` creates the tables, `seed.sql` fills them.

### Step 3 — Install WildFly

```bash
curl -L -o /tmp/wildfly-36.0.1.Final.zip \
  https://github.com/wildfly/wildfly/releases/download/36.0.1.Final/wildfly-36.0.1.Final.zip
unzip -q /tmp/wildfly-36.0.1.Final.zip -d ~/
export WILDFLY_HOME=~/wildfly-36.0.1.Final
```

### Step 4 — Install the JDBC driver **as a module**

This is the step that most often goes wrong. `infra/wildfly/configure-datasource.cli` registers the
driver with `driver-module-name=org.postgresql`, so **copying the jar into `deployments/` does not
work** — it must be a WildFly module with a `module.xml` next to it:

```bash
mkdir -p "$WILDFLY_HOME/modules/org/postgresql/main"

curl -L -o "$WILDFLY_HOME/modules/org/postgresql/main/postgresql-42.7.1.jar" \
  https://jdbc.postgresql.org/download/postgresql-42.7.1.jar

cp infra/wildfly/standalone-snippet.xml \
  "$WILDFLY_HOME/modules/org/postgresql/main/module.xml"
```

> Despite its filename, `infra/wildfly/standalone-snippet.xml` is a **JBoss module descriptor**
> (`<module xmlns="urn:jboss:module:1.9" name="org.postgresql">`), not a `standalone.xml` fragment.
> It is the same file `server/Dockerfile` copies to `modules/org/postgresql/main/module.xml`.
>
> **Keep the jar named `postgresql-42.7.1.jar`** — `module.xml` pins that exact name in
> `<resource-root path="postgresql-42.7.1.jar"/>`.

### Step 5 — Register the datasource

```bash
"$WILDFLY_HOME/bin/jboss-cli.sh" --file=infra/wildfly/configure-datasource.cli
```

> The script opens with `embed-server`, so it runs **offline** against the config file itself.
> **WildFly must be stopped** while it runs, and do not add `--connect`.

It registers the JDBC driver, creates the `DrbDS` datasource under the JNDI name `java:/jdbc/DrbDS`,
and removes WildFly's built-in "Welcome" handler bound to `/` — without that removal it shadows
`ROOT.war` and the browser shows the WildFly splash instead of the login page.

### Step 6 — Set environment variables

The datasource stores `${env.*}` expressions resolved **at runtime**, so these must be set in the
same shell that launches WildFly:

```bash
export DB_HOST=localhost DB_PORT=5432 DB_NAME=drb
export POSTGRES_USER=drb POSTGRES_PASSWORD=drb_secret
export CLOUDINARY_CLOUD_NAME=your_cloud_name
export CLOUDINARY_API_KEY=your_api_key
export CLOUDINARY_API_SECRET=your_api_secret
```

### Step 7 — Build and deploy the WAR

```bash
mvn -pl server -am clean package
cp server/target/server-1.0-SNAPSHOT.war "$WILDFLY_HOME/standalone/deployments/ROOT.war"
```

> **The name `ROOT.war` is mandatory.** It is what makes the context root `/`, so screens live at
> `http://localhost:8080/login.xhtml` and the API at `http://localhost:8080/api`. Any other name adds
> a path prefix and breaks both the UI links and the Android app's API base URL.

### Step 8 — Start

```bash
"$WILDFLY_HOME/bin/standalone.sh"
```

Ready when the log prints `Deployed "ROOT.war"`. Add `-b 0.0.0.0` to make it reachable from a
physical Android device on the LAN.

---

## 4. Local install — Windows

The same eight steps in PowerShell, run from the repo root.

### Step 1 — Install the tools

1. JDK 17 — e.g. [Eclipse Temurin 17](https://adoptium.net/temurin/releases/?version=17)
2. Maven 3.9+ — https://maven.apache.org/download.cgi, add its `bin` to `PATH`
3. PostgreSQL 15 — EDB installer from https://www.postgresql.org/download/windows/, then add
   `C:\Program Files\PostgreSQL\15\bin` to `PATH`

### Step 2 — Create the database and load the schema

```powershell
psql -U postgres -c "CREATE USER drb WITH PASSWORD 'drb_secret';"
psql -U postgres -c "CREATE DATABASE drb OWNER drb;"

$env:PGPASSWORD = "drb_secret"
psql -U drb -d drb -f database\schema.sql
psql -U drb -d drb -f database\seed.sql
```

### Step 3 — Install WildFly

```powershell
Invoke-WebRequest -Uri "https://github.com/wildfly/wildfly/releases/download/36.0.1.Final/wildfly-36.0.1.Final.zip" `
  -OutFile "$env:USERPROFILE\wildfly.zip"
Expand-Archive -Path "$env:USERPROFILE\wildfly.zip" -DestinationPath "$env:USERPROFILE"
$env:WILDFLY_HOME = "$env:USERPROFILE\wildfly-36.0.1.Final"
```

### Step 4 — Install the JDBC driver **as a module**

```powershell
New-Item -ItemType Directory -Force -Path "$env:WILDFLY_HOME\modules\org\postgresql\main"

Invoke-WebRequest -Uri "https://jdbc.postgresql.org/download/postgresql-42.7.1.jar" `
  -OutFile "$env:WILDFLY_HOME\modules\org\postgresql\main\postgresql-42.7.1.jar"

Copy-Item infra\wildfly\standalone-snippet.xml `
  "$env:WILDFLY_HOME\modules\org\postgresql\main\module.xml"
```

### Step 5 — Register the datasource

```powershell
& "$env:WILDFLY_HOME\bin\jboss-cli.bat" --file=infra\wildfly\configure-datasource.cli
```

**WildFly must be stopped** — the script runs offline via `embed-server`.

### Step 6 — Set environment variables

In PowerShell, `$env:` variables live **only in the current window**. Set them in the same window
that will launch `standalone.bat`:

```powershell
$env:DB_HOST = "localhost"; $env:DB_PORT = "5432"; $env:DB_NAME = "drb"
$env:POSTGRES_USER = "drb"; $env:POSTGRES_PASSWORD = "drb_secret"
$env:CLOUDINARY_CLOUD_NAME = "your_cloud_name"
$env:CLOUDINARY_API_KEY    = "your_api_key"
$env:CLOUDINARY_API_SECRET = "your_api_secret"
```

> To persist across windows:
> `[Environment]::SetEnvironmentVariable("DB_NAME","drb","User")`, then open a new window.

### Step 7 — Build and deploy the WAR

```powershell
mvn -pl server -am clean package
Copy-Item server\target\server-1.0-SNAPSHOT.war `
  "$env:WILDFLY_HOME\standalone\deployments\ROOT.war"
```

### Step 8 — Start

```powershell
& "$env:WILDFLY_HOME\bin\standalone.bat"
```

On first start Windows Defender Firewall prompts for Java — allow it, otherwise port 8080 is
blocked and the Android app cannot connect.

---

## The database

The schema is hand-written, not generated: `persistence.xml` sets `hibernate.hbm2ddl.auto=validate`,
so Hibernate only checks that entity mappings match the existing tables. A mismatch between an
entity and `database/schema.sql` fails the deployment.

Under Docker, `docker-compose.yml` mounts both files into the PostgreSQL init directory:

| Repo file | Name inside the container |
|---|---|
| `database/schema.sql` | `/docker-entrypoint-initdb.d/01_schema.sql` |
| `database/seed.sql` | `/docker-entrypoint-initdb.d/02_seed.sql` |

PostgreSQL runs them alphabetically — tables first, then sample data — and **only when the volume is
completely empty**. If `postgres_data` already exists the init scripts are skipped:

```bash
make clean   # deletes containers and the volume, including all data
make up      # fresh volume → schema then seed run again
```

There is no volume in the local install, so both files are loaded by hand (Step 2 of sections 3/4).

### `database/migrations/`

Alongside `schema.sql`, which always represents the current state, `database/migrations/` targets
existing databases you do not want to drop. It currently holds one file:

- `001-add-version.sql` — adds `version BIGINT NOT NULL DEFAULT 0` to `return_requests`, backing the
  JPA `@Version` optimistic lock that prevents conflicting updates to the same return.

The column is already in `schema.sql`, so a fresh database does not need it.

---

## Android app

The app is **multi-role**: after login, `NavigationHelper` routes `DRIVER` users to the pickup flow
and `WAREHOUSE` users to the storekeeper flow (receiving queue, scan, inspection).

The API base URL comes from the `drbApiBaseUrl` Gradle property, injected as
`BuildConfig.API_BASE_URL`. It **must** end with `/api/`.

| Device | Correct value |
|---|---|
| Emulator | `http://10.0.2.2:8080/api/` — the emulator's alias for the host's localhost |
| Physical device | The computer's LAN IP, e.g. `http://192.168.1.50:8080/api/` |

> **Important:** `android-driver-app/gradle.properties` ships with a hardcoded LAN address from the
> original dev machine. **It will not work anywhere else.** Edit that line, or override it at build
> time as shown below.

```bash
cd android-driver-app
./gradlew installDebug -PdrbApiBaseUrl=http://10.0.2.2:8080/api/      # Windows: .\gradlew.bat
```

Or open `android-driver-app` in Android Studio and press **Run**. On first launch, allow the
**Camera** permission — it is used for barcode scanning and photos.

For a physical device the phone and server must be on the same Wi-Fi and port 8080 open in the
firewall. Docker Compose already binds `0.0.0.0:8080`; for a local WildFly run, start it with
`-b 0.0.0.0`.

---

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_DB` / `DB_NAME` | Database name | `drb` |
| `POSTGRES_USER` | Database username | `drb` |
| `POSTGRES_PASSWORD` | Database password | — must set |
| `DB_HOST` / `DB_PORT` | Database host and port (local install) | `localhost` / `5432` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | — uploads fail without it |
| `CLOUDINARY_API_KEY` | Cloudinary API key | — uploads fail without it |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | — uploads fail without it |

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Browser shows "Welcome to WildFly" instead of the login page | The default `/` handler was not removed, or the WAR is not named `ROOT.war`. Run `configure-datasource.cli` (its last line removes the handler) and check the deployment filename |
| Server fails to start with a Hibernate schema-validation error | The database is on an old schema. Docker: `make clean && make up` — initdb only runs on an **empty** volume, so `make up` alone will not fix it. Local: re-run `schema.sql` and `seed.sql` |
| `JNDI datasource not found` / `org.postgresql module not found` | The JDBC driver was not installed as a module, `module.xml` is missing, or the jar is not named `postgresql-42.7.1.jar`. See Step 4 |
| `jboss-cli` fails on the datasource script | WildFly is running. The script uses `embed-server` and needs the server stopped |
| Datasource registers but the PostgreSQL connection fails | `DB_*` / `POSTGRES_*` were not set in the shell that launched WildFly. In PowerShell, `$env:` vars live only in the current window |
| The database error clearly comes from a different PostgreSQL (e.g. `Postgres.app failed to verify "trust" authentication`) | **Two PostgreSQL servers on the same port.** A local install (Postgres.app, Homebrew) binds `127.0.0.1:5432` only, while Docker binds all interfaces — so `localhost` reaches the local install and the container is shadowed. Stop one, change the port mapping in `infra/docker-compose.yml`, or point `DB_HOST` at the machine's LAN IP. Check with `lsof -nP -iTCP:5432 -sTCP:LISTEN` |
| Image or signature upload returns 400 | Cloudinary credentials are still `placeholder`. Set all three and restart |
| Android app shows a network error on login | Wrong `drbApiBaseUrl`. Emulator: `http://10.0.2.2:8080/api/`. Physical device: the host's LAN IP, WildFly started with `-b 0.0.0.0`, port 8080 open |
| Port 8080 already in use | Change the port mapping in `infra/docker-compose.yml`, or start WildFly with `-Djboss.http.port=8081` |
