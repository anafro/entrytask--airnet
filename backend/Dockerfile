FROM php:7.4-cli-bullseye
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev && docker-php-ext-install pgsql && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PHP_CLI_SERVER_WORKERS=4
CMD ["php", "-d", "display_errors=0", "-S", "0.0.0.0:8080", "-t", "public", "public/router.php"]
