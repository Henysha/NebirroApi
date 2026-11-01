import { AxiosAdapter, AxiosError, AxiosResponse } from 'axios';
export const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
type Merchant = { id: string; name: string; market: string; supplierVerified: boolean };
type Offer = { id: string; merchantId: string; commodity: string; availableKg: number; pricePerKgMinor: number };
type Trade = { id: string; buyerId: string; offerId: string; quantityKg: number; totalMinor: number; state: string; requestKey: string; events: { id: string; kind: string; evidence: string; createdAt: string }[]; paymentReference?: string; paymentProvider?: string };
type Application = { id: string; tradeId: string; merchantId: string; amountMinor: number; purpose: string; status: string; lenderId: string | null; consentedAt: string | null; consentRevokedAt: string | null; decisionReason: string | null; approvedAmountMinor: number | null };
type State = { merchants: Merchant[]; offers: Offer[]; trades: Trade[]; financingRequests: Application[]; lenders: { id: string; name: string }[] };
const STORAGE = 'nebirro-public-demo-v1';
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
function seed(): State {
  return {
    merchants: [
      { id: 'supplier', name: 'Highland Grain Supply', market: 'Ethiopia · Sample wholesale market', supplierVerified: true },
      { id: 'buyer', name: 'Aster Retail', market: 'Ethiopia · Sample retail market', supplierVerified: false },
      { id: 'supplier-2', name: 'Abay Harvest Traders', market: 'Ethiopia · Sample trading hub', supplierVerified: true },
    ],
    offers: [
      { id: 'teff', merchantId: 'supplier', commodity: 'White teff', availableKg: 900, pricePerKgMinor: 18000 },
      { id: 'wheat', merchantId: 'supplier-2', commodity: 'Wheat', availableKg: 1200, pricePerKgMinor: 6500 },
      { id: 'maize', merchantId: 'supplier', commodity: 'Maize', availableKg: 800, pricePerKgMinor: 4800 },
    ],
    trades: [{ id: 'sample-trade', buyerId: 'buyer', offerId: 'teff', quantityKg: 100, totalMinor: 1800000, state: 'AGREED', requestKey: 'sample-trade-key', events: [{ id: 'agreed', kind: 'AGREED', evidence: 'Fictional supplier purchase agreed for this demo', createdAt: now() }] }],
    financingRequests: [{ id: 'sample-application', tradeId: 'sample-trade', merchantId: 'buyer', amountMinor: 1500000, purpose: 'Restock 100 kg of white teff for the next trading cycle', status: 'SUBMITTED', lenderId: null, consentedAt: null, consentRevokedAt: null, decisionReason: null, approvedAmountMinor: null }],
    lenders: [{ id: 'lender', name: 'Horizon Finance (fictional)' }],
  };
}
let state: State;
try { const raw = sessionStorage.getItem(STORAGE); state = raw ? JSON.parse(raw) : seed(); if (!Array.isArray(state.merchants) || !Array.isArray(state.financingRequests)) state = seed(); }
catch { state = seed(); }
function persist() { try { sessionStorage.setItem(STORAGE, JSON.stringify(state)); } catch { /* Memory-only mode works when storage is unavailable. */ } window.dispatchEvent(new Event('nebirro-demo-change')); }
export function resetDemo() { state = seed(); persist(); }
export function demoProgress() { const a = state.financingRequests.find(a => a.id === 'sample-application'); return { shared: Boolean(a?.consentedAt && !a.consentRevokedAt), status: a?.status ?? 'SUBMITTED', delivered: state.trades.find(t => t.id === 'sample-trade')?.state !== 'AGREED' }; }
const required = <T,>(value: T | undefined): T => { if (!value) throw new Error('Record not found in this demo.'); return value; };
const text = (v: unknown, max = 1000) => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error('Enter a valid value.'); return v.trim(); };
const integer = (v: unknown, max = 2147483647) => { if (!Number.isInteger(v) || Number(v) <= 0 || Number(v) > max) throw new Error('Enter a positive whole number within the pilot limit.'); return Number(v); };
function merchant(id: string) { return required(state.merchants.find(m => m.id === id)); }
function offerView(o: Offer) { return { ...o, currency: 'ETB', merchant: merchant(o.merchantId) }; }
function tradeView(t: Trade) { return { ...t, currency: 'ETB', buyer: merchant(t.buyerId), offer: offerView(required(state.offers.find(o => o.id === t.offerId))) }; }
function appView(a: Application) {
  const t = required(state.trades.find(t => t.id === a.tradeId)); const o = required(state.offers.find(o => o.id === t.offerId));
  return { ...a, currency: 'ETB', merchant: { name: merchant(a.merchantId).name, market: merchant(a.merchantId).market }, lender: state.lenders.find(l => l.id === a.lenderId) ?? null,
    trade: { id: t.id, state: t.state, quantityKg: t.quantityKg, totalMinor: t.totalMinor, offer: { commodity: o.commodity, merchant: merchant(o.merchantId) } } };
}
const event = (t: Trade, kind: string, evidence: string) => t.events.push({ id: uid(), kind, evidence, createdAt: now() });
export const demoAdapter: AxiosAdapter = async config => {
  // There is deliberately no network fallback. Even unknown requests stay in this browser.
  const response = (data: unknown, status = 200): AxiosResponse => ({ data: JSON.parse(JSON.stringify(data)), status, statusText: 'Demo', headers: {}, config });
  try {
    const path = (config.url ?? '').replace(/^\/api/, '').split('?')[0];
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data ?? {};
    const method = config.method?.toUpperCase() ?? 'GET';
    let result: unknown;
    if (path.startsWith('/pilot/')) {
      const auth = config.headers.get('Authorization');
      const role = auth === 'Bearer demo-merchant' ? 'MERCHANT' : auth === 'Bearer demo-reviewer' ? 'REVIEWER' : null;
      if (!role) throw new Error('Choose a demo role to open this workspace.');
      if (path === '/pilot/workspace' && method === 'GET') return response({ role, lenders: role === 'MERCHANT' ? state.lenders : [], applications: state.financingRequests.filter(a => role === 'MERCHANT' ? a.merchantId === 'buyer' : a.lenderId === 'lender' && a.consentedAt && !a.consentRevokedAt).map(appView) });
      const match = path.match(/^\/pilot\/applications\/([^/]+)\/(consent|withdraw|review|decision)$/);
      if (!match || method !== 'POST') throw new Error('This action is not part of the public demo.');
      const a = required(state.financingRequests.find(a => a.id === match[1]));
      const action = match[2];
      const t = required(state.trades.find(t => t.id === a.tradeId));
      if (action === 'consent' || action === 'withdraw') {
        if (role !== 'MERCHANT' || a.merchantId !== 'buyer') throw new Error('Only the applicant can control sharing.');
        if (action === 'consent') {
          if (body.confirmed !== true || body.scope !== 'application-v1') throw new Error('Explicit consent is required.');
          if (a.status !== 'SUBMITTED' || (a.consentedAt && !a.consentRevokedAt) || t.state !== 'AGREED') throw new Error('This application cannot be shared in its current state.');
          required(state.lenders.find(l => l.id === body.lenderId));
          a.lenderId = body.lenderId; a.consentedAt = now(); a.consentRevokedAt = null;
        } else { a.consentRevokedAt = now(); if (a.status === 'UNDER_REVIEW') a.status = 'SUBMITTED'; }
      } else {
        if (role !== 'REVIEWER' || a.lenderId !== 'lender' || !a.consentedAt || a.consentRevokedAt) throw new Error('This application is not shared with your institution.');
        if (t.state !== 'AGREED') throw new Error('This purchase has already been delivered.');
        const supplier = merchant(required(state.offers.find(o => o.id === t.offerId)).merchantId);
        if ((action === 'review' || body.decision === 'APPROVED') && !supplier.supplierVerified) throw new Error('Supplier verification is required.');
        if (action === 'review') { if (a.status !== 'SUBMITTED') throw new Error('Application is not awaiting review.'); a.status = 'UNDER_REVIEW'; }
        else {
          if (a.status !== 'UNDER_REVIEW') throw new Error('Begin review before recording a decision.');
          const reason = text(body.reason);
          if (!['APPROVED', 'DECLINED'].includes(body.decision)) throw new Error('Choose a decision.');
          const amount = body.decision === 'APPROVED' ? integer(body.approvedAmountMinor) : null;
          if (amount !== null && (amount > a.amountMinor || amount > t.totalMinor)) throw new Error('Approval cannot exceed the requested amount or purchase total.');
          a.status = body.decision; a.decisionReason = reason; a.approvedAmountMinor = amount;
        }
      }
      result = { status: a.status };
    } else if (path.startsWith('/merchant-network')) {
      if (method === 'GET') {
        if (path === '/merchant-network') return response({ merchants: state.merchants, offers: state.offers.map(offerView), trades: state.trades.map(tradeView), financingRequests: state.financingRequests });
        if (path.endsWith('/lenders')) return response(state.lenders);
        if (path.endsWith('/access')) return response([]);
        throw new Error('Unknown demo view.');
      }
      if (method !== 'POST') throw new Error('Unsupported demo action.');
      if (state.trades.length + state.offers.length + state.merchants.length > 100) throw new Error('Demo limit reached. Reset the demo to continue.');
      if (path === '/merchant-network/merchants') {
        const m = { id: uid(), name: text(body.name, 120), market: text(body.market, 120), supplierVerified: false }; state.merchants.unshift(m); result = m;
      } else if (path === '/merchant-network/offers') {
        merchant(body.merchantId); const o = { id: uid(), merchantId: body.merchantId, commodity: text(body.commodity, 100), availableKg: integer(body.availableKg, 1000000), pricePerKgMinor: integer(body.pricePerKgMinor, 100000000) }; state.offers.unshift(o); result = o;
      } else if (path === '/merchant-network/trades') {
        const prior = state.trades.find(t => t.requestKey === body.requestKey);
        if (prior) { if (prior.buyerId !== body.buyerId || prior.offerId !== body.offerId || prior.quantityKg !== body.quantityKg) throw new Error('Request key already used.'); return response(prior, 201); }
        const o = required(state.offers.find(o => o.id === body.offerId)); merchant(body.buyerId);
        const quantity = integer(body.quantityKg, 1000000); const total = integer(quantity * o.pricePerKgMinor);
        if (body.buyerId === o.merchantId || quantity > o.availableKg) throw new Error('Choose a different buyer and an available quantity.');
        const t: Trade = { id: uid(), buyerId: body.buyerId, offerId: o.id, quantityKg: quantity, totalMinor: total, requestKey: text(body.requestKey), state: 'AGREED', events: [] };
        o.availableKg -= quantity; event(t, 'AGREED', 'Agreement recorded in the browser demo'); state.trades.unshift(t); result = t;
      } else if (path === '/merchant-network/financing-requests') {
        const t = required(state.trades.find(t => t.id === body.tradeId)); const amount = integer(body.amountMinor);
        if (t.state !== 'AGREED' || state.financingRequests.some(a => a.tradeId === t.id) || amount > t.totalMinor) throw new Error('Choose an undelivered purchase without an application and stay within its total.');
        const a: Application = { id: uid(), tradeId: t.id, merchantId: t.buyerId, amountMinor: amount, purpose: text(body.purpose), status: 'SUBMITTED', lenderId: null, consentedAt: null, consentRevokedAt: null, approvedAmountMinor: null, decisionReason: null }; state.financingRequests.unshift(a); result = a;
      } else {
        const match = path.match(/^\/merchant-network\/trades\/([^/]+)\/(delivery|payment-verification)$/);
        if (!match) throw new Error('Credential administration is available in the repository, not the public demo.');
        const t = required(state.trades.find(t => t.id === match[1])); const evidence = text(body.evidence);
        if (match[2] === 'delivery') { if (t.state !== 'AGREED') throw new Error('Trade is not awaiting delivery.'); t.state = 'DELIVERED'; event(t, 'DELIVERED', evidence); }
        else {
          const provider = text(body.provider, 40); const reference = text(body.reference, 120);
          if (t.state !== 'DELIVERED' || integer(body.amountMinor) !== t.totalMinor) throw new Error('Confirm delivery and enter the exact trade total.');
          if (state.trades.some(x => x.paymentProvider === provider && x.paymentReference === reference)) throw new Error('Payment reference already used.');
          t.state = 'COMPLETED'; t.paymentProvider = provider; t.paymentReference = reference; event(t, 'PAYMENT_MANUALLY_VERIFIED', evidence);
        }
        result = t;
      }
    } else throw new Error('This route is disabled in the public demo.');
    persist(); return response(result, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Demo action failed.';
    throw new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, response({ message }, 400));
  }
};
