export interface Partner {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  status: 'ACTIVE' | 'REVOKED';
  lastUsedAt: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  partnerId: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  partnerId: string;
  customerId: string | null;
  name: string;
  currency: string;
  createdAt: string;
}

export interface Balance {
  walletId: string;
  currency: string;
  balance: number;
}

export interface LedgerEntry {
  id: string;
  partnerId: string;
  walletId: string;
  transferId: string | null;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
}

export interface Transfer {
  id: string;
  partnerId: string;
  sourceWalletId: string | null;
  destinationWalletId: string;
  type: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  description: string | null;
  createdAt: string;
}

export interface WebhookEvent {
  id: string;
  partnerId: string;
  transferId: string | null;
  type: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  attempts: number;
  createdAt: string;
}
