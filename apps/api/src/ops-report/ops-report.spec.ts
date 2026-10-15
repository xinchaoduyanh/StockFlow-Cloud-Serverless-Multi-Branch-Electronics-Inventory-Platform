import {
  DailyOpsReportEmail,
  OpsStatus,
  buildOpsReportSubject,
  computeOpsStatus,
  formatCount,
  formatLatency,
  formatUsd,
  normalizeRoute,
  rankEndpoints,
  type OpsReportData,
} from "@stockflow/shared";

function healthyReport(overrides: Partial<OpsReportData> = {}): OpsReportData {
  return {
    periodStart: "2026-10-13T00:00:00.000Z",
    periodEnd: "2026-10-14T00:00:00.000Z",
    api: {
      requests: 1284,
      previousRequests: 960,
      clientErrors: 37,
      serverErrors: 0,
      latencyP50Ms: 180,
      latencyP95Ms: 2100,
    },
    topEndpoints: [],
    lambda: { errorsByFunction: [], throttles: 0, coldStarts: 0, avgColdStartMs: null },
    deadLetterQueues: [{ name: "stockflow-report-jobs-dlq", depth: 0 }],
    alarmsInAlarm: [],
    business: null,
    estimatedChargesUsd: 0.12,
    ...overrides,
  };
}

describe("computeOpsStatus", () => {
  it("reports OK when there are no 5xx, dead letters or alarms", () => {
    expect(computeOpsStatus(healthyReport())).toBe(OpsStatus.OK);
  });

  it("asks for attention when the API returned a 5xx", () => {
    const report = healthyReport();
    report.api = { ...report.api!, serverErrors: 2 };
    expect(computeOpsStatus(report)).toBe(OpsStatus.ATTENTION);
  });

  it("asks for attention when a dead-letter queue holds a message", () => {
    const report = healthyReport({
      deadLetterQueues: [{ name: "stockflow-report-jobs-dlq", depth: 1 }],
    });
    expect(computeOpsStatus(report)).toBe(OpsStatus.ATTENTION);
  });

  it("asks for attention when a worker Lambda reported errors", () => {
    const report = healthyReport({
      lambda: {
        errorsByFunction: [{ name: "stockflow-import-recovery-worker", errors: 288 }],
        throttles: 0,
        coldStarts: 0,
        avgColdStartMs: null,
      },
    });
    expect(computeOpsStatus(report)).toBe(OpsStatus.ATTENTION);
  });

  it("reports an incident when any alarm is in ALARM, even if everything else is healthy", () => {
    const report = healthyReport({ alarmsInAlarm: ["stockflow-api-5xx"] });
    expect(computeOpsStatus(report)).toBe(OpsStatus.INCIDENT);
  });

  it("never reports OK when a section that decides the status could not be collected", () => {
    expect(computeOpsStatus(healthyReport({ api: null }))).toBe(OpsStatus.ATTENTION);
    expect(computeOpsStatus(healthyReport({ deadLetterQueues: null }))).toBe(OpsStatus.ATTENTION);
    expect(computeOpsStatus(healthyReport({ alarmsInAlarm: null }))).toBe(OpsStatus.ATTENTION);
  });
});

describe("report formatting", () => {
  it("puts the status label in the subject so the inbox preview is enough", () => {
    expect(buildOpsReportSubject(OpsStatus.ATTENTION, "2026-10-14")).toBe(
      "[StockFlow] Cần xem - báo cáo vận hành 2026-10-14",
    );
  });

  it("formats latency in milliseconds below one second and seconds above", () => {
    expect(formatLatency(180)).toBe("180 ms");
    expect(formatLatency(2100)).toBe("2,1 s");
    expect(formatLatency(null)).toBe("n/a");
  });

  it("formats counts with Vietnamese grouping and money with two decimals", () => {
    expect(formatCount(1284)).toBe("1.284");
    expect(formatUsd(0.1)).toBe("$0.10");
    expect(formatUsd(null)).toBe("n/a");
  });
});

describe("endpoint ranking", () => {
  it("collapses UUID and numeric path segments into one route", () => {
    expect(
      normalizeRoute("GET", "/api/transfers/7f6c1f3e-9d3a-4b1c-8f1e-2a5d6c7b8e90/items/42"),
    ).toBe("GET /api/transfers/:id/items/:id");
  });

  it("sums hits of the same route and returns the busiest first", () => {
    const ranked = rankEndpoints(
      [
        { method: "GET", path: "/api/inventory", hits: 10 },
        { method: "GET", path: "/api/transfers/11111111-1111-1111-1111-111111111111", hits: 4 },
        { method: "GET", path: "/api/transfers/22222222-2222-2222-2222-222222222222", hits: 5 },
      ],
      2,
    );
    expect(ranked).toEqual([
      { route: "GET /api/inventory", hits: 10 },
      { route: "GET /api/transfers/:id", hits: 9 },
    ]);
  });
});

describe("DailyOpsReportEmail", () => {
  it("escapes request paths taken from access logs", () => {
    const html = DailyOpsReportEmail({
      status: OpsStatus.OK,
      reportDate: "2026-10-14",
      data: healthyReport({ topEndpoints: [{ route: "GET /<script>alert(1)</script>", hits: 3 }] }),
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("marks a section as unavailable instead of dropping the email", () => {
    const html = DailyOpsReportEmail({
      status: OpsStatus.ATTENTION,
      reportDate: "2026-10-14",
      data: healthyReport({ api: null }),
    });
    expect(html).toContain("Không lấy được dữ liệu");
  });
});
