<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);
set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});
set_exception_handler(function (Throwable $error) {
    error_log((string) $error);
    respond(500, array('error' => 'internal_error', 'message' => 'Не удалось обработать запрос'));
});
session_name('assessment_session');
session_set_cookie_params(array('httponly' => true, 'samesite' => 'Lax', 'path' => '/'));
session_start();
header('Cache-Control: no-store');

function respond($status, $data)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function db()
{
    static $connection = null;
    if ($connection !== null) {
        return $connection;
    }
    $values = array(
        'host' => getenv('PGHOST') ?: '127.0.0.1',
        'port' => getenv('PGPORT') ?: '5432',
        'dbname' => getenv('PGDATABASE') ?: 'airnet_assessment',
        'user' => getenv('PGUSER') ?: 'assessment',
        'password' => getenv('PGPASSWORD') ?: 'assessment_demo',
    );
    if ($values['dbname'] !== 'airnet_assessment' || !in_array($values['host'], array('db', 'localhost', '127.0.0.1', '::1'), true)) {
        throw new RuntimeException('Only the isolated assessment database is supported');
    }
    $parts = array();
    foreach ($values as $key => $value) {
        $parts[] = $key . "='" . str_replace(array('\\', "'"), array('\\\\', "\\'"), $value) . "'";
    }
    $connection = @pg_connect(implode(' ', $parts) . ' connect_timeout=3');
    if (!$connection) {
        throw new RuntimeException('Assessment database unavailable');
    }
    return $connection;
}

function query($sql, array $params = array())
{
    $result = @pg_query_params(db(), $sql, $params);
    if (!$result) {
        error_log(pg_last_error(db()));
        throw new RuntimeException('Database operation failed');
    }
    return $result;
}

function currentEmployee()
{
    if (empty($_SESSION['employee_id'])) {
        respond(401, array('error' => 'unauthorized', 'message' => 'Выберите учебного сотрудника'));
    }
    $employee = pg_fetch_assoc(query('SELECT id, name, role FROM employees WHERE id=$1', array($_SESSION['employee_id'])));
    if (!$employee) {
        respond(401, array('error' => 'unauthorized', 'message' => 'Сотрудник не найден'));
    }
    $employee['id'] = (int) $employee['id'];
    $employee['permissions'] = array_column(pg_fetch_all(query('SELECT function_name FROM employee_functions WHERE employee_id=$1 ORDER BY function_name', array($employee['id']))) ?: array(), 'function_name');
    return $employee;
}

function permitted(array $employee, $name)
{
    return in_array($name, $employee['permissions'], true);
}

function requirePermission(array $employee, $name)
{
    if (!permitted($employee, $name)) {
        respond(403, array('error' => 'forbidden', 'message' => 'Недостаточно прав'));
    }
}

function requireCsrf()
{
    $token = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? $_SERVER['HTTP_X_CSRF_TOKEN'] : '';
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
        respond(403, array('error' => 'csrf_invalid', 'message' => 'Обновите страницу'));
    }
}

function requestBody()
{
    try {
        $value = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $error) {
        respond(400, array('error' => 'invalid_json', 'message' => 'Ожидается JSON'));
    }
    if (!is_array($value)) {
        respond(400, array('error' => 'invalid_json', 'message' => 'Ожидается JSON-объект'));
    }
    return $value;
}
