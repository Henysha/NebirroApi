import { FormEvent, useEffect, useState } from 'react';
import { Card, SectionTitle } from '../components/Card';
import { Button, Field, Input } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api, getErrorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { Partner } from '../lib/types';

export function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState({ email: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadPartners() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Partner[]>('/partners');
      setPartners(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPartners();
  }, []);

  async function createPartner(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/partners', form);
      setForm({ email: '', name: '' });
      await loadPartners();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Onboarding"
        title="Partners"
        description="Create trusted network partners and inspect the organizations that can issue API keys."
      />
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <SectionTitle title="Create partner" detail="Partners are the top-level owner for customers, wallets, and transfers." />
          <form className="space-y-4" onSubmit={createPartner}>
            <Field label="Name">
              <Input data-testid="partner-name-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                data-testid="partner-email-input"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </Field>
            <Button data-testid="create-partner-submit" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create partner'}</Button>
          </form>
        </Card>
        <Card>
          <SectionTitle title="Partner directory" detail={`${partners.length} partners`} />
          {loading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} /> : null}
          {!loading && !partners.length ? <EmptyState message="No partners yet. Create one to begin onboarding." /> : null}
          {partners.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/90 text-xs uppercase tracking-wide text-slate-200">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {partners.map((partner) => (
                    <tr key={partner.id}>
                      <td className="px-4 py-3 font-medium text-white">{partner.name}</td>
                      <td className="px-4 py-3 text-slate-300">{partner.email}</td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(partner.createdAt)}</td>
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
