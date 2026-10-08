CREATE TABLE employees (
    id integer PRIMARY KEY,
    name text NOT NULL,
    role text NOT NULL UNIQUE
);
CREATE TABLE employee_functions (
    employee_id integer NOT NULL REFERENCES employees(id),
    function_name text NOT NULL,
    PRIMARY KEY(employee_id, function_name)
);
CREATE TABLE sources (
    id integer PRIMARY KEY,
    name text NOT NULL UNIQUE
);
CREATE TABLE tickets (
    id integer PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    status text NOT NULL CHECK(status IN ('incoming', 'active', 'archived')),
    source_id integer REFERENCES sources(id),
    updated_at timestamp with time zone NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE ticket_history (
    id bigserial PRIMARY KEY,
    ticket_id integer NOT NULL REFERENCES tickets(id),
    employee_id integer NOT NULL REFERENCES employees(id),
    old_source_id integer REFERENCES sources(id),
    new_source_id integer NOT NULL REFERENCES sources(id),
    created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ticket_history_ticket_id_idx ON ticket_history(ticket_id, id);
