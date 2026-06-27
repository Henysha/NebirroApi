import { expect, test } from '@playwright/test';

const apiBaseUrl = process.env.BACKEND_API_URL ?? 'http://localhost:3000/api';

test('NebirroAPI programmable financial infrastructure UI flow', async ({ page }) => {
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const partnerName = `E2E Capital Network ${runId}`;
  const partnerEmail = `e2e-partner-${runId}@example.com`;
  const customerAName = `E2E Customer A ${runId}`;
  const customerBName = `E2E Customer B ${runId}`;
  const customerAEmail = `e2e-customer-a-${runId}@example.com`;
  const customerBEmail = `e2e-customer-b-${runId}@example.com`;
  const walletAName = `E2E Wallet A ${runId}`;
  const walletBName = `E2E Wallet B ${runId}`;
  const idempotencyKey = `ui-transfer-${runId}`;

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /build programmable money movement/i })).toBeVisible();
  await expect(page.getByText('NebirroAPI', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Partners' }).click();
  await page.getByTestId('partner-name-input').fill(partnerName);
  await page.getByTestId('partner-email-input').fill(partnerEmail);
  await Promise.all([
    page.waitForResponse((response) => response.url() === `${apiBaseUrl}/partners` && response.request().method() === 'POST'),
    page.getByTestId('create-partner-submit').click(),
  ]);
  await expect(page.getByText(partnerName)).toBeVisible();

  await page.getByRole('link', { name: 'API Keys' }).click();
  await page.getByTestId('api-key-partner-select').selectOption({ label: partnerName });
  await page.getByTestId('api-key-name-input').fill(`E2E dashboard key ${runId}`);
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/api-keys') && response.request().method() === 'POST',
    ),
    page.getByTestId('create-api-key-submit').click(),
  ]);
  const plaintextKey = (await page.getByTestId('api-key-plaintext').textContent())?.trim();
  expect(plaintextKey, 'plaintext API key should be returned once').toMatch(/^nb_test_/);
  await page.getByTestId('active-api-key-input').fill(plaintextKey!);

  await page.getByRole('link', { name: 'Customers' }).click();
  await createCustomer(page, customerAName, customerAEmail);
  await createCustomer(page, customerBName, customerBEmail);
  await expect(page.getByText(customerAName)).toBeVisible();
  await expect(page.getByText(customerBName)).toBeVisible();

  await page.getByRole('link', { name: 'Wallets' }).click();
  await createWallet(page, customerAName, walletAName);
  await createWallet(page, customerBName, walletBName);
  await expect(page.getByRole('button', { name: new RegExp(walletAName) })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(walletBName) })).toBeVisible();

  await page.getByTestId('fund-wallet-select').selectOption({ label: walletAName });
  await page.getByTestId('fund-wallet-amount-input').fill('10000');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/fund') && response.request().method() === 'POST'),
    page.getByTestId('fund-wallet-submit').click(),
  ]);
  await expect(page.getByTestId('selected-wallet-balance')).toContainText('$100.00');

  await page.getByRole('link', { name: 'Transfers' }).click();
  await page.getByTestId('transfer-source-wallet-select').selectOption({ label: walletAName });
  await page.getByTestId('transfer-destination-wallet-select').selectOption({ label: walletBName });
  await page.getByTestId('transfer-amount-input').fill('2500');
  await page.getByTestId('transfer-idempotency-key-input').fill(idempotencyKey);
  await Promise.all([
    page.waitForResponse((response) => response.url() === `${apiBaseUrl}/transfers` && response.request().method() === 'POST'),
    page.getByTestId('create-transfer-submit').click(),
  ]);
  await expect(page.getByTestId('latest-transfer-status')).toContainText('completed');
  await expect(page.getByTestId('transfer-history-table')).toContainText('COMPLETED');

  await page.getByRole('link', { name: 'Ledger' }).click();
  await expect(page.getByTestId('ledger-table')).toContainText('DEBIT');
  await expect(page.getByTestId('ledger-table')).toContainText('CREDIT');

  await page.getByRole('link', { name: 'Webhook Events' }).click();
  await expect(page.getByTestId('webhook-events-table')).toContainText(/TRANSFER_COMPLETED|WALLET_FUNDED/);

  await page.getByRole('link', { name: 'Developer SDK' }).click();
  await expect(page.getByTestId('sdk-snippets')).toContainText('NebirroApiClient');
  await expect(page.getByText('createCustomer')).toBeVisible();
  await expect(page.getByText('createTransfer')).toBeVisible();
});

async function createCustomer(page: import('@playwright/test').Page, name: string, email: string) {
  await page.getByTestId('customer-name-input').fill(name);
  await page.getByTestId('customer-email-input').fill(email);
  await Promise.all([
    page.waitForResponse((response) => response.url() === `${apiBaseUrl}/customers` && response.request().method() === 'POST'),
    page.getByTestId('create-customer-submit').click(),
  ]);
}

async function createWallet(page: import('@playwright/test').Page, customerName: string, walletName: string) {
  await page.getByTestId('wallet-customer-select').selectOption({ label: customerName });
  await page.getByTestId('wallet-name-input').fill(walletName);
  await Promise.all([
    page.waitForResponse((response) => response.url() === `${apiBaseUrl}/wallets` && response.request().method() === 'POST'),
    page.getByTestId('create-wallet-submit').click(),
  ]);
}
