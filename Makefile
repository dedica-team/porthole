.DEFAULT_GOAL := help

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD  := \033[1m
RESET := \033[0m
GREEN := \033[32m
CYAN  := \033[36m

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT        := $(shell pwd)
SERVER_DIR  := $(ROOT)/server
CLIENT_DIR  := $(ROOT)/client
MVN         := $(shell [ -f "$(ROOT)/mvnw" ] && echo "$(ROOT)/mvnw" || echo "mvn")
NPM         := npm

# ── Docker ────────────────────────────────────────────────────────────────────
IMAGE_NAME  := porthole
IMAGE_TAG   := latest
CONTAINER   := porthole

# ── Environment ───────────────────────────────────────────────────────────────
ENV_FILE := $(ROOT)/.env
ifneq (,$(wildcard $(ENV_FILE)))
  include $(ENV_FILE)
  export $(shell sed 's/=.*//' $(ENV_FILE) | grep -v '^#' | grep -v '^$$')
endif

# ── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  $(BOLD)$(CYAN)Porthole – available targets$(RESET)"
	@echo ""
	@echo "  $(GREEN)Setup$(RESET)"
	@echo "    make setup          Install all dependencies (server + client)"
	@echo "    make setup-server   Install Maven wrapper & resolve dependencies"
	@echo "    make setup-client   npm install in client"
	@echo ""
	@echo "  $(GREEN)Development$(RESET)"
	@echo "    make dev            Start server + client in parallel"
	@echo "    make dev-server     Start Micronaut dev server"
	@echo "    make dev-client     Start Vite dev server"
	@echo ""
	@echo "  $(GREEN)Testing$(RESET)"
	@echo "    make test           Run all tests (server + client)"
	@echo "    make test-server    Run Maven tests"
	@echo "    make test-client    Run client-side tests"
	@echo ""
	@echo "  $(GREEN)Build$(RESET)"
	@echo "    make build          Build server JAR + client dist"
	@echo "    make build-server   Maven package (skip tests)"
	@echo "    make build-client   Vite production build"
	@echo ""
	@echo "  $(GREEN)Docker$(RESET)"
	@echo "    make docker-build   Build the Docker image ($(IMAGE_NAME):$(IMAGE_TAG))"
	@echo "    make docker-run     Run the container on port 8080"
	@echo "    make docker-stop    Stop & remove the running container"
	@echo "    make docker-logs    Tail logs of the running container"
	@echo "    make docker-shell   Open a shell inside the running container"
	@echo ""
	@echo "  $(GREEN)Utilities$(RESET)"
	@echo "    make clean                Remove build artefacts"
	@echo "    make lint-client          ESLint check on client"
	@echo "    make kill-kotlin-daemons  Kill stale Kotlin daemons (fixes 'Failed connecting to daemon')"
	@echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: setup
setup: setup-server setup-client
	@echo "$(GREEN)✓ Setup complete$(RESET)"

.PHONY: setup-server
setup-server:
	@echo "$(BOLD)→ Setting up server…$(RESET)"
	@if [ ! -f "$(ROOT)/mvnw" ] && command -v mvn >/dev/null 2>&1; then \
		cd $(ROOT) && mvn -N wrapper:wrapper -q && echo "  Maven wrapper created"; \
	fi
	cd $(ROOT) && $(MVN) dependency:resolve --quiet

.PHONY: setup-client
setup-client:
	@echo "$(BOLD)→ Installing client dependencies…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) install

# ─────────────────────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: dev
dev:
	@echo "$(BOLD)→ Starting server and client (Ctrl+C to stop both)…$(RESET)"
	@trap 'kill 0' INT; \
	  $(MAKE) dev-server & \
	  $(MAKE) dev-client & \
	  wait

.PHONY: dev-server
dev-server:
	@echo "$(BOLD)→ Starting Micronaut dev server…$(RESET)"
	cd $(ROOT) && PORTHOLE_JWT_SECRET=$${PORTHOLE_JWT_SECRET:-porthole-super-secret-key-change-in-production-must-be-256-bits!!} \
	  $(MVN) mn:run -pl server

.PHONY: dev-client
dev-client:
	@echo "$(BOLD)→ Starting Vite dev server…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) run dev

# ─────────────────────────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: test
test: test-server test-client
	@echo "$(GREEN)✓ All tests passed$(RESET)"

.PHONY: test-server
test-server:
	@echo "$(BOLD)→ Running server tests…$(RESET)"
	cd $(ROOT) && $(MVN) test

.PHONY: test-client
test-client:
	@echo "$(BOLD)→ Running client tests…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) test

# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: build
build: build-server build-client
	@echo "$(GREEN)✓ Build complete$(RESET)"

.PHONY: build-server
build-server:
	@echo "$(BOLD)→ Building server JAR…$(RESET)"
	cd $(ROOT) && $(MVN) package -DskipTests

.PHONY: build-client
build-client:
	@echo "$(BOLD)→ Building client…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) run build

# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: lint-client
lint-client:
	@echo "$(BOLD)→ Linting client…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) run lint

.PHONY: clean
clean:
	@echo "$(BOLD)→ Cleaning build artefacts…$(RESET)"
	cd $(ROOT) && $(MVN) clean
	rm -rf $(CLIENT_DIR)/dist $(CLIENT_DIR)/node_modules/.vite
	@echo "$(GREEN)✓ Clean complete$(RESET)"

.PHONY: kill-kotlin-daemons
kill-kotlin-daemons:
	@echo "$(BOLD)→ Killing stale Kotlin compiler daemons (not IntelliJ)…$(RESET)"
	@pkill -f "kotlin-build-tools-impl.*KotlinCompileDaemon" 2>/dev/null || true
	@rm -f $(HOME)/.local/share/kotlin/daemon/*.run
	@echo "$(GREEN)✓ Kotlin daemons cleared$(RESET)"

# ─────────────────────────────────────────────────────────────────────────────
# Docker
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: docker-build
docker-build:
	@echo "$(BOLD)→ Building Docker image $(IMAGE_NAME):$(IMAGE_TAG)…$(RESET)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) $(ROOT)
	@echo "$(GREEN)✓ Image built: $(IMAGE_NAME):$(IMAGE_TAG)$(RESET)"

.PHONY: docker-run
docker-run:
	@echo "$(BOLD)→ Starting container $(CONTAINER) on port 8080…$(RESET)"
	docker run -d --name $(CONTAINER) -p 8080:8080 \
	  $(if $(wildcard $(ENV_FILE)),--env-file $(ENV_FILE),) \
	  -e PORTHOLE_ALLOWED_ORIGINS=http://localhost:8080 \
	  $(IMAGE_NAME):$(IMAGE_TAG)
	@echo "$(GREEN)✓ Container started – http://localhost:8080$(RESET)"

.PHONY: docker-stop
docker-stop:
	@echo "$(BOLD)→ Stopping container $(CONTAINER)…$(RESET)"
	docker stop $(CONTAINER) 2>/dev/null || true
	docker rm   $(CONTAINER) 2>/dev/null || true
	@echo "$(GREEN)✓ Container stopped & removed$(RESET)"

.PHONY: docker-logs
docker-logs:
	docker logs -f $(CONTAINER)

.PHONY: docker-shell
docker-shell:
	docker exec -it $(CONTAINER) /bin/sh

