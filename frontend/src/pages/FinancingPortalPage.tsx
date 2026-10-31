import axios from "axios";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Card, SectionTitle } from "../components/Card";
import { Button, Field, Input, Select } from "../components/FormControls";
import { EmptyState, ErrorState } from "../components/States";
import { getErrorMessage } from "../lib/api";

// A separate client prevents operator credentials from following users into this portal.
const portal = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api",
});
type Application = {
  id: string;
  amountMinor: number;
  purpose: string;
  status: string;
  consentedAt: string | null;
  consentRevokedAt: string | null;
  approvedAmountMinor: number | null;
  decisionReason: string | null;
  merchant: { name: string; market: string };
  lender: { id: string; name: string } | null;
  trade: {
    id: string;
    state: string;
    quantityKg: number;
    totalMinor: number;
    offer: {
      commodity: string;
      merchant: { name: string; market: string; supplierVerified: boolean };
    };
  };
};
type Workspace = {
  role: "MERCHANT" | "REVIEWER";
  applications: Application[];
  lenders: { id: string; name: string }[];
};
const money = (value: number) =>
  new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(
    value / 100,
  );
function parseAmount(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Enter an ETB amount with up to two decimal places.");
  const [birr, cents = ""] = value.split(".");
  const amount = Number(birr) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647)
    throw new Error("Invalid amount.");
  return amount;
}
export function FinancingPortalPage() {
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [data, setData] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const epoch = useRef(0);
  useEffect(
    () => () => {
      epoch.current++;
    },
    [],
  );
  async function refresh(accessToken = token) {
    const current = ++epoch.current;
    setBusy(true);
    setError("");
    setData(null);
    try {
      const r = await portal.get<Workspace>("/pilot/workspace", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (current !== epoch.current) return;
      setToken(accessToken);
      setCode("");
      setData(r.data);
    } catch (e) {
      if (current === epoch.current) {
        setError(getErrorMessage(e));
        setToken("");
      }
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  }
  async function action(id: string, path: string, body = {}) {
    const current = epoch.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await portal.post(`/pilot/applications/${id}/${path}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (current !== epoch.current) return;
      await refresh();
      setNotice("Saved.");
    } catch (e) {
      if (current !== epoch.current) return;
      // Clear potentially stale shared records on any failed write, including consent withdrawal elsewhere.
      setData(null);
      setError(getErrorMessage(e));
      if (axios.isAxiosError(e) && e.response?.status === 401) setToken("");
    } finally {
      if (current === epoch.current || current + 1 === epoch.current)
        setBusy(false);
    }
  }
  function decision(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      void action(id, "decision", {
        decision: f.get("decision"),
        reason: f.get("reason"),
        ...(f.get("decision") === "APPROVED"
          ? { approvedAmountMinor: parseAmount(String(f.get("amount"))) }
          : {}),
      });
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }
  function logout() {
    epoch.current++;
    setToken("");
    setCode("");
    setData(null);
    setError("");
    setNotice("");
    setBusy(false);
  }
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-50 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-widest text-indigo-200">
              NEBIRRO · PILOT
            </p>
            <h1 className="mt-2 text-3xl font-bold">Financing portal</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Control application sharing and follow a manual financing review.
              A recorded approval does not transfer funds or create a loan
              agreement.
            </p>
          </div>
          {token && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void refresh()}
              >
                Refresh
              </Button>
              <Button variant="secondary" onClick={logout}>
                Sign out
              </Button>
            </div>
          )}
        </header>
        {error && <ErrorState message={error} />}
        {notice && (
          <p role="status" className="text-emerald-200">
            {notice}
          </p>
        )}
        {!token && (
          <Card>
            <SectionTitle title="Access your workspace" />
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void refresh(code.trim());
              }}
            >
              <Field label="Pilot access code">
                <Input
                  type="password"
                  autoComplete="off"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              <Button disabled={busy}>Sign in</Button>
            </form>
            <p className="mt-4 text-sm text-slate-300">
              Use the 24-hour code issued to you by your pilot operator. Your
              code is kept only for this open session.
            </p>
          </Card>
        )}
        {data && (
          <>
            <p className="text-lg font-semibold">
              {data.role === "MERCHANT"
                ? "Your applications"
                : "Lender review queue"}
            </p>
            {!data.applications.length && (
              <EmptyState
                message={
                  data.role === "MERCHANT"
                    ? "No applications have been recorded for you. Contact your pilot operator to record a supplier purchase."
                    : "No applications are currently shared with your institution."
                }
              />
            )}
            <fieldset disabled={busy} className="min-w-0 space-y-5">
              {data.applications.map((app) => {
                const shared = Boolean(
                  app.consentedAt && !app.consentRevokedAt,
                );
                const final = ["APPROVED", "DECLINED"].includes(app.status);
                return (
                  <Card key={app.id}>
                    <SectionTitle
                      title={`${app.trade.offer.commodity} · ${app.trade.quantityKg} kg`}
                      detail={app.status.replace(/_/g, " ")}
                    />
                    <p className="text-lg font-semibold">
                      {money(app.amountMinor)} requested · {app.merchant.name}
                    </p>
                    <p className="mt-2 text-slate-300">{app.purpose}</p>
                    <p className="mt-3 text-sm">
                      Supplier: {app.trade.offer.merchant.name} ·{" "}
                      {app.trade.offer.merchant.market} ·{" "}
                      {app.trade.offer.merchant.supplierVerified
                        ? "Verified by operator"
                        : "Verification required"}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      Purchase: {money(app.trade.totalMinor)} ·{" "}
                      {app.trade.state}
                    </p>
                    {app.decisionReason && (
                      <div className="mt-4 rounded-xl bg-slate-800 p-4">
                        <p className="font-semibold">Decision reason</p>
                        <p>{app.decisionReason}</p>
                        {app.approvedAmountMinor != null && (
                          <p className="mt-2">
                            Recorded approval amount:{" "}
                            {money(app.approvedAmountMinor)}
                          </p>
                        )}
                      </div>
                    )}
                    {data.role === "MERCHANT" && (
                      <div className="mt-5 border-t border-slate-700 pt-4">
                        {shared ? (
                          <>
                            <p className="mb-3">
                              Shared with {app.lender?.name}
                            </p>
                            <Button
                              variant="secondary"
                              onClick={() => void action(app.id, "withdraw")}
                            >
                              Withdraw sharing
                            </Button>
                            <p className="mt-3 text-xs text-slate-400">
                              Withdrawal blocks further reviewer access. It
                              cannot undo information already viewed; decision
                              and audit records remain.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mb-3 text-slate-300">
                              {app.consentRevokedAt
                                ? "Sharing withdrawn."
                                : "Not shared with a lender."}
                            </p>
                            {!final && app.trade.state === "AGREED" && (
                              <form
                                className="space-y-4"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const f = new FormData(e.currentTarget);
                                  void action(app.id, "consent", {
                                    lenderId: f.get("lenderId"),
                                    confirmed: f.get("confirmed") === "on",
                                    scope: "application-v1",
                                  });
                                }}
                              >
                                <Field label="Choose lender">
                                  <Select
                                    aria-label="Choose lender"
                                    name="lenderId"
                                    required
                                  >
                                    <option value="">Choose institution</option>
                                    {data.lenders.map((l) => (
                                      <option key={l.id} value={l.id}>
                                        {l.name}
                                      </option>
                                    ))}
                                  </Select>
                                </Field>
                                <p className="text-sm text-slate-300">
                                  Share this application, your business name and
                                  market, the supplier’s name, market and
                                  verification status, and this purchase’s
                                  grain, quantity, total and delivery state.
                                  Other trade history and payment/delivery
                                  evidence are excluded.
                                </p>
                                <label className="flex items-start gap-3 text-sm">
                                  <input
                                    name="confirmed"
                                    type="checkbox"
                                    required
                                    className="mt-1"
                                  />
                                  <span>
                                    I agree to share these details with the
                                    selected lender for this application’s
                                    financing review.
                                  </span>
                                </label>
                                <Button>Share application</Button>
                              </form>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {data.role === "REVIEWER" && !final && (
                      <div className="mt-5 border-t border-slate-700 pt-4">
                        {app.status === "SUBMITTED" ? (
                          <Button
                            disabled={
                              busy ||
                              !app.trade.offer.merchant.supplierVerified ||
                              app.trade.state !== "AGREED"
                            }
                            onClick={() => void action(app.id, "review")}
                          >
                            Begin review
                          </Button>
                        ) : (
                          <form
                            className="space-y-4"
                            onSubmit={(e) => decision(e, app.id)}
                          >
                            <Field label="Decision">
                              <Select aria-label="Decision" name="decision">
                                <option value="APPROVED">
                                  Approve in pilot
                                </option>
                                <option value="DECLINED">Decline</option>
                              </Select>
                            </Field>
                            <Field label="Approved amount (ETB; approval only)">
                              <Input name="amount" inputMode="decimal" />
                            </Field>
                            <Field label="Decision reason">
                              <Input name="reason" required maxLength={1000} />
                            </Field>
                            <Button
                              disabled={busy || app.trade.state !== "AGREED"}
                            >
                              Record decision
                            </Button>
                          </form>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </fieldset>
            <p className="text-xs text-slate-400">
              Up to 200 most recent applications. Refresh to retrieve current
              sharing and verification status.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
