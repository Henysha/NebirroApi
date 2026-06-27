import axios, { AxiosInstance } from 'axios';

export interface NebirroApiClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

export interface CreatePartnerInput {
  name: string;
  email: string;
}

export interface CreateCustomerInput {
  email: string;
  name: string;
  metadata?: Record<string, unknown>;
}

export interface CreateWalletInput {
  customerId?: string;
  financialAccountId?: string;
  name: string;
  currency: string;
}

export interface FundWalletInput {
  walletId: string;
  amount: number;
  currency: string;
  description?: string;
  idempotencyKey?: string;
}

export interface CreateTransferInput {
  sourceWalletId: string;
  destinationWalletId: string;
  amount: number;
  currency: string;
  description?: string;
  idempotencyKey?: string;
}

export class NebirroApiClient {
  private readonly http: AxiosInstance;

  constructor(options: NebirroApiClientOptions) {
    this.http = axios.create({
      baseURL: options.baseUrl ?? 'http://localhost:3000/api',
      headers: options.apiKey ? { 'x-api-key': options.apiKey } : undefined,
    });
  }

  async createPartner(input: CreatePartnerInput) {
    const response = await this.http.post('/partners', input);
    return response.data;
  }

  async createCustomer(input: CreateCustomerInput) {
    const response = await this.http.post('/customers', input);
    return response.data;
  }

  async createWallet(input: CreateWalletInput) {
    const response = await this.http.post('/wallets', input);
    return response.data;
  }

  async fundWallet(input: FundWalletInput) {
    const response = await this.http.post(
      `/wallets/${input.walletId}/fund`,
      {
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      },
      this.idempotencyHeaders(input.idempotencyKey),
    );
    return response.data;
  }

  async createTransfer(input: CreateTransferInput) {
    const response = await this.http.post(
      '/transfers',
      {
        sourceWalletId: input.sourceWalletId,
        destinationWalletId: input.destinationWalletId,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
      },
      this.idempotencyHeaders(input.idempotencyKey),
    );
    return response.data;
  }

  async getWalletBalance(walletId: string) {
    const response = await this.http.get(`/wallets/${walletId}/balance`);
    return response.data;
  }

  async getWalletLedger(walletId: string) {
    const response = await this.http.get(`/wallets/${walletId}/ledger`);
    return response.data;
  }

  async listWebhookEvents() {
    const response = await this.http.get('/webhook-events');
    return response.data;
  }

  private idempotencyHeaders(idempotencyKey?: string) {
    return idempotencyKey
      ? {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      : undefined;
  }
}
