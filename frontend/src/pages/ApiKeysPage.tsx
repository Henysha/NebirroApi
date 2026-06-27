import { FormEvent, useEffect, useState } from 'react';
import { Card, SectionTitle } from '../components/Card';
import { Button, Field, Input, Select } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { api, getErrorMessage } from '../lib/api';
import { maskApiKey, useApiKey } from '../lib/auth';
import { formatDate } from '../lib/format';
import { ApiKeyRecord, Partner } from '../lib/types';

const SELECTED_PARTNER_STORAGE_KEY = 'nebirro_selected_partner_id';

export function ApiKeysPage() {
  const { apiKey, setActiveApiKey } = useApiKey();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [partnerId, setPartnerId] = useState(() => localStorage.getItem(SELECTED_PARTNER_STORAGE_KEY) ?? '');
  const [name, setName] = useState('Dashboard key');
  const [plaintextKey, setPlaintextKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPartners() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get<Partner[]>('/partners');
        setPartners(response.data);
        setPartnerId((current) => {
          if (current && response.data.some((partner) => partner.id === current)) {
            return current;
          }

          return response.data[0]?.id || '';
        });
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    void loadPartners();
  }, []);

  useEffect(() => {
    async function loadKeys() {
      if (!partnerId) {
        localStorage.removeItem(SELECTED_PARTNER_STORAGE_KEY);
        setApiKeys([]);
        return;
      }

      localStorage.setItem(SELECTED_PARTNER_STORAGE_KEY, partnerId);

      try {
        const response = await api.get<ApiKeyRecord[]>(`/partners/${partnerId}/api-keys`);
        setApiKeys(response.data);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      }
    }

    void loadKeys();
  }, [partnerId]);

  async function createApiKey(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setPlaintextKey('');
    try {
      const response = await api.post<ApiKeyRecord & { key: string }>(`/partners/${partnerId}/api-keys`, { name });
      setPlaintextKey(response.data.key);
      const list = await api.get<ApiKeyRecord[]>(`/partners/${partnerId}/api-keys`);
      setApiKeys(list.data);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Authentication"
        title="API Keys"
        description="Issue partner API keys, copy the plaintext key once, and use it to unlock partner-facing endpoints."
      />
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <SectionTitle title="Create API key" detail="The plaintext key is only shown immediately after creation." />
          {loading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} /> : null}
          <form className="space-y-4" onSubmit={createApiKey}>
            <Field label="Partner">
              <Select data-testid="api-key-partner-select" value={partnerId} onChange={(event) => setPartnerId(event.target.value)} required>
                <option value="">Select partner</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>{partner.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Key name">
              <Input data-testid="api-key-name-input" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Button data-testid="create-api-key-submit" type="submit" disabled={saving || !partnerId}>{saving ? 'Creating...' : 'Create API key'}</Button>
          </form>
          {plaintextKey ? (
            <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-sm font-bold text-emerald-50">Plaintext key returned once</p>
              <code data-testid="api-key-plaintext" className="mt-2 block break-all rounded-lg border border-emerald-300/20 bg-slate-950 p-3 text-xs font-semibold text-emerald-100">{plaintextKey}</code>
              <Button
                className="mt-3"
                type="button"
                variant="secondary"
                onClick={() => setActiveApiKey(plaintextKey)}
              >
                Use as active API key
              </Button>
            </div>
          ) : null}
          <p className="mt-5 text-xs font-medium text-slate-300">Active key: {maskApiKey(apiKey)}</p>
        </Card>
        <Card>
          <SectionTitle title="Masked API keys" detail={`${apiKeys.length} keys for selected partner`} />
          {!apiKeys.length ? <EmptyState message="Select a partner or create an API key." /> : null}
          {apiKeys.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/90 text-xs uppercase tracking-wide text-slate-200">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Prefix</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {apiKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="px-4 py-3 font-medium text-white">{key.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{key.keyPrefix}...</td>
                      <td className="px-4 py-3"><StatusBadge value={key.status} /></td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(key.lastUsedAt)}</td>
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
