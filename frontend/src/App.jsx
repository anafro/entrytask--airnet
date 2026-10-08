import React, { useEffect, useState } from 'react';
import { api, setCsrf } from './api.js';
import TicketPanel from './TicketPanel.jsx';

const statusNames = { incoming: 'Входящая', active: 'Активная', archived: 'Архивная' };

export default function App() {
  const [employee, setEmployee] = useState(null);
  const [role, setRole] = useState('editor');
  const [tickets, setTickets] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/me').then(data => {
      setCsrf(data.csrf);
      setEmployee(data.employee);
    }).catch(error => {
      if (error.status !== 401) setError(error.message);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!employee) return;
    let active = true;
    setLoading(true);
    Promise.all([api('/tickets'), api('/sources')]).then(([list, catalog]) => {
      if (!active) return;
      setTickets(list.tickets);
      setSources(catalog.sources);
    }).catch(error => {
      if (active) setError(error.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [employee]);

  async function login() {
    setError('');
    setLoading(true);
    setSelectedId(null);
    try {
      const data = await api('/demo/login', { method: 'POST', body: JSON.stringify({ role }) });
      setCsrf(data.csrf);
      setEmployee(data.employee);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function ticketChanged(ticket) {
    setTickets(current => current.map(row => row.id === ticket.id ? { ...row, source_name: ticket.source?.name ?? null } : row));
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">A</span><div><strong>Airnet</strong><small>Учебный модуль заявок</small></div></div>
        <div className="account">
          <label htmlFor="role">Учебная роль</label>
          <select id="role" value={role} onChange={event => setRole(event.target.value)}>
            <option value="editor">Редактор</option><option value="viewer">Просмотр</option>
          </select>
          <button onClick={login} disabled={loading}>Войти</button>
        </div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!employee ? <section className="welcome"><h1>Заявки сервисной службы</h1><p>Выберите учебную роль и войдите.</p><p>Все сотрудники, адреса и заявки в этом проекте вымышлены.</p></section> : <>
        <div className="page-heading"><div><h1>Заявки сервисной службы</h1><p>{employee.name} · {employee.role === 'editor' ? 'Редактирование источника' : 'Только просмотр'}</p></div><span className="badge">{tickets.length} заявок</span></div>
        <div className="workspace">
          <section className="ticket-list" aria-label="Список заявок">
            {loading && <p className="muted">Загрузка списка…</p>}
            {tickets.map(ticket => <button className={`ticket-row ${selectedId === ticket.id ? 'selected' : ''}`} key={ticket.id} onClick={() => setSelectedId(ticket.id)} aria-pressed={selectedId === ticket.id}>
              <span className="ticket-meta">#{ticket.id}<span className={`status ${ticket.status}`}>{statusNames[ticket.status]}</span></span>
              <strong>{ticket.title}</strong><span className="muted">{ticket.source_name ?? 'Не указан'}</span>
            </button>)}
          </section>
          <TicketPanel employee={employee} selectedId={selectedId} sources={sources} onChanged={ticketChanged} />
        </div>
      </>}
    </main>
  );
}
