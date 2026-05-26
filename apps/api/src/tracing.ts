import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";
import { AwsInstrumentation } from "@opentelemetry/instrumentation-aws-sdk";
import { PrismaInstrumentation } from "@prisma/instrumentation";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { AWSXRayPropagator } from "@opentelemetry/propagator-aws-xray";
import { AWSXRayIdGenerator } from "@opentelemetry/id-generator-aws-xray";

// Configure the OTLP exporter to send traces to the ADOT Collector/X-Ray Daemon
// Default OTLP HTTP endpoint is http://localhost:4318/v1/traces
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || "http://localhost:4318/v1/traces",
});

export const otelSDK = new NodeSDK({
  resource: resourceFromAttributes({
    "service.name": "stockflow-api",
    "service.namespace": "stockflow-cloud",
  }),
  idGenerator: new AWSXRayIdGenerator(), // Generates trace/span IDs in AWS X-Ray format
  textMapPropagator: new AWSXRayPropagator(), // Propagates X-Ray tracing headers (X-Amzn-Trace-Id)
  traceExporter,
  instrumentations: [
    new ExpressInstrumentation(),
    new NestInstrumentation(),
    new AwsInstrumentation({
      suppressInternalInstrumentation: true,
    }),
    new PrismaInstrumentation(),
  ],
});

// Handle graceful shutdown of the tracing SDK
process.on("SIGTERM", () => {
  otelSDK
    .shutdown()
    .then(() => console.log("OpenTelemetry SDK shut down successfully"))
    .catch((err) => console.error("Error shutting down OpenTelemetry SDK", err))
    .finally(() => process.exit(0));
});
