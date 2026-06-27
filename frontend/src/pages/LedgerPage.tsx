import { useEffect, useMemo, useState } from 'react';
import { Card, SectionTitle } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { LedgerBadge } from '../components/StatusBadge';
import { api, getErrorMessage } from '../lib/api';
import { useApiKey } from '../lib/auth';
import { formatDate, formatMoney } from '../lib/format';
import { LedgerEntry, Wallet } from '../lib/types';

export function LedgerPage() {
  const { apiKey } = useApiKey();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadLedger() {
      if (!apiKey) {
        setWallets([]);
        setEntries([]);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const walletResponse = await api.get<Wallet[]>('/wallets');
        const ledgerResponses = await Promise.all(
          walletResponse.data.map((wallet) => api.get<LedgerEntry[]>(`/wallets/${wallet.id}/ledger`)),
        );
        setWallets(walletResponse.data);
        setEntries(ledgerResponses.flatMap((response) => response.data));
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    void loadLedger();
  }, [apiKey]);

  const walletNames = useMemo(
    () => new Map(wallets.map((wallet) => [wallet.id, wallet.name])),
    [wallets],
  );

  return (
    <section>
      <PageHeader
        eyebrow="Ledger"
        title="Ledger Entries"
        description="A consolidated view of append-only CREDIT and DEBIT entries across active partner wallets."
      />
      {!apiKey ? <ErrorState message="Paste or create an API key before viewing ledger entries." /> : null}
      <Card className="mt-6">
        <SectionTitle title="Append-only ledger" detail={`${entries.length} entries`} />
        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !entries.length ? <EmptyState message="No ledger entries yet. Fund or transfer between wallets." /> : null}
        {entries.length ? (
          <div data-testid="ledger-table" className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/90 text-xs uppercase tracking-wide text-slate-200">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Wallet</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Transfer</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3"><LedgerBadge type={entry.type} /></td>
                    <td className="px-4 py-3 text-white">{walletNames.get(entry.walletId) ?? entry.walletId}</td>
                    <td className="px-4 py-3 text-white">{formatMoney(entry.amount, entry.currency)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{entry.transferId ?? 'None'}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDate(entry.createdAt)}</td>
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
