import { Card, SectionTitle } from '../components/Card';
import { PageHeader } from '../components/PageHeader';

const snippets = [
  {
    title: 'Create customer',
    code: `const customer = await client.createCustomer({
  email: 'operator@example.com',
  name: 'Trusted Capital Operator',
});`,
  },
  {
    title: 'Create wallet',
    code: `const wallet = await client.createWallet({
  customerId: customer.id,
  name: 'Operating Wallet',
  currency: 'USD',
});`,
  },
  {
    title: 'Fund wallet',
    code: `await client.fundWallet({
  walletId: wallet.id,
  amount: 10000,
  currency: 'USD',
  idempotencyKey: 'fund-wallet-001',
});`,
  },
  {
    title: 'Create transfer',
    code: `await client.createTransfer({
  sourceWalletId: walletA.id,
  destinationWalletId: walletB.id,
  amount: 2500,
  currency: 'USD',
  idempotencyKey: 'transfer-001',
});`,
  },
  {
    title: 'Get wallet balance',
    code: `const balance = await client.getWalletBalance(wallet.id);`,
  },
  {
    title: 'List webhook events',
    code: `const events = await client.listWebhookEvents();`,
  },
];

export function DeveloperSdkPage() {
  return (
    <section>
      <PageHeader
        eyebrow="SDK"
        title="Developer SDK"
        description="TypeScript snippets for integrating with NebirroAPI as programmable financial infrastructure."
      />
      <div data-testid="sdk-snippets">
        <Card>
          <SectionTitle title="Client setup" />
          <pre className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm font-medium leading-6 text-slate-100 shadow-inner shadow-black/30">
            <code>{`import { NebirroApiClient } from '@nebirro/sdk';

const client = new NebirroApiClient({
  apiKey: 'nb_test_...',
  baseUrl: 'http://localhost:3000/api',
});`}</code>
          </pre>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {snippets.map((snippet) => (
          <Card key={snippet.title}>
            <SectionTitle title={snippet.title} />
            <pre className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm font-medium leading-6 text-slate-100 shadow-inner shadow-black/30">
              <code>{snippet.code}</code>
            </pre>
          </Card>
        ))}
      </div>
    </section>
  );
}
