import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESET_SQL = path.join(ROOT, 'database', 'reset.sql');

const EMPLOYEE = { viewer: 1, editor: 2 };
const TICKET = { normal: 101, other: 102, noSource: 103, archived: 104, missing: 999999 };
const SOURCE = { phone: 1, portal: 2, staff: 3 };

function resetDb() {
    const r = spawnSync(
        'docker',
        ['compose', 'exec', '-T', 'db', 'psql', '-U', 'assessment', '-d', 'airnet_assessment'],
        { input: fs.readFileSync(RESET_SQL), cwd: ROOT }
    );
    assert.equal(r.status, 0, r.stderr?.toString());
}

async function login(role) {
    const res = await fetch(`${BASE}/api/demo/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    assert.equal(res.status, 200, `login failed: ${res.status} ${JSON.stringify(data)}`);
    const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    assert.ok(cookie, 'login returned no session cookie');
    assert.ok(data.csrf, 'login returned no csrf token');
    return async (method, p, body) => {
        const r = await fetch(`${BASE}/api${p}`, {
            method,
            headers: { 'Content-Type': 'application/json', cookie, 'X-CSRF-Token': data.csrf },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        let json = null;
        try { json = await r.json(); } catch {}
        return { status: r.status, json, contentType: r.headers.get('content-type') };
    };
}

const list = c => c('GET', '/tickets');
const open = (c, id) => c('GET', `/tickets/${id}`);
const setSource = (c, id, sourceId, extra = {}) =>
    c('POST', `/tickets/${id}/source`, { source_id: sourceId, ...extra });
const setRaw = (c, id, body) => c('POST', `/tickets/${id}/source`, body);
const historyOf = async (c, id) => (await open(c, id)).json.history;
const ticketOf = async (c, id) => (await open(c, id)).json.ticket;

beforeEach(resetDb);

test('no session returns 401 json', async () => {
    const r = await fetch(`${BASE}/api/tickets`);
    assert.equal(r.status, 401);
    assert.match(r.headers.get('content-type'), /json/);
    await r.json();
});

test('viewer can read list, card and history', async () => {
    const v = await login('viewer');
    const l = await list(v);
    assert.equal(l.status, 200);
    assert.ok(Array.isArray(l.json.tickets));
    const card = await open(v, TICKET.normal);
    assert.equal(card.status, 200);
    assert.equal(card.json.ticket.id, TICKET.normal);
    assert.ok(Array.isArray(card.json.history));
});

test('viewer cannot change source and nothing is written', async () => {
    const v = await login('viewer');
    const ticketBefore = await ticketOf(v, TICKET.normal);
    const historyBefore = await historyOf(v, TICKET.normal);
    const r = await setSource(v, TICKET.normal, SOURCE.portal, {
        permissions: ['FUNC_TICKETS_SOURCE_EDIT'],
        role: 'editor',
    });
    assert.equal(r.status, 403);
    assert.match(r.contentType, /json/);
    assert.deepEqual(await ticketOf(v, TICKET.normal), ticketBefore);
    assert.deepEqual(await historyOf(v, TICKET.normal), historyBefore);
});

test('viewer gets 403 even with invalid body or missing or archived ticket', async () => {
    const v = await login('viewer');
    assert.equal((await setSource(v, TICKET.normal, 'junk')).status, 403);
    assert.equal((await setSource(v, TICKET.missing, 'junk')).status, 403);
    assert.equal((await setSource(v, TICKET.archived, 'junk')).status, 403);
    assert.equal((await setRaw(v, TICKET.normal, {})).status, 403);
});

test('ticket without source returns 200 and source null', async () => {
    const v = await login('viewer');
    const r = await open(v, TICKET.noSource);
    assert.equal(r.status, 200);
    assert.ok('source' in r.json.ticket);
    assert.equal(r.json.ticket.source, null);
});

test('list contains ticket without source', async () => {
    const v = await login('viewer');
    const l = await list(v);
    assert.equal(l.status, 200);
    const row = l.json.tickets.find(t => t.id === TICKET.noSource);
    assert.ok(row);
    assert.equal(row.source_name, null);
});

test('card of ticket with source has id and name', async () => {
    const v = await login('viewer');
    const t = await ticketOf(v, TICKET.normal);
    assert.deepEqual(t.source, { id: SOURCE.phone, name: 'Телефон' });
});

test('editor change succeeds and card, list and history reflect it', async () => {
    const e = await login('editor');
    const r = await setSource(e, TICKET.normal, SOURCE.portal);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.ticket.source, { id: SOURCE.portal, name: 'Личный кабинет' });
    assert.equal(r.json.history.length, 1);
    assert.deepEqual((await ticketOf(e, TICKET.normal)).source, { id: SOURCE.portal, name: 'Личный кабинет' });
    const row = (await list(e)).json.tickets.find(t => t.id === TICKET.normal);
    assert.equal(row.source_name, 'Личный кабинет');
    assert.equal((await historyOf(e, TICKET.normal)).length, 1);
});

test('editor can set source on ticket without source', async () => {
    const e = await login('editor');
    const r = await setSource(e, TICKET.noSource, SOURCE.portal);
    assert.equal(r.status, 200);
    assert.equal(r.json.ticket.source.id, SOURCE.portal);
    const h = await historyOf(e, TICKET.noSource);
    assert.equal(h.length, 1);
    assert.equal(h[0].old_source_id, null);
    assert.equal(h[0].new_source_id, SOURCE.portal);
});

test('history comes from session user, not client fields', async () => {
    const e = await login('editor');
    const r = await setSource(e, TICKET.normal, SOURCE.portal, {
        employee_id: 1,
        employee_name: 'Hacker',
        user_id: 1,
        user_name: 'Hacker',
    });
    assert.equal(r.status, 200);
    const h = await historyOf(e, TICKET.normal);
    assert.equal(h.length, 1);
    assert.equal(h[0].employee_id, EMPLOYEE.editor);
    assert.equal(h[0].employee_name, 'Илья Учебный');
    assert.doesNotMatch(JSON.stringify(h[0]), /Hacker/);
});

test('history is ordered newest first', async () => {
    const e = await login('editor');
    await setSource(e, TICKET.normal, SOURCE.portal);
    await setSource(e, TICKET.normal, SOURCE.staff);
    const h = await historyOf(e, TICKET.normal);
    assert.equal(h.length, 2);
    assert.equal(h[0].new_source_id, SOURCE.staff);
    assert.equal(h[1].new_source_id, SOURCE.portal);
});

test('archived ticket is still readable', async () => {
    const v = await login('viewer');
    const r = await open(v, TICKET.archived);
    assert.equal(r.status, 200);
    assert.equal(r.json.ticket.status, 'archived');
});

test('missing ticket returns 404 json on update and on read', async () => {
    const e = await login('editor');
    const u = await setSource(e, TICKET.missing, SOURCE.portal);
    assert.equal(u.status, 404);
    assert.match(u.contentType, /json/);
    const g = await open(e, TICKET.missing);
    assert.equal(g.status, 404);
    assert.match(g.contentType, /json/);
});

test('invalid source values return 400', async () => {
    const e = await login('editor');
    const bad = [
        { source_id: String(SOURCE.portal) },
        { source_id: 1.5 },
        { source_id: 2.0000001 },
        { source_id: null },
        { source_id: 0 },
        { source_id: -1 },
        { source_id: 999999 },
        { source_id: true },
        { source_id: false },
        { source_id: [] },
        { source_id: [SOURCE.portal] },
        { source_id: {} },
        { source_id: '' },
        {},
        { sourceId: SOURCE.portal },
    ];
    for (const body of bad) {
        const r = await setRaw(e, TICKET.normal, body);
        assert.equal(r.status, 400, JSON.stringify(body));
        assert.match(r.contentType, /json/);
    }
});

test('invalid input does not change data', async () => {
    const e = await login('editor');
    const before = await ticketOf(e, TICKET.normal);
    await setSource(e, TICKET.normal, 999999);
    await setSource(e, TICKET.normal, String(SOURCE.portal));
    await setSource(e, TICKET.normal, null);
    assert.deepEqual(await ticketOf(e, TICKET.normal), before);
    assert.equal((await historyOf(e, TICKET.normal)).length, 0);
});

test('malformed json body returns 400 json', async () => {
    const e = await login('editor');
    const r = await e('POST', `/tickets/${TICKET.normal}/source`, undefined);
    assert.equal(r.status, 400);
    assert.match(r.contentType, /json/);
});

test('error responses do not leak internals', async () => {
    const e = await login('editor');
    for (const r of [
        await setSource(e, TICKET.normal, 999999),
        await setSource(e, TICKET.missing, SOURCE.portal),
        await setSource(e, TICKET.archived, SOURCE.portal),
    ]) {
        assert.doesNotMatch(JSON.stringify(r.json), /pg_|SQLSTATE|Stack trace|\.php|Exception/i);
    }
});

test('parallel different updates keep history consistent with final source', async () => {
    const e = await login('editor');
    await Promise.all([
        setSource(e, TICKET.normal, SOURCE.portal),
        setSource(e, TICKET.normal, SOURCE.staff),
    ]);
    const t = await ticketOf(e, TICKET.normal);
    const h = await historyOf(e, TICKET.normal);
    assert.equal(h.length, 2);
    assert.equal(h[0].new_source_id, t.source.id);
    let current = SOURCE.phone;
    for (const row of [...h].reverse()) {
        assert.equal(row.old_source_id, current);
        current = row.new_source_id;
    }
});

test('changing one ticket does not affect another', async () => {
    const e = await login('editor');
    const before = await ticketOf(e, TICKET.other);
    await setSource(e, TICKET.normal, SOURCE.portal);
    assert.deepEqual(await ticketOf(e, TICKET.other), before);
    assert.equal((await historyOf(e, TICKET.other)).length, 0);
});