import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "execute-sips",
  { hours: 1 }, // Run every hour
  internal.scheduler.executeBatch
);

export default crons;
