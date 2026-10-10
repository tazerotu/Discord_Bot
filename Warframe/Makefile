IMAGE  = warframe-bot
CONTAINER = warframe-bot

.PHONY: build run stop restart logs clean rebuild

build:
	docker build -t $(IMAGE) .

run:
	docker run -d \
		--name $(CONTAINER) \
		--restart unless-stopped \
		$(IMAGE)

stop:
	docker stop $(CONTAINER)
	docker rm $(CONTAINER)

restart: stop run

logs:
	docker logs -f $(CONTAINER)

clean:
	docker stop $(CONTAINER) 2>/dev/null || true
	docker rm   $(CONTAINER) 2>/dev/null || true
	docker rmi  $(IMAGE)     2>/dev/null || true

rebuild: clean build run