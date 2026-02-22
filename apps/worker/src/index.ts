import "dotenv/config";
import PgBoss from "pg-boss";
import { PrismaClient } from "@prisma/client";
import { registerJobHandlers } from "./jobs";
import { createQueues, scheduleRecurringJobs } from "./scheduler";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const boss = new PgBoss(DATABASE_URL);
const prisma = new PrismaClient();

boss.on("error", (err) => console.error("pg-boss error:", err));

async function main() {
  await boss.start();
  await createQueues(boss);
  await registerJobHandlers(boss, prisma);
  await scheduleRecurringJobs(boss);
  console.log("Worker started, listening for jobs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
