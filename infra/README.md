# Infrastructure & Deployment Guide

> **WARNING**: This workspace authors these infrastructure files but does NOT run them.
> The database, Docker, and WildFly server are NOT provisioned in this workspace.
> Run `make up` in YOUR OWN environment after following the setup steps below.

## Prerequisites

- Docker Desktop 24+ and Docker Compose v2
- Java 17 (for local Maven build verification only)
- Maven 3.9+ (for local build verification only)
- A Cloudinary account — **required**, not optional. Image and signature handling
  now depends on it (product catalog images, multi-image service documentation, and
  the drawn driver + service-rep signatures). The free tier is sufficient.

## Quick Start

1. **Clone the repository**
   ```
   git clone <repo-url>
   cd digital-returns-bridge
   ```

2. **Configure environment variables**
   ```
   cp infra/.env.example infra/.env
   # Edit infra/.env with your real Cloudinary credentials and DB password
   nano infra/.env
   ```

3. **Build and start**
   ```
   make build
   make up
   ```

4. **Verify startup**
   - Web UI: http://localhost:8080/login.xhtml
   - Check logs: `make logs`

> **Mobile client note:** the single Android app serves BOTH field drivers
> (`DRIVER` role) and warehouse storekeepers (`WAREHOUSE` role) — it was
> previously driver-only. Role-based routing is entirely client-side; the app
> talks to the same server and endpoints, so this stack needs no additional
> infra to support storekeepers.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_DB` | Database name | `drb` |
| `POSTGRES_USER` | Database user | `drb` |
| `POSTGRES_PASSWORD` | Database password | change in .env |
| `JDBC_URL` | Full JDBC connection URL | auto-constructed |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name — **required** (see note below) | placeholder |
| `CLOUDINARY_API_KEY` | Cloudinary API key — **required** | placeholder |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret — **required** | placeholder |

> **Cloudinary is required for core flows.** The placeholder defaults let the
> stack boot, but any flow that uploads or reads an image will fail until real
> credentials are supplied: product catalog images, multi-image service
> documentation, and the drawn signatures for the driver and the service rep.
> Set the three `CLOUDINARY_*` values in `infra/.env` before running real returns.

## Makefile Targets

| Target | Description |
|---|---|
| `make build` | Build the Docker images |
| `make up` | Start all services in background |
| `make down` | Stop all services |
| `make logs` | Tail server logs |
| `make shell` | Open shell in server container |
| `make clean` | Remove containers, volumes, and Maven artifacts |

## Database Initialization

`docker-compose.yml` mounts the two database files into the postgres container's
`/docker-entrypoint-initdb.d`. PostgreSQL runs them **alphabetically, and ONLY on a
fresh data volume (first init)**:
- `01_schema.sql` (← `database/schema.sql`) — creates all tables and indexes
- `02_seed.sql` (← `database/seed.sql`) — inserts sample data

There are no migrations: the app is not live, so `schema.sql` and `seed.sql` always
represent the latest desired state. **The catch:** initdb scripts are skipped
entirely when the `postgres_data` volume already exists. To pick up schema changes
you must re-initialize on a fresh volume (see below).

> **Compose path note:** the mount and build paths in `docker-compose.yml` are
> relative to `infra/` (the compose file's own directory), since `make` runs
> `docker compose -f infra/docker-compose.yml` without `--project-directory`. That
> is why they are written as `../database/schema.sql` / `../database/seed.sql` and
> `context: ..` — all resolve to the repo root. Verify with
> `docker compose -f infra/docker-compose.yml config`.

## Re-initializing the Database (after schema changes)

Because initdb only runs on a fresh volume, a plain `make up` on an existing volume
leaves the database on the old schema. The server then fails to deploy because
Hibernate runs with `hibernate.hbm2ddl.auto=validate` (`persistence.xml`): the
entity mappings expect the latest columns and schema validation aborts startup.
Reset the volume to replay `01_schema.sql` → `02_seed.sql` on a clean volume:

```
make clean   # docker compose down -v: removes containers AND the postgres_data volume
make up      # fresh volume → initdb runs schema then seed
```

To drop only the database volume without the full `make clean`:

```
docker compose -f infra/docker-compose.yml down -v
# or target just the named volume (project prefix may differ):
docker volume rm $(docker compose -f infra/docker-compose.yml config --volumes | grep postgres_data)
```

To apply the schema to an already-running database without dropping data, run the
files manually (note `schema.sql` uses plain `CREATE TABLE`, so it errors if the
tables already exist):

```
# from the repo root, with the stack running
psql "postgresql://drb:${POSTGRES_PASSWORD}@localhost:5432/drb" -f database/schema.sql
psql "postgresql://drb:${POSTGRES_PASSWORD}@localhost:5432/drb" -f database/seed.sql

# or inside the postgres container (no local psql needed):
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < database/schema.sql
```

After re-initializing, restart the server so Hibernate re-validates against the new
schema: `docker compose -f infra/docker-compose.yml restart server` (or
`make down && make up`).

## Troubleshooting

- **Server fails to start with a Hibernate schema-validation error** (e.g. "missing
  column", "wrong column type", unknown `item_condition`/`warehouse_decision` value):
  the database is on an old schema. This is the classic "existing volume" case —
  follow the **Re-initializing the Database** section above. A plain `make up` on an
  existing volume will NOT fix it; initdb only runs on a fresh volume.
- **Server fails to start**: Check that PostgreSQL health check passes (`make logs` and look for `DataSource`).
- **Cloudinary uploads fail**: Verify the `CLOUDINARY_*` env vars hold real credentials in `infra/.env` — the placeholder defaults will fail. These are required for catalog images, service documentation images, and the driver/service-rep signatures.
- **Port 8080 in use**: Change the `ports` mapping in `infra/docker-compose.yml`.
- **"JNDI datasource not found"**: The `configure-datasource.cli` may need to be re-applied; re-run `make clean && make up`.
