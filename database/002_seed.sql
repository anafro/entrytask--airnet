INSERT INTO employees(id, name, role) VALUES
    (1, 'Анна Примерова', 'viewer'),
    (2, 'Илья Учебный', 'editor');
INSERT INTO employee_functions(employee_id, function_name) VALUES
    (1, 'FUNC_TICKETS_VIEW'),
    (2, 'FUNC_TICKETS_VIEW'),
    (2, 'FUNC_TICKETS_SOURCE_EDIT');
INSERT INTO sources(id, name) VALUES
    (1, 'Телефон'),
    (2, 'Личный кабинет'),
    (3, 'Сотрудник');
INSERT INTO tickets(id, title, description, status, source_id) VALUES
    (101, 'Не работает интернет', 'Учебная заявка: проверить подключение в квартире.', 'active', 1),
    (102, 'Настроить роутер', 'Учебная заявка: помочь с настройкой нового роутера.', 'incoming', 2),
    (103, 'Нет изображения с камеры', 'Учебная заявка: клиент не сообщил, как было создано обращение.', 'active', NULL),
    (104, 'Заменить блок питания', 'Учебная заявка: работы выполнены, заявка закрыта.', 'archived', 3),
    (105, 'Перенести точку подключения', 'Учебная заявка: согласовать удобное время работ.', 'incoming', 1);
