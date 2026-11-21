# syntax=docker/dockerfile:1

# --- Stage 1: Build frontend ---
FROM node:26.13.1 AS frontend
WORKDIR /app/client


COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# --- Build Stage ---
FROM eclipse-temurin:25-jdk-alpine AS backend
WORKDIR /app

# Copy Gradle configuration first for dependency caching.
COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle gradle
COPY server/build.gradle.kts server/
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew :server:dependencies --no-daemon

# Copy sources, run tests explicitly, then build the uberjar
COPY server/src server/src

# Inject built frontend into the Micronaut static-resources folder (classpath:static)
COPY --from=frontend /app/client/dist server/src/main/resources/static

# Explicit test gate (fails build if tests fail)
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew :server:test --no-daemon

RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew :server:shadowJar -x test --no-daemon

# --- Runtime Stage ---
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app

RUN addgroup -S app && adduser -S -G app app

COPY --from=backend --chown=app:app /app/server/build/libs/server-1.0-SNAPSHOT-all.jar app.jar

EXPOSE 8080

USER app

ENTRYPOINT ["java", "-XX:InitialRAMPercentage=25.0", "-XX:MaxRAMPercentage=75.0", "-XX:+UseG1GC", "-jar", "app.jar"]
