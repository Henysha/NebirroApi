const API_BASE_URL = process.env.NEBIRRO_API_URL ?? 'http://localhost:3000/api';
const DEMO_RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const USD = 'USD';

interface ApiResource {
  id: string;
  [key: string]: unknown;
}

interface Partner extends ApiResource {
  name: string;
}

interface Customer extends ApiResource {
  name: string;
}

interface Wallet extends ApiResource {
  name: string;
}

interface Transfer extends ApiResource {
  amount: number;
}

interface LedgerEntry extends ApiResource {
  walletId: string;
  transferId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  currency: string;
}

interface Balance {
  walletId: string;
  currency: string;
  balance: number;
}

interface WebhookEvent extends ApiResource {
  transferId: string;
  type: string;
  status: string;
}

interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T>;
}

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: unknown,
  ) {
    super(message);
  }
}

async function main() {
  console.log('\nNebirroAPI Demo Flow');
  console.log('Programmable financial infrastructure for trusted capital networks');
  console.log(`API: ${API_BASE_URL}\n`);

  const publicApi = createApiClient();
  await verifyApiIsRunning(publicApi);

  const partner = await createPartner(publicApi);
  logSuccess('Partner created', `${partner.name} (${partner.id})`);

  const apiKeyResponse = await publicApi.post<{ key: string }>(`/partners/${partner.id}/api-keys`, {
    name: 'Portfolio demo API key',
  });
  const apiKey = apiKeyResponse.key;
  logSuccess('API key created', `${maskKey(apiKey)} returned once as plaintext`);

  const api = createApiClient(apiKey);

  const customerA = await createCustomer(api, 'Ava Capital');
  const customerB = await createCustomer(api, 'Bex Treasury');
  logSuccess('Customers created', `${customerA.name} and ${customerB.name}`);

  const walletA = await createWallet(api, customerA.id, 'Ava Operating Wallet');
  const walletB = await createWallet(api, customerB.id, 'Bex Receiving Wallet');
  logSuccess('Wallets created', `${walletA.name} (${walletA.id}) and ${walletB.name} (${walletB.id})`);

  const funding = await api.post<Transfer>(
    `/wallets/${walletA.id}/fund`,
    {
      amount: 10000,
      currency: USD,
      description: 'Demo initial funding',
    },
    {
      'Idempotency-Key': `demo-fund-${DEMO_RUN_ID}`,
    },
  );
  logSuccess('Wallet funded', `${formatMoney(funding.amount)} credited to ${walletA.name}`);

  const initialBalanceA = await getBalance(api, walletA.id);
  logSuccess('Wallet A balance', formatBalance(initialBalanceA));

  const transferPayload = {
    sourceWalletId: walletA.id,
    destinationWalletId: walletB.id,
    amount: 2750,
    currency: USD,
    description: 'Demo wallet-to-wallet transfer',
  };
  const transferIdempotencyKey = `demo-transfer-${DEMO_RUN_ID}`;

  const transfer = await api.post<Transfer>('/transfers', transferPayload, {
    'Idempotency-Key': transferIdempotencyKey,
  });
  logSuccess('Transfer completed', `${transfer.id} moved ${formatMoney(transfer.amount)}`);

  const balanceAAfterTransfer = await getBalance(api, walletA.id);
  const balanceBAfterTransfer = await getBalance(api, walletB.id);
  logSuccess('Wallet A balance after transfer', formatBalance(balanceAAfterTransfer));
  logSuccess('Wallet B balance after transfer', formatBalance(balanceBAfterTransfer));

  const walletALedger = await getLedger(api, walletA.id);
  const walletBLedger = await getLedger(api, walletB.id);
  const sourceDebit = findLedgerEntry(walletALedger, transfer.id, 'DEBIT');
  const destinationCredit = findLedgerEntry(walletBLedger, transfer.id, 'CREDIT');

  logSuccess(
    'Source wallet DEBIT',
    `${sourceDebit.id} debited ${formatMoney(sourceDebit.amount)} from ${walletA.name}`,
  );
  logSuccess(
    'Destination wallet CREDIT',
    `${destinationCredit.id} credited ${formatMoney(destinationCredit.amount)} to ${walletB.name}`,
  );

  const webhookEvents = await api.get<WebhookEvent[]>('/webhook-events');
  const transferWebhook = webhookEvents.find((event) => event.transferId === transfer.id);

  if (!transferWebhook) {
    throw new Error(`Expected webhook event for transfer ${transfer.id}`);
  }

  logSuccess(
    'Webhook event created',
    `${transferWebhook.type} (${transferWebhook.id}) status=${transferWebhook.status}`,
  );

  const repeatTransfer = await api.post<Transfer>('/transfers', transferPayload, {
    'Idempotency-Key': transferIdempotencyKey,
  });
  const walletALedgerAfterRepeat = await getLedger(api, walletA.id);
  const walletBLedgerAfterRepeat = await getLedger(api, walletB.id);
  const duplicateSourceEntries = walletALedgerAfterRepeat.filter(
    (entry) => entry.transferId === transfer.id && entry.type === 'DEBIT',
  );
  const duplicateDestinationEntries = walletBLedgerAfterRepeat.filter(
    (entry) => entry.transferId === transfer.id && entry.type === 'CREDIT',
  );

  if (
    repeatTransfer.id !== transfer.id ||
    duplicateSourceEntries.length !== 1 ||
    duplicateDestinationEntries.length !== 1
  ) {
    throw new Error('Idempotency check failed: duplicate transfer or ledger entries detected');
  }

  logSuccess(
    'Idempotency prevented duplicate transfer',
    `Repeated request returned ${repeatTransfer.id}; source debits=${duplicateSourceEntries.length}, destination credits=${duplicateDestinationEntries.length}`,
  );

  console.log('\nDemo complete. NebirroAPI flow is working end-to-end.\n');
}

function createApiClient(apiKey?: string): ApiClient {
  return {
    get: <T>(path: string) => apiRequest<T>(path, { apiKey }),
    post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
      apiRequest<T>(path, {
        apiKey,
        body,
        headers,
        method: 'POST',
      }),
  };
}

async function apiRequest<T>(
  path: string,
  options: {
    apiKey?: string;
    body?: unknown;
    headers?: Record<string, string>;
    method?: 'GET' | 'POST';
  } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(options.apiKey ? { 'x-api-key': options.apiKey } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const responseBody = await parseJsonResponse(response);

  if (!response.ok) {
    throw new ApiRequestError(
      `Request failed: ${response.status} ${response.statusText} ${path}`,
      response.status,
      responseBody,
    );
  }

  return responseBody as T;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function verifyApiIsRunning(api: ApiClient) {
  try {
    const health = await api.get<{ service: string; status: string }>('/health');
    logSuccess('Backend healthy', `${health.service} status=${health.status}`);
  } catch {
    throw new Error(
      `NebirroAPI is not reachable at ${API_BASE_URL}. Start it with: docker compose up -d postgres backend`,
    );
  }
}

async function createPartner(api: ApiClient): Promise<Partner> {
  return api.post<Partner>('/partners', {
    name: `Demo Capital Network ${DEMO_RUN_ID}`,
    email: `demo-partner-${DEMO_RUN_ID}@example.com`,
  });
}

async function createCustomer(api: ApiClient, name: string): Promise<Customer> {
  return api.post<Customer>('/customers', {
    name,
    email: `${name.toLowerCase().replace(/\s+/g, '-')}-${DEMO_RUN_ID}@example.com`,
    metadata: {
      demoRunId: DEMO_RUN_ID,
    },
  });
}

async function createWallet(api: ApiClient, customerId: string, name: string): Promise<Wallet> {
  return api.post<Wallet>('/wallets', {
    customerId,
    name,
    currency: USD,
  });
}

async function getBalance(api: ApiClient, walletId: string): Promise<Balance> {
  return api.get<Balance>(`/wallets/${walletId}/balance`);
}

async function getLedger(api: ApiClient, walletId: string): Promise<LedgerEntry[]> {
  return api.get<LedgerEntry[]>(`/wallets/${walletId}/ledger`);
}

function findLedgerEntry(
  entries: LedgerEntry[],
  transferId: string,
  type: LedgerEntry['type'],
): LedgerEntry {
  const entry = entries.find(
    (ledgerEntry) => ledgerEntry.transferId === transferId && ledgerEntry.type === type,
  );

  if (!entry) {
    throw new Error(`Expected ${type} ledger entry for transfer ${transferId}`);
  }

  return entry;
}

function logSuccess(label: string, detail: string) {
  console.log(`[OK] ${label}: ${detail}`);
}

function maskKey(apiKey: string) {
  return `${apiKey.slice(0, 11)}...${apiKey.slice(-4)}`;
}

function formatMoney(amount: number) {
  return `$${(amount / 100).toFixed(2)} ${USD}`;
}

function formatBalance(balance: Balance) {
  return `${formatMoney(balance.balance)} in wallet ${balance.walletId}`;
}

main().catch((error: unknown) => {
  if (error instanceof ApiRequestError) {
    console.error('\nDemo failed with API error');
    console.error(`Status: ${error.status}`);
    console.error('Response:', stringifyUnknown(error.responseBody));
  } else if (error instanceof Error) {
    console.error('\nDemo failed');
    console.error(error.message);
  } else {
    console.error('\nDemo failed with an unknown error');
    console.error(stringifyUnknown(error));
  }
  process.exit(1);
});

function stringifyUnknown(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
