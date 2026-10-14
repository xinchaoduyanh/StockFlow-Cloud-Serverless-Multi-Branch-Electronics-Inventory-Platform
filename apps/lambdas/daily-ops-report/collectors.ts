import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  GetMetricDataCommand,
  type MetricDataQuery,
} from "@aws-sdk/client-cloudwatch";
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  StartQueryCommand,
  type ResultField,
} from "@aws-sdk/client-cloudwatch-logs";
import type { PrismaClient } from "@prisma/client";
import {
  rankEndpoints,
  type OpsApiSection,
  type OpsBusinessSection,
  type OpsEndpointHit,
  type OpsLambdaSection,
  type OpsQueueDepth,
} from "@stockflow/shared/dist/ops-report";

const TOP_ENDPOINT_COUNT = 5;
// Giới hạn hàng đọc từ Logs Insights trước khi gộp ID; đủ cho lưu lượng demo.
const ENDPOINT_QUERY_ROW_LIMIT = 500;
const LOG_QUERY_POLL_INTERVAL_MS = 1000;
const LOG_QUERY_MAX_POLLS = 30;
// Metric SQS chỉ được cập nhật mỗi ~5 phút nên cần cửa sổ rộng hơn một chu kỳ.
const QUEUE_DEPTH_WINDOW_MS = 10 * 60 * 1000;
const BILLING_WINDOW_MS = 24 * 60 * 60 * 1000;
// EstimatedCharges chỉ phát ở us-east-1 và cập nhật vài lần mỗi ngày.
const BILLING_REGION = "us-east-1";

export interface ReportWindow {
  start: Date;
  end: Date;
}

export interface CollectorConfig {
  window: ReportWindow;
  previousWindow: ReportWindow;
  projectPrefix: string;
  apiId: string;
  apiLambdaName: string;
  lambdaNames: string[];
  deadLetterQueueNames: string[];
  apiAccessLogGroup: string;
  apiLogGroup: string;
}

const cloudWatch = new CloudWatchClient({});
const billingCloudWatch = new CloudWatchClient({ region: BILLING_REGION });
const logs = new CloudWatchLogsClient({});

function periodSeconds({ start, end }: ReportWindow): number {
  return Math.max(60, Math.ceil((end.getTime() - start.getTime()) / 1000 / 60) * 60);
}

// Mỗi query dùng period bằng độ dài cửa sổ nên chỉ có một datapoint cho cả cửa sổ.
async function readMetrics(
  window: ReportWindow,
  queries: MetricDataQuery[],
  client: CloudWatchClient = cloudWatch,
): Promise<Map<string, number>> {
  const values = new Map<string, number>();
  let nextToken: string | undefined;
  do {
    const response = await client.send(
      new GetMetricDataCommand({
        StartTime: window.start,
        EndTime: window.end,
        MetricDataQueries: queries,
        NextToken: nextToken,
      }),
    );
    for (const result of response.MetricDataResults ?? []) {
      const [latest] = result.Values ?? [];
      if (result.Id && latest !== undefined) values.set(result.Id, latest);
    }
    nextToken = response.NextToken;
  } while (nextToken);
  return values;
}

function metricQuery(
  id: string,
  namespace: string,
  metricName: string,
  dimensions: Record<string, string>,
  stat: string,
  period: number,
): MetricDataQuery {
  return {
    Id: id,
    MetricStat: {
      Metric: {
        Namespace: namespace,
        MetricName: metricName,
        Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })),
      },
      Period: period,
      Stat: stat,
    },
  };
}

export async function collectApiSection(config: CollectorConfig): Promise<OpsApiSection> {
  const dimensions = { ApiId: config.apiId };
  const apiQuery = (window: ReportWindow, id: string, metricName: string, stat: string) =>
    metricQuery(id, "AWS/ApiGateway", metricName, dimensions, stat, periodSeconds(window));
  const { window, previousWindow } = config;

  const [current, previous] = await Promise.all([
    readMetrics(window, [
      apiQuery(window, "requests", "Count", "Sum"),
      apiQuery(window, "clientErrors", "4xx", "Sum"),
      apiQuery(window, "serverErrors", "5xx", "Sum"),
      apiQuery(window, "p50", "Latency", "p50"),
      apiQuery(window, "p95", "Latency", "p95"),
    ]),
    readMetrics(previousWindow, [apiQuery(previousWindow, "requests", "Count", "Sum")]),
  ]);

  // Metric không có datapoint nghĩa là không có request, không phải lỗi thu thập.
  return {
    requests: current.get("requests") ?? 0,
    previousRequests: previous.get("requests") ?? 0,
    clientErrors: current.get("clientErrors") ?? 0,
    serverErrors: current.get("serverErrors") ?? 0,
    latencyP50Ms: current.get("p50") ?? null,
    latencyP95Ms: current.get("p95") ?? null,
  };
}

export async function collectQueueDepths(config: CollectorConfig): Promise<OpsQueueDepth[]> {
  const end = config.window.end;
  const window = { start: new Date(end.getTime() - QUEUE_DEPTH_WINDOW_MS), end };
  const period = periodSeconds(window);
  const depths = await readMetrics(
    window,
    config.deadLetterQueueNames.map((name, index) =>
      metricQuery(
        `q${index}`,
        "AWS/SQS",
        "ApproximateNumberOfMessagesVisible",
        { QueueName: name },
        "Maximum",
        period,
      ),
    ),
  );
  return config.deadLetterQueueNames.map((name, index) => ({
    name,
    depth: depths.get(`q${index}`) ?? 0,
  }));
}

async function runLogsQuery(
  logGroupName: string,
  window: ReportWindow,
  queryString: string,
): Promise<ResultField[][]> {
  const { queryId } = await logs.send(
    new StartQueryCommand({
      logGroupName,
      startTime: Math.floor(window.start.getTime() / 1000),
      endTime: Math.floor(window.end.getTime() / 1000),
      queryString,
    }),
  );
  if (!queryId) throw new Error(`Logs Insights did not return a query id for ${logGroupName}`);

  for (let attempt = 0; attempt < LOG_QUERY_MAX_POLLS; attempt++) {
    const response = await logs.send(new GetQueryResultsCommand({ queryId }));
    if (response.status === "Complete") return response.results ?? [];
    if (response.status === "Failed" || response.status === "Cancelled") {
      throw new Error(`Logs Insights query on ${logGroupName} ended as ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, LOG_QUERY_POLL_INTERVAL_MS));
  }
  throw new Error(`Logs Insights query on ${logGroupName} did not finish in time`);
}

function fieldValue(row: ResultField[], field: string): string | undefined {
  return row.find((entry) => entry.field === field)?.value;
}

export async function collectTopEndpoints(config: CollectorConfig): Promise<OpsEndpointHit[]> {
  const rows = await runLogsQuery(
    config.apiAccessLogGroup,
    config.window,
    `stats count(*) as hits by httpMethod, path | sort hits desc | limit ${ENDPOINT_QUERY_ROW_LIMIT}`,
  );
  const parsed = rows.flatMap((row) => {
    const method = fieldValue(row, "httpMethod");
    const path = fieldValue(row, "path");
    const hits = Number(fieldValue(row, "hits"));
    return method && path && Number.isFinite(hits) ? [{ method, path, hits }] : [];
  });
  return rankEndpoints(parsed, TOP_ENDPOINT_COUNT);
}

export async function collectLambdaSection(config: CollectorConfig): Promise<OpsLambdaSection> {
  const period = periodSeconds(config.window);
  const queries = [
    ...config.lambdaNames.map((name, index) =>
      metricQuery(`e${index}`, "AWS/Lambda", "Errors", { FunctionName: name }, "Sum", period),
    ),
    metricQuery(
      "throttles",
      "AWS/Lambda",
      "Throttles",
      { FunctionName: config.apiLambdaName },
      "Sum",
      period,
    ),
  ];

  const [metrics, coldStartRows] = await Promise.all([
    readMetrics(config.window, queries),
    runLogsQuery(
      config.apiLogGroup,
      config.window,
      'filter @type = "REPORT" and ispresent(@initDuration) | stats count(*) as coldStarts, avg(@initDuration) as avgInitMs',
    ),
  ]);

  const [coldStartRow] = coldStartRows;
  const avgInitMs = coldStartRow ? Number(fieldValue(coldStartRow, "avgInitMs")) : Number.NaN;
  return {
    errorsByFunction: config.lambdaNames.map((name, index) => ({
      name,
      errors: metrics.get(`e${index}`) ?? 0,
    })),
    throttles: metrics.get("throttles") ?? 0,
    coldStarts: coldStartRow ? Number(fieldValue(coldStartRow, "coldStarts") ?? 0) : 0,
    avgColdStartMs: Number.isFinite(avgInitMs) ? avgInitMs : null,
  };
}

export async function collectAlarmsInAlarm(config: CollectorConfig): Promise<string[]> {
  const names: string[] = [];
  let nextToken: string | undefined;
  do {
    const response = await cloudWatch.send(
      new DescribeAlarmsCommand({
        AlarmNamePrefix: `${config.projectPrefix}-`,
        StateValue: "ALARM",
        NextToken: nextToken,
      }),
    );
    names.push(...(response.MetricAlarms ?? []).flatMap((alarm) => alarm.AlarmName ?? []));
    nextToken = response.NextToken;
  } while (nextToken);
  return names;
}

// Trả null khi tài khoản chưa bật "Receive Billing Alerts" nên metric không tồn tại.
export async function collectEstimatedCharges(config: CollectorConfig): Promise<number | null> {
  const end = config.window.end;
  const window = { start: new Date(end.getTime() - BILLING_WINDOW_MS), end };
  const values = await readMetrics(
    window,
    [
      metricQuery(
        "charges",
        "AWS/Billing",
        "EstimatedCharges",
        { Currency: "USD" },
        "Maximum",
        periodSeconds(window),
      ),
    ],
    billingCloudWatch,
  );
  return values.get("charges") ?? null;
}

export async function collectBusinessSection(
  prisma: PrismaClient,
  window: ReportWindow,
): Promise<OpsBusinessSection> {
  const inWindow = { gte: window.start, lt: window.end };
  const [importsCompleted, importsFailed, committed, reportsExported, transfersApproved] =
    await Promise.all([
      prisma.importJob.count({ where: { status: "COMPLETED", completedAt: inWindow } }),
      prisma.importJob.count({
        where: { status: { in: ["FAILED", "PARTIAL_FAILED"] }, updatedAt: inWindow },
      }),
      prisma.importJob.aggregate({
        where: { status: { in: ["COMPLETED", "PARTIAL_FAILED"] }, updatedAt: inWindow },
        _sum: { committedRows: true },
      }),
      prisma.exportJob.count({ where: { status: "COMPLETED", completedAt: inWindow } }),
      prisma.transfer.count({ where: { approvedAt: inWindow } }),
    ]);

  return {
    importsCompleted,
    importsFailed,
    importRowsCommitted: committed._sum.committedRows ?? 0,
    reportsExported,
    transfersApproved,
  };
}
