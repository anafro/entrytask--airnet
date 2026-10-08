# Запуск без Docker

Нужны PHP 7.4 с расширением pgsql, Node.js 24, npm, Python 3 для smoke-проверки
и PostgreSQL 16. Node и PHP устанавливать на хост при Docker-запуске не нужно.

Создайте отдельного пользователя `assessment` и БД `airnet_assessment`.
Пароль для этого вымышленного окружения — `assessment_demo`.
API допускает только эту БД на localhost либо сервисе `db`.

Из корня проекта примените SQL к новой пустой БД:

```sh
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=airnet_assessment PGUSER=assessment PGPASSWORD=assessment_demo
psql -v ON_ERROR_STOP=1 -f database/001_schema.sql
psql -v ON_ERROR_STOP=1 -f database/002_seed.sql
```

В первом терминале из корня проекта:

```sh
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=airnet_assessment PGUSER=assessment PGPASSWORD=assessment_demo
export DEMO_LATENCY=1 PHP_CLI_SERVER_WORKERS=4
php -S 127.0.0.1:8080 -t backend/public backend/public/router.php
```

Во втором терминале:

```sh
cd frontend
npm ci
npm run dev
```

Откройте http://localhost:5173. Для проверки сборки выполните `npm run build`
из frontend. Для сброса данных: `psql -v ON_ERROR_STOP=1 -f database/reset.sql`.

PHP workers не поддерживаются встроенным сервером на Windows: для
воспроизведения параллельных запросов используйте Docker или WSL.
Не заменяйте PHP 7.4 на PHP 8 при проверке совместимости решения.
