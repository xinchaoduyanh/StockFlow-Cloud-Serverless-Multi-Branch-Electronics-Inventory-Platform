const test = require("node:test");
const assert = require("node:assert");
const { findDestructiveChanges } = require("./check-plan-safety");

const change = (type, actions) => ({ address: `${type}.example`, type, change: { actions } });

test("blocks deleting a protected resource", () => {
  const result = findDestructiveChanges({
    resource_changes: [change("aws_s3_bucket", ["delete"])],
  });
  assert.deepStrictEqual(result, [{ address: "aws_s3_bucket.example", actions: ["delete"] }]);
});

test("blocks replacing a protected resource in either order", () => {
  const plan = {
    resource_changes: [
      change("aws_sqs_queue", ["delete", "create"]),
      change("aws_cloudfront_distribution", ["create", "delete"]),
    ],
  };
  assert.strictEqual(findDestructiveChanges(plan).length, 2);
});

test("allows creating and updating protected resources", () => {
  const plan = {
    resource_changes: [
      change("aws_s3_bucket", ["create"]),
      change("aws_ssm_parameter", ["update"]),
    ],
  };
  assert.deepStrictEqual(findDestructiveChanges(plan), []);
});

test("allows replacing resources that are not protected", () => {
  const plan = { resource_changes: [change("aws_lambda_function", ["delete", "create"])] };
  assert.deepStrictEqual(findDestructiveChanges(plan), []);
});

test("accepts a plan with no resource changes", () => {
  assert.deepStrictEqual(findDestructiveChanges({}), []);
});
