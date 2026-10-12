// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { vi, test, expect, beforeEach, afterEach } from 'vitest';
import { api } from './api';
import TicketPanel from './TicketPanel';

vi.mock('./api', () => ({ api: vi.fn(), setCsrf: vi.fn() }));

const EDITOR = {
    id: 2,
    name: 'Илья Учебный',
    role: 'editor',
    permissions: ['FUNC_TICKETS_VIEW', 'FUNC_TICKETS_SOURCE_EDIT'],
};
const SOURCES = [
    { id: 1, name: 'Телефон' },
    { id: 2, name: 'Личный кабинет' },
];
const props = id => ({
    employee: EDITOR,
    selectedId: id,
    sources: SOURCES,
    onChanged: () => {},
});

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    promise.catch(() => {});
    return { promise, resolve, reject };
};

const card = (id, title, source = null) => ({
    ticket: {
        id,
        title,
        description: '',
        status: 'active',
        updated_at: '2026-01-01 00:00:00',
        source,
    },
    history: [],
});

let pending;

beforeEach(() => {
    pending = {};
    api.mockReset();
    api.mockImplementation(path => {
        const match = path.match(/^\/tickets\/(\d+)$/);
        if (match && pending[match[1]]) return pending[match[1]].promise;
        return Promise.reject(new Error('unexpected ' + path));
    });
});

afterEach(cleanup);

test('late response for ticket 101 does not overwrite ticket 102', async () => {
    pending[101] = deferred();
    pending[102] = deferred();

    const { rerender } = render(<TicketPanel {...props(101)} />);
    rerender(<TicketPanel {...props(102)} />);

    await act(async () => { pending[102].resolve(card(102, 'Ticket 102')); });
    await act(async () => { pending[101].resolve(card(101, 'Ticket 101')); });

    expect(screen.getByText(/Ticket 102/)).toBeInTheDocument();
    expect(screen.queryByText(/Ticket 101/)).toBeNull();
});

test('late error for ticket 101 does not replace ticket 102', async () => {
    pending[101] = deferred();
    pending[102] = deferred();

    const { rerender } = render(<TicketPanel {...props(101)} />);
    rerender(<TicketPanel {...props(102)} />);

    await act(async () => { pending[102].resolve(card(102, 'Ticket 102')); });
    await act(async () => { pending[101].reject(new Error('boom-101')); });

    expect(screen.getByText(/Ticket 102/)).toBeInTheDocument();
    expect(screen.queryByText(/boom-101/)).toBeNull();
});

test('ticket without source shows Не указан', async () => {
    pending[103] = deferred();

    render(<TicketPanel {...props(103)} />);
    await act(async () => { pending[103].resolve(card(103, 'Ticket 103', null)); });

    expect(screen.getByText('Не указан')).toBeInTheDocument();
});