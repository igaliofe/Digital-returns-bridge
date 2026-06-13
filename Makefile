COMPOSE := docker compose -f infra/docker-compose.yml --env-file infra/.env

.PHONY: build up down logs shell clean

build:
	$(COMPOSE) build

up:
	cp -n infra/.env.example infra/.env 2>/dev/null || true
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f server

shell:
	$(COMPOSE) exec server /bin/bash

clean:
	$(COMPOSE) down -v --remove-orphans
	mvn -pl server -am clean -q
