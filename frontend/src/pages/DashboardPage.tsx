import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { ErrorState, LoadingState } from '../components/States';
import { api, getErrorMessage } from '../lib/api';
import { useApiKey } from '../lib/auth';
import { Customer, Partner, Transfer, Wallet, WebhookEvent } from '../lib/types';

interface Summary {
  partners: number;
  customers: number;
  wallets: number;
  transfers: number;
  webhookEvents: number;
}

export function DashboardPage() {
  const { apiKey } = useApiKey();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      setError('');
      try {
        const partners = await api.get<Partner[]>('/partners');
        const [customers, wallets, transfers, webhookEvents] = apiKey
          ? await Promise.all([
              api.get<Customer[]>('/customers'),
              api.get<Wallet[]>('/wallets'),
              api.get<Transfer[]>('/transfers'),
              api.get<WebhookEvent[]>('/webhook-events'),
            ])
          : [
              { data: [] as Customer[] },
              { data: [] as Wallet[] },
              { data: [] as Transfer[] },
              { data: [] as WebhookEvent[] },
            ];

        setSummary({
          partners: partners.data.length,
          customers: customers.data.length,
          wallets: wallets.data.length,
          transfers: transfers.data.length,
          webhookEvents: webhookEvents.data.length,
        });
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    void loadSummary();
  }, [apiKey]);

  const stats = [
    { label: 'Total partners', value: summary?.partners ?? 0 },
    { label: 'Total customers', value: summary?.customers ?? 0 },
    { label: 'Total wallets', value: summary?.wallets ?? 0 },
    { label: 'Total transfers', value: summary?.transfers ?? 0 },
    { label: 'Total webhook events', value: summary?.webhookEvents ?? 0 },
  ];

  return (
    <section>
      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-8 shadow-2xl shadow-black/25">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-indigo-200">
          Trusted capital networks
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Build programmable money movement with wallets, ledgers, transfers, and webhooks.
        </h1>
        <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-200">
          NebirroAPI gives partners a Stripe-style infrastructure layer for creating customers,
          issuing wallets, funding balances, moving value, and receiving event callbacks.
        </p>
      </div>

      {!apiKey ? (
        <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-400/15 p-4 text-sm font-semibold leading-6 text-amber-50">
          Add an active API key in the top bar to load partner-scoped customers, wallets, transfers, and webhooks.
        </div>
      ) : null}

      <div className="mt-8">
        {loading ? <LoadingState label="Loading platform summary..." /> : null}
        {error ? <ErrorState message={error} /> : null}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="text-sm font-semibold text-slate-200">{stat.label}</div>
            <div className="mt-2 text-2xl font-semibold">{stat.value}</div>
          </Card>
        ))}
      </div>
    </section>
  );
}
