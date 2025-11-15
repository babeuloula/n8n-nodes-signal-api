build:
	docker compose exec -u root n8n sh -c "npm run build"
	$(MAKE) start

link:
	docker compose exec -u root n8n sh -c "npm link"
	docker compose exec -u root n8n sh -c "mkdir -p /home/node/.n8n/custom"
	docker compose exec -u root -w "/home/node/.n8n/custom" n8n sh -c "npm link n8n-nodes-signal-api"
	$(MAKE) start

start:
	docker compose up -d --force-recreate

stop:
	docker compose stop

logs:
	docker compose logs -f

