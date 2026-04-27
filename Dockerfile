# --- Stage 1: Build frontend ---
FROM node:22 AS frontend
WORKDIR /app/client


COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# --- Build Stage ---
FROM maven:3.9-eclipse-temurin-21-alpine AS backend
WORKDIR /app

# Copy parent pom first for dependency caching
COPY pom.xml ./
COPY server/pom.xml server/

# Download dependencies (go-offline is unreliable; resolve+resolve-plugins is more complete)
RUN mvn -pl server -am dependency:resolve dependency:resolve-plugins -q

# Copy sources, run tests explicitly, then build the uberjar
COPY server/src server/src

# Inject built frontend into Spring Boot's static-resources folder
COPY --from=frontend /app/client/dist server/src/main/resources/static

# Explicit test gate (fails build if tests fail)
RUN mvn -pl server -am test -q

RUN mvn -pl server -am package -DskipTests -q

# --- Runtime Stage ---
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S app && adduser -S -G app app

COPY --from=backend --chown=app:app /app/server/target/server-1.0-SNAPSHOT.jar app.jar

EXPOSE 8080
EXPOSE 8081

USER app

ENTRYPOINT ["java", "-XX:InitialRAMPercentage=25.0", "-XX:MaxRAMPercentage=75.0", "-XX:+UseG1GC", "-jar", "app.jar"]
