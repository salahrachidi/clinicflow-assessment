.DEFAULT_GOAL := help

NPM ?= npm
COMPOSE ?= docker compose
APP_URL ?= http://localhost:8088
API_URL ?= http://localhost:4000

.PHONY: help env install ci setup dev typecheck build test test-e2e test-all verify \
	playwright-install screenshots db-up db-down db-logs db-shell db-migrate db-seed \
	db-reset docker-config docker-build docker-up docker-down docker-restart docker-logs \
	docker-ps docker-health clean

help: ## List available project commands
	@echo "ClinicFlow commands"
	@echo
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

env: ## Create .env from .env.example when it does not exist
	@if [ -f .env ]; then echo ".env already exists"; else cp .env.example .env && echo "Created .env"; fi

install: ## Install dependencies and update the lockfile when needed
	$(NPM) install

ci: ## Install exactly the dependencies recorded in package-lock.json
	$(NPM) ci

setup: env install db-up db-migrate db-seed ## Prepare a complete local development environment

dev: ## Start the backend and frontend development servers
	$(NPM) run dev

typecheck: ## Type-check the backend and frontend
	$(NPM) run typecheck

build: ## Build production backend and frontend bundles
	$(NPM) run build

test: ## Run backend and PostgreSQL integration tests
	$(NPM) test

test-e2e: ## Run Playwright browser workflows
	$(NPM) run test:e2e

test-all: typecheck build test test-e2e ## Run every local code and test check

verify: test-all docker-config ## Run the complete pre-submission verification suite

playwright-install: ## Install the Chromium browser used by Playwright
	$(NPM) exec playwright install chromium

screenshots: ## Regenerate reviewer screenshots from the running Docker application
	APP_URL=$(APP_URL) $(NPM) run screenshots

db-up: ## Start PostgreSQL and wait until it is healthy
	$(COMPOSE) up -d --wait postgres

db-down: ## Stop the PostgreSQL container without deleting its data
	$(COMPOSE) stop postgres

db-logs: ## Follow PostgreSQL logs
	$(COMPOSE) logs -f postgres

db-shell: ## Open psql inside the PostgreSQL container
	$(COMPOSE) exec postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

db-migrate: ## Apply pending PostgreSQL migrations
	$(NPM) run db:migrate

db-seed: ## Load deterministic fictional demonstration data
	$(NPM) run db:seed

db-reset: ## Delete the Docker database volume, recreate it, migrate, and seed
	$(COMPOSE) down -v
	$(MAKE) db-up
	$(MAKE) db-migrate
	$(MAKE) db-seed

docker-config: ## Validate the resolved Docker Compose configuration
	$(COMPOSE) config --quiet

docker-build: ## Build the production frontend and backend images
	$(COMPOSE) build

docker-up: ## Build and start the complete production-style stack
	$(COMPOSE) up -d --build --wait

docker-down: ## Stop the complete stack while preserving database data
	$(COMPOSE) down

docker-restart: docker-down docker-up ## Recreate the complete stack

docker-logs: ## Follow backend and frontend container logs
	$(COMPOSE) logs -f backend frontend

docker-ps: ## Show all ClinicFlow containers and health states
	$(COMPOSE) ps -a

docker-health: ## Check the frontend proxy and backend readiness endpoints
	curl -fsS $(APP_URL)/healthz
	@echo
	curl -fsS $(API_URL)/health/ready
	@echo

clean: ## Remove generated builds, reports, and test artifacts
	rm -rf backend/dist frontend/dist playwright-report test-results

