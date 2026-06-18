# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml .
COPY server/pom.xml server/
RUN mvn -pl server -am dependency:go-offline -q
COPY server/src server/src
RUN mvn -pl server -am package -DskipTests -q

# ---- Runtime stage ----
FROM quay.io/wildfly/wildfly:36.0.1.Final-jdk17

# Install PostgreSQL JDBC driver as WildFly module
# NOTE: do NOT name this JDBC_URL — Render injects service env vars as build
# args, and the runtime JDBC_URL (jdbc:postgresql://...) would clobber it.
ARG JDBC_DRIVER_URL=https://jdbc.postgresql.org/download/postgresql-42.7.1.jar
USER root
RUN mkdir -p /opt/jboss/wildfly/modules/org/postgresql/main
ADD ${JDBC_DRIVER_URL} /opt/jboss/wildfly/modules/org/postgresql/main/postgresql-42.7.1.jar
COPY infra/wildfly/standalone-snippet.xml /opt/jboss/wildfly/modules/org/postgresql/main/module.xml
COPY infra/wildfly/configure-datasource.cli /tmp/configure-datasource.cli
RUN /opt/jboss/wildfly/bin/jboss-cli.sh --file=/tmp/configure-datasource.cli
# Drop artifacts the embedded CLI run left behind so they don't conflict at
# runtime (stale logs and a non-empty config-history "current" dir).
RUN rm -rf /opt/jboss/wildfly/standalone/configuration/standalone_xml_history \
           /opt/jboss/wildfly/standalone/log/*
# Hand the whole install back to the runtime user; root-owned files otherwise
# break startup under USER jboss.
RUN chown -R jboss:jboss /opt/jboss/wildfly
USER jboss

# Deploy WAR
COPY --chown=jboss:jboss --from=build /workspace/server/target/server-1.0-SNAPSHOT.war /opt/jboss/wildfly/standalone/deployments/digital-returns-bridge.war

EXPOSE 8080 9990
CMD ["/opt/jboss/wildfly/bin/standalone.sh", "-b", "0.0.0.0", "-bmanagement", "0.0.0.0"]
