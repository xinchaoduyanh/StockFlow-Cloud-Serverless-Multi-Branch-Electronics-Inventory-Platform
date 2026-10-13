const fs = require("fs");

// Auto-deploy chỉ được tạo hoặc sửa các resource này. Xoá hay thay thế chúng làm mất dữ liệu
// hoặc đổi địa chỉ công khai, nên phải chạy tay có chủ đích.
const PROTECTED_TYPES = new Set([
  "aws_s3_bucket",
  "aws_sqs_queue",
  "aws_ssm_parameter",
  "aws_apigatewayv2_domain_name",
  "aws_cloudfront_distribution",
]);

function findDestructiveChanges(plan) {
  return (plan.resource_changes ?? [])
    .filter(
      (change) => PROTECTED_TYPES.has(change.type) && change.change.actions.includes("delete"),
    )
    .map((change) => ({ address: change.address, actions: change.change.actions }));
}

function main(planPath) {
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const blocked = findDestructiveChanges(plan);
  if (blocked.length === 0) {
    console.log("Plan safety check passed: no delete or replace on protected resources.");
    return 0;
  }
  console.error("Plan deletes or replaces protected resources; apply it by hand on purpose:");
  blocked.forEach(({ address, actions }) =>
    console.error(`  - ${address} (${actions.join(", ")})`),
  );
  return 1;
}

if (require.main === module) {
  process.exit(main(process.argv[2]));
}

module.exports = { findDestructiveChanges };
