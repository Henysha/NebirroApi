import { FormEvent, useEffect, useState } from 'react';
import { Card, SectionTitle } from '../components/Card';
import { Button, Field, Input, Select } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { api, getErrorMessage } from '../lib/api';
import { useApiKey } from '../lib/auth';
import { formatDate, formatMoney } from '../lib/format';
import { Transfer, Wallet } from '../lib/types';

export function TransfersPage() {
  const { apiKey } = useApiKey();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [form, setForm] = useState({
    amount: '2500',
    currency: 'USD',
    destinationWalletId: '',
    idempotencyKey: '',
    sourceWalletId: '',
  });
  const [latestTransfer, setLatestTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    if (!apiKey) {
      setWallets([]);
      setTransfers([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [walletResponse, transferResponse] = await Promise.all([
        api.get<Wallet[]>('/wallets'),
        api.get<Transfer[]>('/transfers'),
      ]);
      setWallets(walletResponse.data);
      setTransfers(transferResponse.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [apiKey]);

  async function createTransfer(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await api.post<Transfer>(
        '/transfers',
        {
          amount: Number(form.amount),
          currency: form.currency,
          destinationWalletId: form.destinationWalletId,
          sourceWalletId: form.sourceWalletId,
        },
        form.idempotencyKey ? { headers: { 'Idempotency-Key': form.idempotencyKey } } : undefined,
      );
      setLatestTransfer(response.data);
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Money Movement"
        title="Transfers"
        description="Move value between wallets with idempotency-key support and inspect transfer status."
      />
      {!apiKey ? <ErrorState message="Paste or create an API key before creating transfers." /> : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <SectionTitle title="Create wallet-to-wallet transfer" />
          {error ? <ErrorState message={error} /> : null}
          <form className="mt-4 space-y-4" onSubmit={createTransfer}>
            <Field label="Source wallet">
              <Select data-testid="transfer-source-wallet-select" value={form.sourceWalletId} onChange={(event) => setForm({ ...form, sourceWalletId: event.target.value })} required>
                <option value="">Select source</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Destination wallet">
              <Select data-testid="transfer-destination-wallet-select" value={form.destinationWalletId} onChange={(event) => setForm({ ...form, destinationWalletId: event.target.value })} required>
                <option value="">Select destination</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Amount in cents">
              <Input data-testid="transfer-amount-input" type="number" min={1} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
            </Field>
            <Field label="Currency">
              <Input maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} required />
            </Field>
            <Field label="Idempotency key">
              <Input data-testid="transfer-idempotency-key-input" value={form.idempotencyKey} onChange={(event) => setForm({ ...form, idempotencyKey: event.target.value })} placeholder="transfer-2026-001" />
            </Field>
            <Button data-testid="create-transfer-submit" type="submit" disabled={saving || !apiKey}>{saving ? 'Creating...' : 'Create transfer'}</Button>
          </form>
          {latestTransfer ? (
            <div data-testid="latest-transfer-status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-sm font-semibold text-emerald-50">
                Transfer {latestTransfer.id} completed for {formatMoney(latestTransfer.amount, latestTransfer.currency)}
              </p>
            </div>
          ) : null}
        </Card>
        <Card>
          <SectionTitle title="Transfer history" detail={`${transfers.length} transfers`} />
          {loading ? <LoadingState /> : null}
          {!loading && !transfers.length ? <EmptyState message="No transfers yet." /> : null}
          {transfers.length ? (
            <div data-testid="transfer-history-table" className="overflow-hidden rounded-xl border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/90 text-xs uppercase tracking-wide text-slate-200">
                  <tr>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Destination</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {transfers.map((transfer) => (
                    <tr key={transfer.id}>
                      <td className="px-4 py-3 text-white">{formatMoney(transfer.amount, transfer.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge value={transfer.status} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{transfer.sourceWalletId ?? 'Funding'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{transfer.destinationWalletId}</td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(transfer.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </div>
    </section>
  );
}
