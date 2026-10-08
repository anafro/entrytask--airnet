import React, { useEffect, useState } from 'react';
import { api } from './api.js';

export default function TicketPanel({ employee, selectedId, sources, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [history, setHistory] = useState([]);
  const [sourceId, setSourceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!selectedId) {
      setTicket(null);
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    api(`/tickets/${selectedId}`).then(data => {
      setTicket(data.ticket);
      setHistory(data.history);
      setSourceId(String(data.ticket.source?.id ?? ''));
    }).catch(error => setError(error.message)).finally(() => setLoading(false));
  }, [selectedId]);

  async function save() {
    if (!ticket || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await api(`/tickets/${ticket.id}/source`, { method: 'POST', body: JSON.stringify({ source_id: Number(sourceId) }) });
      setTicket(data.ticket);
      setHistory(data.history);
      setMessage('Источник сохранён');
      onChanged(data.ticket);
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  const canEdit = employee.permissions.includes('FUNC_TICKETS_SOURCE_EDIT') && ticket?.status !== 'archived';
  const sourceName = id => sources.find(source => source.id === id)?.name ?? 'Не указан';

  return <section className="ticket-panel" aria-label="Карточка заявки">
    {!selectedId && <div className="empty"><h2>Выберите заявку</h2><p>Карточка и история изменений появятся здесь.</p></div>}
    {selectedId && loading && <p role="status" className="muted">Загрузка карточки…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {selectedId && !loading && ticket && <>
      <div className="panel-heading"><span className="muted">Заявка #{ticket.id}</span><h2>{ticket.title}</h2><p>{ticket.description}</p></div>
      <div className="source-box"><label htmlFor="source">Источник заявки</label>
        {canEdit ? <div className="source-controls"><select id="source" value={sourceId} onChange={event => setSourceId(event.target.value)} disabled={saving}><option value="" disabled>Выберите источник</option>{sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select><button onClick={save} disabled={saving || !sourceId}>{saving ? 'Сохранение…' : 'Сохранить'}</button></div> : <p>{ticket.source?.name ?? 'Не указан'}</p>}
        {ticket.status === 'archived' && <p className="muted">Архивная заявка доступна только для чтения.</p>}
        {message && <p className="success" role="status">{message}</p>}
      </div>
      <div className="history"><h3>История изменения источника</h3>{history.length === 0 ? <p className="muted">Изменений пока нет.</p> : <ol>{history.map(item => <li key={item.id}><strong>{item.employee_name}</strong><p>{sourceName(item.old_source_id)} → {sourceName(item.new_source_id)}</p><time>{new Date(item.created_at).toLocaleString('ru-RU')}</time></li>)}</ol>}</div>
    </>}
  </section>;
}
