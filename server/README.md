# Server Module — Digital Returns Bridge

Jakarta EE 10 web application built with Maven. Provides both JSF web UI and JAX-RS REST API.

## Build

```bash
cd digital-returns-bridge
mvn -pl server -am clean package -DskipTests
# WAR: server/target/server-1.0-SNAPSHOT.war
```

## Deploy to WildFly 30

1. Download WildFly 30: https://www.wildfly.org/downloads/
2. Add PostgreSQL JDBC driver as a module (see `infra/wildfly/configure-datasource.cli`)
3. Configure datasource:
   ```bash
   $JBOSS_HOME/bin/jboss-cli.sh --connect --file=infra/wildfly/configure-datasource.cli
   ```
4. Copy WAR:
   ```bash
   cp server/target/server-1.0-SNAPSHOT.war $JBOSS_HOME/standalone/deployments/ROOT.war
   ```
5. Set environment variables before starting WildFly:
   ```bash
   export CLOUDINARY_CLOUD_NAME=your_cloud
   export CLOUDINARY_API_KEY=your_key
   export CLOUDINARY_API_SECRET=your_secret
   export DB_HOST=localhost
   export DB_PORT=5432
   export DB_NAME=drb
   export POSTGRES_USER=drb
   export POSTGRES_PASSWORD=secret
   ```
6. Start WildFly: `$JBOSS_HOME/bin/standalone.sh`
7. Access: http://localhost:8080/login.xhtml

## Database

> **The database is NOT provisioned.** Run `database/schema.sql` on a fresh PostgreSQL 15 instance.

```bash
psql -U postgres -c "CREATE DATABASE drb; CREATE USER drb WITH PASSWORD 'drb_secret';"
psql -U drb -d drb -f database/schema.sql
psql -U drb -d drb -f database/seed.sql  # optional: sample data
```

## Testing

```bash
mvn -pl server -am test
# Uses H2 in-memory DB (test scope) — no PostgreSQL needed for tests
```

## Package Structure

| Package | Contents |
|---|---|
| `com.drb.server.domain` | JPA entities |
| `com.drb.server.domain.enums` | Enumerations (ReturnStatus, UserRole, etc.) |
| `com.drb.server.repository` | DAOs (JPA EntityManager wrappers) |
| `com.drb.server.service` | Business logic services |
| `com.drb.server.cloudinary` | Cloudinary upload/delete integration |
| `com.drb.server.rest` | JAX-RS resource classes |
| `com.drb.server.rest.dto` | Request/response DTOs |
| `com.drb.server.rest.security` | Auth filter and in-memory token store |
| `com.drb.server.web` | JSF backing beans |
