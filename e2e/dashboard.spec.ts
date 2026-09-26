import { expect, test, type Page, type Route } from "@playwright/test";

const URL_INPUT_PLACEHOLDER = /indiamart\.com/;

function jsonJob(overrides: Record<string, unknown> = {}) {
  return {
    _id: "job1",
    sourceUrl: "https://www.indiamart.com/test-seller/",
    status: "pending",
    progress: 0,
    pagesDiscovered: 0,
    pagesProcessed: 0,
    productsFound: 0,
    productsProcessed: 0,
    errors: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function mockEmptyJobsList(page: Page) {
  await page.route("**/api/jobs", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: [] });
    } else {
      await route.fallback();
    }
  });
}

test("loads the dashboard with the scrape form", async ({ page }) => {
  await mockEmptyJobsList(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Scraper" })).toBeVisible();
  await expect(page.getByPlaceholder(URL_INPUT_PLACEHOLDER)).toBeVisible();
  await expect(page.getByRole("button", { name: "Scrape" })).toBeVisible();
});

test("submitting a URL shows live progress then seller/product results", async ({ page }) => {
  let pollCount = 0;

  await page.route("**/api/jobs", async (route: Route) => {
    const req = route.request();
    if (req.method() === "POST") {
      await route.fulfill({ status: 201, json: { jobId: "job1", status: "pending" } });
    } else if (req.method() === "GET") {
      await route.fulfill({ json: [] });
    } else {
      await route.fallback();
    }
  });

  await page.route("**/api/jobs/job1", async (route: Route) => {
    pollCount += 1;
    const status = pollCount < 2 ? "running" : "completed";
    await route.fulfill({
      json: jsonJob({
        status,
        progress: status === "completed" ? 100 : 40,
        pagesDiscovered: 5,
        pagesProcessed: status === "completed" ? 5 : 2,
        productsFound: 1,
        productsProcessed: status === "completed" ? 1 : 0,
      }),
    });
  });

  await page.route("**/api/jobs/job1/results", async (route: Route) => {
    await route.fulfill({
      json: {
        job: jsonJob({ status: "completed" }),
        seller: {
          name: "Test Seller Pvt Ltd",
          website: "https://testseller.example",
          phone: ["9876543210"],
          email: ["sales@testseller.example"],
        },
        products: [
          {
            _id: "p1",
            name: "Test Widget",
            category: "Widgets",
            brand: "Acme",
            price: { raw: "₹500" },
            sourceUrl: "https://www.indiamart.com/proddetail/test-widget.html",
          },
        ],
      },
    });
  });

  await page.goto("/");
  await page.getByPlaceholder(URL_INPUT_PLACEHOLDER).fill("https://www.indiamart.com/test-seller/");
  await page.getByRole("button", { name: "Scrape" }).click();

  await expect(page.getByTestId("job-status")).toHaveText("running", { timeout: 5000 });
  await expect(page.getByTestId("job-status")).toHaveText("completed", { timeout: 5000 });

  await expect(page.getByTestId("tab-seller")).toBeVisible();
  await expect(page.getByText("Test Seller Pvt Ltd")).toBeVisible();
  await expect(page.getByText("sales@testseller.example")).toBeVisible();

  await page.getByTestId("tab-products").click();
  await expect(page.getByText("Test Widget")).toBeVisible();
  await expect(page.getByText("₹500")).toBeVisible();

  await expect(page.getByRole("link", { name: "Export JSON" })).toHaveAttribute(
    "href",
    "/api/jobs/job1/export?format=json",
  );
  await expect(page.getByRole("link", { name: "Export CSV" })).toHaveAttribute(
    "href",
    "/api/jobs/job1/export?format=csv",
  );
});

test("shows an error message when job creation fails", async ({ page }) => {
  await page.route("**/api/jobs", async (route: Route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 400, json: { status: "error", message: "Invalid sourceUrl" } });
    } else if (route.request().method() === "GET") {
      await route.fulfill({ json: [] });
    } else {
      await route.fallback();
    }
  });

  await page.goto("/");
  await page.getByPlaceholder(URL_INPUT_PLACEHOLDER).fill("https://example.com");
  await page.getByRole("button", { name: "Scrape" }).click();

  await expect(page.getByText("Invalid sourceUrl")).toBeVisible();
});

test("selecting a recent job loads its results", async ({ page }) => {
  await page.route("**/api/jobs", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: [
          jsonJob({
            _id: "job2",
            sourceUrl: "https://www.indiamart.com/another-seller/",
            status: "completed",
            progress: 100,
          }),
        ],
      });
    } else {
      await route.fallback();
    }
  });

  await page.route("**/api/jobs/job2", async (route: Route) => {
    await route.fulfill({
      json: jsonJob({ _id: "job2", sourceUrl: "https://www.indiamart.com/another-seller/", status: "completed", progress: 100 }),
    });
  });

  await page.route("**/api/jobs/job2/results", async (route: Route) => {
    await route.fulfill({
      json: {
        job: jsonJob({ _id: "job2", status: "completed" }),
        seller: { name: "Another Seller" },
        products: [],
      },
    });
  });

  await page.goto("/");
  await expect(page.getByTestId("recent-jobs-list")).toBeVisible();
  await page.getByTestId("recent-job-item").first().click();

  await expect(page.getByText("Another Seller")).toBeVisible();
});

test("shows the failed status and error list when a job fails", async ({ page }) => {
  await page.route("**/api/jobs", async (route: Route) => {
    const req = route.request();
    if (req.method() === "POST") {
      await route.fulfill({ status: 201, json: { jobId: "job3", status: "pending" } });
    } else if (req.method() === "GET") {
      await route.fulfill({ json: [] });
    } else {
      await route.fallback();
    }
  });

  await page.route("**/api/jobs/job3", async (route: Route) => {
    await route.fulfill({
      json: jsonJob({
        _id: "job3",
        status: "failed",
        errors: [{ message: "Refusing to fetch private/internal address: http://127.0.0.1/" }],
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder(URL_INPUT_PLACEHOLDER).fill("https://www.indiamart.com/test-seller/");
  await page.getByRole("button", { name: "Scrape" }).click();

  await expect(page.getByTestId("job-status")).toHaveText("failed", { timeout: 5000 });
  await expect(page.getByText("Refusing to fetch private/internal address")).toBeVisible();
  await expect(page.getByRole("link", { name: "Export JSON" })).toHaveCount(0);
});

test("shows an empty-state message when a completed job found no products", async ({ page }) => {
  await page.route("**/api/jobs", async (route: Route) => {
    const req = route.request();
    if (req.method() === "POST") {
      await route.fulfill({ status: 201, json: { jobId: "job4", status: "pending" } });
    } else if (req.method() === "GET") {
      await route.fulfill({ json: [] });
    } else {
      await route.fallback();
    }
  });

  await page.route("**/api/jobs/job4", async (route: Route) => {
    await route.fulfill({ json: jsonJob({ _id: "job4", status: "completed", progress: 100 }) });
  });

  await page.route("**/api/jobs/job4/results", async (route: Route) => {
    await route.fulfill({
      json: { job: jsonJob({ _id: "job4", status: "completed" }), seller: { name: "Empty Seller" }, products: [] },
    });
  });

  await page.goto("/");
  await page.getByPlaceholder(URL_INPUT_PLACEHOLDER).fill("https://www.indiamart.com/empty-seller/");
  await page.getByRole("button", { name: "Scrape" }).click();

  await expect(page.getByTestId("job-status")).toHaveText("completed", { timeout: 5000 });
  await page.getByTestId("tab-products").click();
  await expect(page.getByText("No product pages detected on this crawl.")).toBeVisible();
});

test("error boundary catches a render error and offers retry", async ({ page }) => {
  await page.route("**/api/jobs", async (route: Route) => {
    const req = route.request();
    if (req.method() === "POST") {
      await route.fulfill({ status: 201, json: { jobId: "job5", status: "pending" } });
    } else if (req.method() === "GET") {
      await route.fulfill({ json: [] });
    } else {
      await route.fallback();
    }
  });

  await page.route("**/api/jobs/job5", async (route: Route) => {
    await route.fulfill({ json: jsonJob({ _id: "job5", status: "completed", progress: 100 }) });
  });

  // `products: null` is invalid per the ProductView[] type but arrives at runtime like this
  // from a malformed/legacy API response — this should crash ProductsTable's .map() call,
  // proving the error boundary actually catches real render errors and isn't just decorative.
  await page.route("**/api/jobs/job5/results", async (route: Route) => {
    await route.fulfill({
      json: { job: jsonJob({ _id: "job5", status: "completed" }), seller: { name: "Broken Seller" }, products: null },
    });
  });

  await page.goto("/");
  await page.getByPlaceholder(URL_INPUT_PLACEHOLDER).fill("https://www.indiamart.com/broken-seller/");
  await page.getByRole("button", { name: "Scrape" }).click();

  await expect(page.getByTestId("job-status")).toHaveText("completed", { timeout: 5000 });
  // The tab bar itself reads products.length for every tab label on first render, so the
  // crash happens as soon as results arrive — no need to click into the products tab first.
  await expect(page.getByTestId("error-boundary-fallback")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("health check API is reachable", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
});
