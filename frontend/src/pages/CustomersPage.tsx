import { FormEvent, useEffect, useState } from 'react';
import { Card, SectionTitle } from '../components/Card';
import { Button, Field, Input } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { api, getErrorMessage } from '../lib/api';
import { useApiKey } from '../lib/auth';
import { formatDate } from '../lib/format';
import { Customer } from '../lib/types';

export function CustomersPage() {
  const { apiKey } = useApiKey();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ email: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadCustomers() {
    if (!apiKey) {
      setCustomers([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.get<Customer[]>('/customers');
      setCustomers(response.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCustomers();
  }, [apiKey]);

  async function createCustomer(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/customers', form);
      setForm({ email: '', name: '' });
      await loadCustomers();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Identity"
        title="Customers"
        description="Create customer records scoped to the active partner API key."
      />
      {!apiKey ? <ErrorState message="Paste or create an API key before managing customers." /> : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <SectionTitle title="Create customer" />
          <form className="space-y-4" onSubmit={createCustomer}>
            <Field label="Name">
              <Input data-testid="customer-name-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                data-testid="customer-email-input"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </Field>
            <Button data-testid="create-customer-submit" type="submit" disabled={saving || !apiKey}>{saving ? 'Creating...' : 'Create customer'}</Button>
          </form>
        </Card>
        <Card>
          <SectionTitle title="Customer directory" detail={`${customers.length} customers`} />
          {loading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} /> : null}
          {!loading && !customers.length ? <EmptyState message="No customers for the active API key." /> : null}
          {customers.length ? (
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
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-4 py-3 font-medium text-white">{customer.name}</td>
                      <td className="px-4 py-3 text-slate-300">{customer.email}</td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(customer.createdAt)}</td>
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
