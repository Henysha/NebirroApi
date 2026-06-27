import { useEffect, useState } from 'react';
import { Card, SectionTitle } from '../components/Card';
import { Button } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { api, getErrorMessage } from '../lib/api';
import { useApiKey } from '../lib/auth';
import { formatDate } from '../lib/format';
import { WebhookEvent } from '../lib/types';

export function WebhookEventsPage() {
  const { apiKey } = useApiKey();
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState('');
  const [error, setError] = useState('');

  async function loadEvents() {
    if (!apiKey) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.get<WebhookEvent[]>('/webhook-events');
      setEvents(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, [apiKey]);

  async function retryEvent(id: string) {
    setRetryingId(id);
    setError('');
    try {
      await api.post(`/webhook-events/${id}/retry`);
      await loadEvents();
    } catch (retryError) {
      setError(getErrorMessage(retryError));
    } finally {
      setRetryingId('');
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Events"
        title="Webhook Events"
        description="Inspect transfer-generated webhook events and retry pending or failed deliveries."
      />
      {!apiKey ? <ErrorState message="Paste or create an API key before viewing webhook events." /> : null}
      <Card className="mt-6">
        <SectionTitle title="Event stream" detail={`${events.length} events`} />
        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !events.length ? <EmptyState message="No webhook events yet. Transfers create events automatically." /> : null}
        {events.length ? (
          <div data-testid="webhook-events-table" className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/90 text-xs uppercase tracking-wide text-slate-200">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Transfer</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-medium text-white">{event.type}</td>
                    <td className="px-4 py-3"><StatusBadge value={event.status} /></td>
                    <td className="px-4 py-3 text-slate-300">{event.attempts}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{event.transferId ?? 'None'}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDate(event.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button type="button" variant="secondary" disabled={retryingId === event.id} onClick={() => void retryEvent(event.id)}>
                        {retryingId === event.id ? 'Retrying...' : 'Retry'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
