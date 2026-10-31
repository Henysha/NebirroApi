import { expect, test } from "@playwright/test";
const fixture = () => ({
  id: "application",
  amountMinor: 40000,
  purpose: "Buy grain inventory",
  status: "SUBMITTED",
  consentedAt: null as string | null,
  consentRevokedAt: null as string | null,
  approvedAmountMinor: null as number | null,
  decisionReason: null as string | null,
  merchant: { name: "Aster Retail", market: "Merkato" },
  lender: null as { id: string; name: string } | null,
  trade: {
    id: "trade",
    state: "AGREED",
    quantityKg: 10,
    totalMinor: 50000,
    offer: {
      commodity: "Teff",
      merchant: {
        name: "Grain Supply",
        market: "Merkato",
        supplierVerified: true,
      },
    },
  },
});

test("merchant grants and withdraws scoped consent without storing the access code", async ({
  page,
}) => {
  const app = fixture();
  await page.route("**/api/pilot/**", async (route) => {
    expect(route.request().headers()["authorization"]).toBe(
      "Bearer merchant-code",
    );
    expect(route.request().headers()["x-api-key"]).toBeUndefined();
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          role: "MERCHANT",
          applications: [app],
          lenders: [{ id: "lender", name: "Pilot Lender" }],
        },
      });
    if (route.request().url().endsWith("/consent")) {
      expect(route.request().postDataJSON()).toEqual({
        lenderId: "lender",
        confirmed: true,
        scope: "application-v1",
      });
      app.consentedAt = new Date().toISOString();
      app.lender = { id: "lender", name: "Pilot Lender" };
    } else if (route.request().url().endsWith("/withdraw"))
      app.consentRevokedAt = new Date().toISOString();
    else throw new Error("Unexpected mutation");
    return route.fulfill({ status: 201, json: {} });
  });
  await page.goto("/financing-portal");
  await page.getByLabel("Pilot access code").fill("merchant-code");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Your applications", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Choose lender", { exact: true })
    .selectOption("lender");
  await expect(
    page.getByText(
      /Other trade history and payment\/delivery evidence are excluded/,
    ),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Share application" }).click();
  await expect(
    page.getByText("Shared with Pilot Lender", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Withdraw sharing" }).click();
  await expect(
    page.getByText("Sharing withdrawn.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.stringify(localStorage) + JSON.stringify(sessionStorage),
    ),
  ).not.toContain("merchant-code");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByText("Aster Retail", { exact: false }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Pilot access code")).toHaveValue("");
});

test("reviewer completes a manual decision and revoked access clears visible records", async ({
  page,
}) => {
  const app = fixture();
  app.consentedAt = new Date().toISOString();
  app.lender = { id: "lender", name: "Pilot Lender" };
  let revoked = false;
  await page.route("**/api/pilot/**", async (route) => {
    if (revoked)
      return route.fulfill({
        status: 401,
        json: { message: "Pilot access expired or revoked" },
      });
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { role: "REVIEWER", applications: [app], lenders: [] },
      });
    if (route.request().url().endsWith("/review")) app.status = "UNDER_REVIEW";
    else if (route.request().url().endsWith("/decision")) {
      expect(route.request().postDataJSON()).toEqual({
        decision: "APPROVED",
        approvedAmountMinor: 30000,
        reason: "Verified supplier purchase reviewed",
      });
      app.status = "APPROVED";
      app.approvedAmountMinor = 30000;
      app.decisionReason = "Verified supplier purchase reviewed";
    } else throw new Error("Unexpected mutation");
    return route.fulfill({ status: 201, json: {} });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/financing-portal");
  await page.getByLabel("Pilot access code").fill("reviewer-code");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Lender review queue", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share application" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Begin review" }).click();
  await page.getByLabel("Decision", { exact: true }).selectOption("APPROVED");
  await page.getByLabel("Approved amount (ETB; approval only)").fill("300.00");
  await page
    .getByLabel("Decision reason", { exact: true })
    .fill("Verified supplier purchase reviewed");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Verified supplier purchase reviewed", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  revoked = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByText("Pilot access expired or revoked", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Aster Retail", { exact: false }),
  ).not.toBeVisible();
});

test("operator verifies a supplier and issues a merchant code from the pilot controls", async ({
  page,
}) => {
  const merchant = {
    id: "merchant",
    name: "Aster Retail",
    market: "Merkato",
    supplierVerified: false,
  };
  await page.addInitScript(() =>
    localStorage.setItem("nebirro_api_key", "partner-key"),
  );
  await page.route("**/api/merchant-network**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET") {
      if (path.endsWith("/lenders") || path.endsWith("/access"))
        return route.fulfill({ json: [] });
      return route.fulfill({
        json: {
          merchants: [merchant],
          offers: [],
          trades: [],
          financingRequests: [],
        },
      });
    }
    if (path.endsWith("/verification")) {
      expect(route.request().postDataJSON()).toEqual({
        verified: true,
        evidence: "Registry and supplier visit checked",
      });
      return route.fulfill({ status: 201, json: {} });
    }
    if (path.endsWith("/access"))
      return route.fulfill({ status: 201, json: { token: "once-only-code" } });
    throw new Error("Unexpected mutation");
  });
  await page.goto("/merchant-network");
  await page.getByLabel("Operator credential").fill("operator-key");
  await page
    .getByRole("button", { name: "Access & review", exact: true })
    .click();
  await page
    .getByLabel("Supplier to verify", { exact: true })
    .selectOption("merchant");
  await page
    .getByLabel("Verification evidence", { exact: true })
    .fill("Registry and supplier visit checked");
  await page.getByRole("button", { name: "Record verification" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page
    .getByLabel("Merchant recipient", { exact: true })
    .selectOption("merchant");
  await page.getByRole("button", { name: "Issue merchant code" }).click();
  await expect(page.getByLabel("New pilot access code")).toHaveValue(
    "once-only-code",
  );
  await page.getByRole("button", { name: "Hide code" }).click();
  await expect(page.getByLabel("New pilot access code")).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open merchant / lender portal" }),
  ).toHaveAttribute("href", "/financing-portal");
});
