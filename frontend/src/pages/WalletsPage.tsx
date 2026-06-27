import { FormEvent, useEffect, useState } from 'react';
import { Card, SectionTitle } from '../components/Card';
import { Button, Field, Input, Select } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { LedgerBadge } from '../components/StatusBadge';
import { api, getErrorMessage } from '../lib/api';
import { useApiKey } from '../lib/auth';
import { formatDate, formatMoney } from '../lib/format';
import { Balance, Customer, LedgerEntry, Wallet } from '../lib/types';

export function WalletsPage() {
  const { apiKey } = useApiKey();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [walletForm, setWalletForm] = useState({ currency: 'USD', customerId: '', name: '' });
  const [fundForm, setFundForm] = useState({ amount: '10000', description: 'Dashboard wallet funding' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    if (!apiKey) {
      setCustomers([]);
      setWallets([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [customersResponse, walletsResponse] = await Promise.all([
        api.get<Customer[]>('/customers'),
        api.get<Wallet[]>('/wallets'),
      ]);
      setCustomers(customersResponse.data);
      setWallets(walletsResponse.data);
      setWalletForm((current) => ({
        ...current,
        customerId: current.customerId || customersResponse.data[0]?.id || '',
      }));
      setSelectedWalletId((current) => current || walletsResponse.data[0]?.id || '');
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  async function loadWalletDetails(walletId: string) {
    if (!walletId) {
      setBalance(null);
      setLedger([]);
      return;
    }

    try {
      const [balanceResponse, ledgerResponse] = await Promise.all([
        api.get<Balance>(`/wallets/${walletId}/balance`),
        api.get<LedgerEntry[]>(`/wallets/${walletId}/ledger`),
      ]);
      setBalance(balanceResponse.data);
      setLedger(ledgerResponse.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  useEffect(() => {
    void loadData();
  }, [apiKey]);

  useEffect(() => {
    void loadWalletDetails(selectedWalletId);
  }, [selectedWalletId]);

  async function createWallet(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/wallets', walletForm);
      setWalletForm({ ...walletForm, name: '' });
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function fundWallet(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/wallets/${selectedWalletId}/fund`, {
        amount: Number(fundForm.amount),
        currency: balance?.currency ?? 'USD',
        description: fundForm.description,
      });
      await loadWalletDetails(selectedWalletId);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Accounts"
        title="Wallets"
        description="Create customer wallets, fund balances, inspect derived balances, and review append-only ledger entries."
      />
      {!apiKey ? <ErrorState message="Paste or create an API key before managing wallets." /> : null}
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <Card>
            <SectionTitle title="Create wallet" />
            <form className="space-y-4" onSubmit={createWallet}>
              <Field label="Customer">
                <Select
                  data-testid="wallet-customer-select"
                  value={walletForm.customerId}
                  onChange={(event) => setWalletForm({ ...walletForm, customerId: event.target.value })}
                  required
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Wallet name">
                <Input
                  data-testid="wallet-name-input"
                  value={walletForm.name}
                  onChange={(event) => setWalletForm({ ...walletForm, name: event.target.value })}
                  required
                />
              </Field>
              <Field label="Currency">
                <Input
                  maxLength={3}
                  value={walletForm.currency}
                  onChange={(event) => setWalletForm({ ...walletForm, currency: event.target.value.toUpperCase() })}
                  required
                />
              </Field>
              <Button data-testid="create-wallet-submit" type="submit" disabled={saving || !apiKey}>{saving ? 'Saving...' : 'Create wallet'}</Button>
            </form>
          </Card>
          <Card>
            <SectionTitle title="Fund wallet" detail="Amounts are in cents, matching backend ledger storage." />
            <form className="space-y-4" onSubmit={fundWallet}>
              <Field label="Wallet">
                <Select data-testid="fund-wallet-select" value={selectedWalletId} onChange={(event) => setSelectedWalletId(event.target.value)} required>
                  <option value="">Select wallet</option>
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount in cents">
                <Input
                  data-testid="fund-wallet-amount-input"
                  type="number"
                  min={1}
                  value={fundForm.amount}
                  onChange={(event) => setFundForm({ ...fundForm, amount: event.target.value })}
                  required
                />
              </Field>
              <Field label="Description">
                <Input
                  value={fundForm.description}
                  onChange={(event) => setFundForm({ ...fundForm, description: event.target.value })}
                />
              </Field>
              <Button data-testid="fund-wallet-submit" type="submit" disabled={saving || !selectedWalletId}>Fund wallet</Button>
            </form>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <SectionTitle title="Wallet directory" detail={`${wallets.length} wallets`} />
            {loading ? <LoadingState /> : null}
            {error ? <ErrorState message={error} /> : null}
            {!loading && !wallets.length ? <EmptyState message="No wallets for the active API key." /> : null}
            {wallets.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => setSelectedWalletId(wallet.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selectedWalletId === wallet.id ? 'border-indigo-300 bg-indigo-400/15' : 'border-slate-700 bg-slate-950/50 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-medium text-white">{wallet.name}</div>
                    <div className="mt-1 text-xs font-medium text-slate-300">{wallet.currency} · {wallet.id}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </Card>
          <Card>
            <SectionTitle title="Selected wallet balance" />
            {balance ? (
              <div data-testid="selected-wallet-balance" className="text-3xl font-semibold text-white">{formatMoney(balance.balance, balance.currency)}</div>
            ) : (
              <EmptyState message="Select a wallet to view balance." />
            )}
          </Card>
          <Card>
            <SectionTitle title="Selected wallet ledger" detail={`${ledger.length} entries`} />
            {!ledger.length ? <EmptyState message="No ledger entries for this wallet yet." /> : null}
            {ledger.length ? (
              <div data-testid="selected-wallet-ledger" className="overflow-hidden rounded-xl border border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/90 text-xs uppercase tracking-wide text-slate-200">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {ledger.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3"><LedgerBadge type={entry.type} /></td>
                        <td className="px-4 py-3 text-white">{formatMoney(entry.amount, entry.currency)}</td>
                        <td className="px-4 py-3 text-slate-300">{entry.description ?? 'No description'}</td>
                        <td className="px-4 py-3 text-slate-300">{formatDate(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </section>
  );
}
