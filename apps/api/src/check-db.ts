import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching latest 5 import jobs...");
  const jobs = await prisma.importJob.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      rows: true,
    },
  });

  for (const job of jobs) {
    console.log(`\n-----------------------------------`);
    console.log(`Job ID: ${job.id}`);
    console.log(`File Name: ${job.fileName}`);
    console.log(`Created At: ${job.createdAt}`);
    console.log(`Status: ${job.status}`);
    console.log(`Rows Count: ${job.rows.length}`);
    console.log(`Valid Rows: ${job.validRows}`);
    console.log(`Invalid Rows: ${job.invalidRows}`);
    console.log(`awsTaskToken exists: ${!!job.awsTaskToken}`);
    if (job.rows.length > 0) {
      console.log("Sample row validation status:", job.rows[0].validationStatus);
      console.log("Sample row raw data:", JSON.stringify(job.rows[0].rawData));
      console.log("Sample row normalized data:", JSON.stringify(job.rows[0].normalizedData));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
