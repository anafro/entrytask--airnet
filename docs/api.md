# Контракт API

Все маршруты доступны через frontend по `/api`. Ответы — JSON.
Существующая реализация может нарушать требуемое поведение из README.

| Метод и путь | Результат |
|---|---|
| GET `/api/health` | `{ "status": "ok", "php": "7.4.33" }` |
| POST `/api/demo/login` | Вход: `{ "role": "editor" }` или `viewer`; ответ: `employee`, `csrf` |
| GET `/api/me` | `employee`, `csrf` |
| GET `/api/tickets` | `tickets`: массив кратких заявок |
| GET `/api/sources` | `sources`: массив `{id, name}` |
| GET `/api/tickets/101` | `ticket`, `history` |
| POST `/api/tickets/101/source` | Вход `{ "source_id": 2 }`; ответ `ticket`, `history` |

Для POST смены источника нужна cookie сессии и заголовок `X-CSRF-Token`
из ответа входа или `/api/me`. CSRF-проверка уже реализована.
Сессия определяет сотрудника и его права; клиент не назначает их себе.

`ticket`: числовой `id`, `title`, `description`, `status`, `source`, `updated_at`.
`source`: `{id, name}` либо `null`. Краткая заявка содержит `source_name`
либо `null`. Статусы: `incoming`, `active`, `archived`.

`history`: массив от новой записи к старой. Запись содержит `id`,
`employee_id`, `employee_name`, `old_source_id`, `new_source_id`, `created_at`.
`old_source_id` может быть `null`. Время — строка с часовым поясом.

Ошибка: `{ "error": "код", "message": "сообщение" }`.
Текст сообщения и конкретный код ошибки не оцениваются; важны HTTP-статус,
JSON и отсутствие изменений при отказе.

При `DEMO_LATENCY=1` карточка 101 отвечает примерно через 1100 мс,
остальные — через 100 мс. Сервер должен обслуживать запросы параллельно;
Compose запускает несколько PHP workers. Задержка не меняет бизнес-логику.
