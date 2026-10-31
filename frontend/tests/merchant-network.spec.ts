import { expect, test } from "@playwright/test";

test("operator can record a purchase, request financing and complete trade evidence", async ({
  page,
}) => {
  const merchants = [
    { id: "seller", name: "Pilot Grain Supply", market: "Pilot market" },
    { id: "buyer", name: "Aster Retail", market: "Pilot market" },
  ];
  const offer = {
    id: "offer",
    merchant: merchants[0],
    commodity: "White teff",
    availableKg: 100,
    pricePerKgMinor: 5000,
  };
  const data: {
    merchants: typeof merchants;
    offers: (typeof offer)[];
    trades: any[];
    financingRequests: any[];
  } = { merchants, offers: [offer], trades: [], financingRequests: [] };
  await page.addInitScript(() =>
    localStorage.setItem("nebirro_api_key", "test-partner-key"),
  );
  await page.route("**/api/merchant-network**", async (route) => {
    const req = route.request();
    expect(req.headers()["x-merchant-operator-key"]).toBe("test-operator");
    if (req.method() === "GET") return route.fulfill({ json: data });
    const body = req.postDataJSON();
    const path = new URL(req.url()).pathname;
    if (path.endsWith("/trades")) {
      expect(body).toMatchObject({
        offerId: "offer",
        buyerId: "buyer",
        quantityKg: 10,
      });
      expect(body.requestKey).toBeTruthy();
      offer.availableKg -= 10;
      data.trades.push({
        id: "trade",
        buyer: merchants[1],
        offer,
        quantityKg: 10,
        totalMinor: 50000,
        state: "AGREED",
        events: [],
      });
    } else if (path.endsWith("/financing-requests")) {
      expect(body).toEqual({
        tradeId: "trade",
        amountMinor: 40000,
        purpose: "Restock teff",
      });
      data.financingRequests.push({
        id: "application",
        ...body,
        status: "SUBMITTED",
      });
    } else if (path.endsWith("/delivery")) {
      expect(body.evidence).toBe("Signed receipt D-001");
      data.trades[0].state = "DELIVERED";
      data.trades[0].events.push({
        id: "event-1",
        kind: "DELIVERED",
        evidence: body.evidence,
        createdAt: new Date().toISOString(),
      });
    } else if (path.endsWith("/payment-verification")) {
      expect(body).toMatchObject({
        amountMinor: 50000,
        provider: "BANK",
        reference: "TX-001",
      });
      data.trades[0].state = "COMPLETED";
      data.trades[0].events.push({
        id: "event-2",
        kind: "PAYMENT_MANUALLY_VERIFIED",
        evidence: body.evidence,
        createdAt: new Date().toISOString(),
      });
    } else throw new Error(`Unexpected route ${path}`);
    await route.fulfill({ status: 201, json: {} });
  });
  await page.goto("/merchant-network");
  await expect(
    page.getByRole("button", { name: "Publish offer", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Operator credential").fill("test-operator");
  await expect(
    page.getByRole("heading", { name: "Grain marketplace" }),
  ).toBeVisible();
  await page.getByLabel("Offer", { exact: true }).selectOption("offer");
  await page.getByLabel("Buyer", { exact: true }).selectOption("buyer");
  await page.getByLabel("Purchase quantity (kg)").fill("10");
  await page
    .getByRole("button", { name: "Record agreement", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "White teff · 10 kg" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Financing", exact: true }).click();
  await page.getByLabel("Supplier purchase").selectOption("trade");
  await page.getByLabel("Requested amount (ETB)").fill("400.00");
  await page.getByLabel("Inventory purpose").fill("Restock teff");
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByText(/SUBMITTED/)).toBeVisible();
  await page
    .getByRole("button", { name: "Trade workflow", exact: true })
    .click();
  await page
    .getByLabel("Delivery evidence / receipt reference")
    .fill("Signed receipt D-001");
  await page.getByRole("button", { name: "Confirm delivery" }).click();
  await page.getByLabel("Payment provider code").fill("bank");
  await page.getByLabel("ETB payment reference").fill("tx-001");
  await page.getByLabel("Verified amount (ETB)").fill("500.00");
  await page
    .getByLabel("Verification evidence", { exact: true })
    .fill("Statement checked by pilot operator");
  await page
    .getByRole("button", { name: "Record manually verified payment" })
    .click();
  await expect(page.getByText("COMPLETED", { exact: true })).toBeVisible();
  await expect(
    page.getByText("PAYMENT MANUALLY VERIFIED", { exact: true }),
  ).toBeVisible();
  // Removing the operator credential clears the previous partner's records immediately.
  await page.getByLabel("Operator credential").fill("");
  await expect(
    page.getByRole("heading", { name: "White teff · 10 kg" }),
  ).not.toBeVisible();
});

test("mobile navigation exposes the merchant workspace and errors stay visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("nebirro_api_key", "test-key"),
  );
  await page.route("**/api/merchant-network", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Merchant operator credential required" },
    }),
  );
  await page.goto("/merchant-network");
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByText("Merchant Network"),
  ).toBeVisible();
  await page.getByLabel("Operator credential").fill("wrong");
  await expect(
    page.getByText("Merchant operator credential required", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
