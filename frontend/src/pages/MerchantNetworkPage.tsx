import { isDemo } from "../demo/demo-api";
import { FinancingAdminPanel } from "../components/FinancingAdminPanel";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Card, SectionTitle } from "../components/Card";
import { Button, Field, Input, Select } from "../components/FormControls";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { api, getErrorMessage } from "../lib/api";
import { useApiKey } from "../lib/auth";

type Merchant = { id: string; name: string; market: string };
type Offer = {
  id: string;
  merchant: Merchant;
  commodity: string;
  availableKg: number;
  pricePerKgMinor: number;
};
type Trade = {
  id: string;
  buyer: Merchant;
  offer: Offer;
  quantityKg: number;
  totalMinor: number;
  state: "AGREED" | "DELIVERED" | "COMPLETED";
  paymentReference?: string;
  events: { id: string; kind: string; evidence: string; createdAt: string }[];
};
type Financing = {
  id: string;
  tradeId: string;
  amountMinor: number;
  purpose: string;
  status: string;
};
type Snapshot = {
  merchants: Merchant[];
  offers: Offer[];
  trades: Trade[];
  financingRequests: Financing[];
};
const empty: Snapshot = {
  merchants: [],
  offers: [],
  trades: [],
  financingRequests: [],
};
const money = (minor: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(
    minor / 100,
  );
// Parse decimal input without floating point rounding or silently accepting extra precision.
function minorUnits(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Enter an ETB amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result < 1 || result > 2147483647)
    throw new Error("Amount exceeds the pilot limit.");
  return result;
}

export function MerchantNetworkPage() {
  const { apiKey } = useApiKey();
  const [operatorKey, setOperatorKey] = useState(isDemo ? "demo-operator" : "");
  const [data, setData] = useState<Snapshot>(empty);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("Marketplace");
  const [buyerId, setBuyerId] = useState("");
  const [selectedOffer, setSelectedOffer] = useState("");
  const [quantity, setQuantity] = useState("1");
  const requestKey = useRef(crypto.randomUUID());
  const generation = useRef(0);
  const ready = Boolean(apiKey && operatorKey);
  const headers = {
    "x-api-key": apiKey,
    "x-merchant-operator-key": operatorKey,
  };

  async function load(epoch: number) {
    const response = await api.get<Snapshot>("/merchant-network", { headers });
    if (generation.current === epoch) setData(response.data);
  }
  useEffect(() => {
    const epoch = ++generation.current;
    setData(empty);
    setError("");
    setNotice("");
    setBuyerId("");
    setSelectedOffer("");
    requestKey.current = crypto.randomUUID();
    if (!ready) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load(epoch)
      .catch((e) => {
        if (generation.current === epoch) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (generation.current === epoch) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [apiKey, operatorKey]);

  async function save(path: string, body: object, done?: () => void) {
    const epoch = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.post(`/merchant-network/${path}`, body, { headers });
      if (generation.current !== epoch) return;
      done?.();
      setNotice("Saved.");
      await load(epoch);
    } catch (e) {
      if (generation.current === epoch) setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function submit(
    e: FormEvent<HTMLFormElement>,
    path: string,
    build: (f: FormData) => object,
  ) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      void save(path, build(new FormData(form)), () => form.reset());
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }
  const offer = data.offers.find((o) => o.id === selectedOffer);
  const fields = (
    label: string,
    name: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <Field label={label}>
      <Input name={name} required {...props} />
    </Field>
  );

  return (
    <section>
      <PageHeader
        eyebrow="Nebirro • Merchant pilot"
        title="Merchant network"
        description="Connect grain supply to purchases, build an evidenced trade history, and record inventory financing requests."
      />
      {!isDemo && <Card className="mt-6">
        <SectionTitle
          title="Assisted pilot workspace"
          detail="ETB · Ethiopia"
        />
        <p className="mb-4 text-sm text-slate-300">
          Operators record agreements on behalf of merchants. Payments are
          checked manually outside Nebirro. Financing requests are applications,
          not approvals or disbursements.
        </p>
        <Field label="Operator credential">
          <Input
            type="password"
            autoComplete="off"
            value={operatorKey}
            onChange={(e) => setOperatorKey(e.target.value)}
            placeholder="Enter the pilot operator credential"
          />
        </Field>
        {!apiKey && (
          <p className="mt-3 text-sm text-amber-200">
            Activate a partner API key in the console header first.
          </p>
        )}
      </Card>}
      <div className="my-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Merchants", data.merchants.length],
          [
            "Available offers",
            data.offers.filter((o) => o.availableKg > 0).length,
          ],
          [
            "Completed trades",
            data.trades.filter((t) => t.state === "COMPLETED").length,
          ],
          ["Applications", data.financingRequests.length],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-slate-300">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
      <div
        className="mb-5 flex flex-wrap gap-2"
        aria-label="Merchant workspace sections"
      >
        {[
          "Marketplace",
          "Trade workflow",
          "Financing",
          "Merchants",
          ...(!isDemo ? ["Access & review"] : []),
        ].map((t) => (
          <Button
            key={t}
            variant={tab === t ? "primary" : "secondary"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      {error && <ErrorState message={error} />}
      {notice && (
        <p role="status" className="mb-4 text-emerald-200">
          {notice}
        </p>
      )}
      {loading && <LoadingState />}
      <fieldset
        disabled={!ready || busy || loading}
        className="min-w-0 space-y-5"
      >
        {tab === "Access & review" && (
          <FinancingAdminPanel
            apiKey={apiKey}
            operatorKey={operatorKey}
            merchants={data.merchants}
          />
        )}
        {tab === "Merchants" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <SectionTitle title="Register merchant" />
              <form
                className="space-y-4"
                onSubmit={(e) =>
                  submit(e, "merchants", (f) => ({
                    name: f.get("name"),
                    market: f.get("market"),
                  }))
                }
              >
                {fields("Business name", "name", { maxLength: 120 })}
                {fields("Market / location", "market", {
                  placeholder: "Enter market or business location",
                  maxLength: 120,
                })}
                <Button>Register merchant</Button>
              </form>
            </Card>
            <Card>
              <SectionTitle title="Merchant directory" />
              {!data.merchants.length && (
                <EmptyState message="Register a supplier and a buyer to start trading." />
              )}
              {data.merchants.map((m) => (
                <div key={m.id} className="border-b border-slate-700 py-3">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-sm text-slate-300">{m.market}</p>
                </div>
              ))}
            </Card>
          </div>
        )}
        {tab === "Marketplace" && (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <SectionTitle title="Publish grain offer" />
                <form
                  className="space-y-4"
                  onSubmit={(e) =>
                    submit(e, "offers", (f) => ({
                      merchantId: f.get("merchantId"),
                      commodity: f.get("commodity"),
                      availableKg: Number(f.get("availableKg")),
                      pricePerKgMinor: minorUnits(String(f.get("price"))),
                    }))
                  }
                >
                  <Field label="Supplier">
                    <Select aria-label="Supplier" name="merchantId" required>
                      <option value="">Choose supplier</option>
                      {data.merchants.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {fields("Grain / variety", "commodity", {
                    placeholder: "White teff",
                    maxLength: 100,
                  })}
                  {fields("Available quantity (kg)", "availableKg", {
                    type: "number",
                    min: 1,
                    max: 1000000,
                    step: 1,
                  })}
                  {fields("Price per kg (ETB)", "price", {
                    inputMode: "decimal",
                  })}
                  <Button>Publish offer</Button>
                </form>
              </Card>
              <Card>
                <SectionTitle title="Record trade agreement" />
                <p className="mb-4 text-sm text-slate-300">
                  Confirm both parties agreed before recording. Quantity is
                  reserved immediately.
                </p>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(
                      "trades",
                      {
                        offerId: selectedOffer,
                        buyerId,
                        quantityKg: Number(quantity),
                        requestKey: requestKey.current,
                      },
                      () => {
                        requestKey.current = crypto.randomUUID();
                        setTab("Trade workflow");
                      },
                    );
                  }}
                >
                  <Field label="Offer">
                    <Select
                      required
                      aria-label="Offer"
                      value={selectedOffer}
                      onChange={(e) => {
                        setSelectedOffer(e.target.value);
                        requestKey.current = crypto.randomUUID();
                      }}
                    >
                      <option value="">Choose offer</option>
                      {data.offers
                        .filter((o) => o.availableKg > 0)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.commodity} · {o.merchant.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Buyer">
                    <Select
                      required
                      aria-label="Buyer"
                      value={buyerId}
                      onChange={(e) => {
                        setBuyerId(e.target.value);
                        requestKey.current = crypto.randomUUID();
                      }}
                    >
                      <option value="">Choose buyer</option>
                      {data.merchants
                        .filter((m) => m.id !== offer?.merchant.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Purchase quantity (kg)">
                    <Input
                      type="number"
                      min={1}
                      max={offer?.availableKg ?? 1000000}
                      step={1}
                      required
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(e.target.value);
                        requestKey.current = crypto.randomUUID();
                      }}
                    />
                  </Field>
                  <p className="text-lg font-semibold">
                    {offer
                      ? money(offer.pricePerKgMinor * Number(quantity))
                      : "Choose an offer to see total"}
                  </p>
                  <Button>Record agreement</Button>
                </form>
              </Card>
            </div>
            <Card>
              <SectionTitle
                title="Grain marketplace"
                detail="Within this partner’s pilot network"
              />
              {!data.offers.length && (
                <EmptyState message="Register merchants, then publish the first grain offer." />
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {data.offers.map((o) => (
                  <article
                    key={o.id}
                    className="rounded-xl border border-slate-700 p-4"
                  >
                    <p className="text-lg font-semibold">{o.commodity}</p>
                    <p className="text-slate-300">
                      {o.merchant.name} · {o.merchant.market}
                    </p>
                    <p className="my-3">
                      {money(o.pricePerKgMinor)} / kg · {o.availableKg} kg
                      available
                    </p>
                    <Button
                      variant="secondary"
                      disabled={!o.availableKg || busy}
                      onClick={() => {
                        setSelectedOffer(o.id);
                        setBuyerId("");
                        requestKey.current = crypto.randomUUID();
                      }}
                    >
                      Select offer
                    </Button>
                  </article>
                ))}
              </div>
            </Card>
          </>
        )}
        {tab === "Trade workflow" && (
          <>
            {!data.trades.length && (
              <EmptyState message="Record an agreement from the marketplace to begin." />
            )}
            {data.trades.map((t) => (
              <Card key={t.id}>
                <SectionTitle
                  title={`${t.offer.commodity} · ${t.quantityKg} kg`}
                  detail={t.state.replace("_", " ")}
                />
                <p>
                  {t.offer.merchant.name} → {t.buyer.name} ·{" "}
                  {money(t.totalMinor)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Trade {t.id}</p>
                {t.state === "AGREED" && (
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={(e) =>
                      submit(e, `trades/${t.id}/delivery`, (f) => ({
                        evidence: f.get("evidence"),
                      }))
                    }
                  >
                    {fields(
                      "Delivery evidence / receipt reference",
                      "evidence",
                      { maxLength: 1000 },
                    )}
                    <Button>Confirm delivery</Button>
                  </form>
                )}
                {t.state === "DELIVERED" && (
                  <form
                    className="mt-4 space-y-3"
                    onSubmit={(e) =>
                      submit(e, `trades/${t.id}/payment-verification`, (f) => ({
                        provider: String(f.get("provider"))
                          .trim()
                          .toUpperCase(),
                        reference: String(f.get("reference"))
                          .trim()
                          .toUpperCase(),
                        amountMinor: minorUnits(String(f.get("amount"))),
                        evidence: f.get("evidence"),
                      }))
                    }
                  >
                    {fields("Payment provider code", "provider", {
                      placeholder: "BANK",
                      maxLength: 40,
                    })}
                    {fields("ETB payment reference", "reference", {
                      maxLength: 120,
                    })}
                    {fields("Verified amount (ETB)", "amount", {
                      inputMode: "decimal",
                    })}
                    {fields("Verification evidence", "evidence", {
                      placeholder: "Bank statement or receipt checked, by whom",
                      maxLength: 1000,
                    })}
                    <p className="text-sm text-amber-200">
                      Check the external payment record before confirming.
                      Nebirro does not verify the payment provider
                      automatically.
                    </p>
                    <Button>Record manually verified payment</Button>
                  </form>
                )}
                <ol className="mt-4 space-y-2 border-t border-slate-700 pt-4">
                  {t.events.map((event) => (
                    <li key={event.id} className="text-sm">
                      <span className="font-semibold text-indigo-200">
                        {event.kind.replace(/_/g, " ")}
                      </span>
                      <p className="text-slate-300">
                        {event.evidence} ·{" "}
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </>
        )}
        {tab === "Financing" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <SectionTitle title="Request inventory financing" />
              <p className="mb-4 text-sm text-slate-300">
                Link the buyer’s application to an agreed supplier purchase
                before delivery. Submission does not establish eligibility. Use
                the financing portal to grant sharing consent and follow lender
                review.
              </p>
              <form
                className="space-y-4"
                onSubmit={(e) =>
                  submit(e, "financing-requests", (f) => ({
                    tradeId: f.get("tradeId"),
                    amountMinor: minorUnits(String(f.get("amount"))),
                    purpose: f.get("purpose"),
                  }))
                }
              >
                <Field label="Supplier purchase">
                  <Select
                    aria-label="Supplier purchase"
                    name="tradeId"
                    required
                  >
                    <option value="">Choose agreed trade</option>
                    {data.trades
                      .filter(
                        (t) =>
                          t.state === "AGREED" &&
                          !data.financingRequests.some(
                            (f) => f.tradeId === t.id,
                          ),
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.buyer.name} · {t.offer.commodity} ·{" "}
                          {money(t.totalMinor)}
                        </option>
                      ))}
                  </Select>
                </Field>
                {fields("Requested amount (ETB)", "amount", {
                  inputMode: "decimal",
                })}
                {fields("Inventory purpose", "purpose", { maxLength: 1000 })}
                <Button>Submit application</Button>
              </form>
            </Card>
            <Card>
              <SectionTitle title="Applications" />
              {!data.financingRequests.length && (
                <EmptyState message="No financing applications yet." />
              )}
              {data.financingRequests.map((f) => (
                <article key={f.id} className="border-b border-slate-700 py-4">
                  <p className="font-semibold">
                    {money(f.amountMinor)} · {f.status}
                  </p>
                  <p className="text-slate-300">{f.purpose}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Trade {f.tradeId}
                  </p>
                </article>
              ))}
            </Card>
          </div>
        )}
      </fieldset>
      <p className="mt-6 text-xs text-slate-400">
        Pilot view: up to 200 most recent records per category. Completed
        history reflects operator attestations, not a credit score.
      </p>
    </section>
  );
}
