import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, SectionTitle } from "./Card";
import { Button, Field, Input, Select } from "./FormControls";
import { ErrorState } from "./States";
import { api, getErrorMessage } from "../lib/api";
type Merchant = { id: string; name: string; supplierVerified?: boolean };
type Access = {
  id: string;
  role: string;
  merchantId: string | null;
  lenderId: string | null;
  expiresAt: string;
  revokedAt: string | null;
};
export function FinancingAdminPanel({
  apiKey,
  operatorKey,
  merchants,
}: {
  apiKey: string;
  operatorKey: string;
  merchants: Merchant[];
}) {
  const [lenders, setLenders] = useState<{ id: string; name: string }[]>([]);
  const [access, setAccess] = useState<Access[]>([]);
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const headers = {
    "x-api-key": apiKey,
    "x-merchant-operator-key": operatorKey,
  };
  async function load(epoch: number) {
    const [l, a] = await Promise.all([
      api.get("/merchant-network/lenders", { headers }),
      api.get("/merchant-network/access", { headers }),
    ]);
    if (epoch === generation.current) {
      setLenders(l.data);
      setAccess(a.data);
    }
  }
  useEffect(() => {
    const epoch = ++generation.current;
    setCredential("");
    setAccess([]);
    setLenders([]);
    setError("");
    setNotice("");
    if (apiKey && operatorKey)
      void load(epoch).catch((e) => {
        if (epoch === generation.current) setError(getErrorMessage(e));
      });
    return () => {
      generation.current++;
    };
  }, [apiKey, operatorKey]);
  async function act(path: string, body = {}) {
    const epoch = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    setCredential("");
    try {
      const response = await api.post(`/merchant-network/${path}`, body, {
        headers,
      });
      if (epoch !== generation.current) return;
      if (response.data.token) setCredential(response.data.token);
      setNotice(
        response.data.token
          ? "Access issued for 24 hours. Any earlier credential for this subject is now invalid."
          : "Saved.",
      );
      await load(epoch);
    } catch (e) {
      if (epoch === generation.current) setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function form(
    e: FormEvent<HTMLFormElement>,
    build: (f: FormData) => [string, object],
  ) {
    e.preventDefault();
    const [path, body] = build(new FormData(e.currentTarget));
    void act(path, body);
  }
  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle title="Pilot access and verification" />
        <p className="text-sm text-slate-300">
          Verify the recipient’s identity before handing over access. Merchant
          credentials can share only that merchant’s applications; reviewer
          credentials belong to one lender institution.
        </p>
        <Link
          className="mt-3 inline-block text-indigo-200 underline"
          to="/financing-portal"
        >
          Open merchant / lender portal
        </Link>
      </Card>
      {error && <ErrorState message={error} />}
      {notice && (
        <p role="status" className="text-emerald-200">
          {notice}
        </p>
      )}
      {credential && (
        <Card>
          <Field label="New pilot access code">
            <Input
              readOnly
              value={credential}
              autoComplete="off"
              onFocus={(e) => e.target.select()}
            />
          </Field>
          <p className="mt-2 text-sm text-amber-200">
            Shown once in this session. Share securely with the verified
            recipient. It will not be saved in this browser.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => setCredential("")}
          >
            Hide code
          </Button>
        </Card>
      )}
      <fieldset
        disabled={busy || !apiKey || !operatorKey}
        className="grid min-w-0 gap-5 lg:grid-cols-2"
      >
        <Card>
          <SectionTitle title="Supplier verification" />
          <form
            className="space-y-4"
            onSubmit={(e) =>
              form(e, (f) => [
                `merchants/${f.get("merchantId")}/verification`,
                {
                  verified: f.get("verified") === "true",
                  evidence: f.get("evidence"),
                },
              ])
            }
          >
            <Field label="Supplier to verify">
              <Select
                aria-label="Supplier to verify"
                name="merchantId"
                required
              >
                <option value="">Choose supplier</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Verification result">
              <Select aria-label="Verification result" name="verified">
                <option value="true">Verified</option>
                <option value="false">Verification withdrawn</option>
              </Select>
            </Field>
            <Field label="Verification evidence">
              <Input
                name="evidence"
                required
                maxLength={1000}
                placeholder="What was checked, by whom, and evidence reference"
              />
            </Field>
            <Button>Record verification</Button>
          </form>
        </Card>
        <Card>
          <SectionTitle title="Add pilot lender" />
          <form
            className="space-y-4"
            onSubmit={(e) =>
              form(e, (f) => ["lenders", { name: f.get("name") }])
            }
          >
            <Field label="Institution name">
              <Input name="name" required maxLength={120} />
            </Field>
            <Button>Add lender</Button>
          </form>
          <p className="mt-4 text-sm text-slate-300">
            This is a pilot institution record. Creating it does not verify
            licensing or establish a lending partnership.
          </p>
        </Card>
        <Card>
          <SectionTitle title="Issue merchant access" />
          <form
            className="space-y-4"
            onSubmit={(e) =>
              form(e, (f) => [`merchants/${f.get("merchantId")}/access`, {}])
            }
          >
            <Field label="Merchant recipient">
              <Select
                aria-label="Merchant recipient"
                name="merchantId"
                required
              >
                <option value="">Choose merchant</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button>Issue merchant code</Button>
          </form>
        </Card>
        <Card>
          <SectionTitle title="Issue lender reviewer access" />
          <form
            className="space-y-4"
            onSubmit={(e) =>
              form(e, (f) => [`lenders/${f.get("lenderId")}/access`, {}])
            }
          >
            <Field label="Lender recipient">
              <Select aria-label="Lender recipient" name="lenderId" required>
                <option value="">Choose lender</option>
                {lenders.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button>Issue reviewer code</Button>
          </form>
        </Card>
        <Card className="lg:col-span-2">
          <SectionTitle title="Issued access" />
          {!access.length && (
            <p className="text-slate-300">No access credentials issued.</p>
          )}
          {access.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 py-3"
            >
              <div>
                <p>
                  {a.role === "MERCHANT"
                    ? merchants.find((m) => m.id === a.merchantId)?.name
                    : lenders.find((l) => l.id === a.lenderId)?.name}{" "}
                  · {a.role}
                </p>
                <p className="text-sm text-slate-300">
                  {a.revokedAt
                    ? "Revoked"
                    : `Expires ${new Date(a.expiresAt).toLocaleString()}`}
                </p>
              </div>
              <Button
                variant="secondary"
                disabled={Boolean(a.revokedAt)}
                onClick={() => void act(`access/${a.id}/revoke`)}
              >
                Revoke access
              </Button>
            </div>
          ))}
        </Card>
      </fieldset>
    </div>
  );
}
