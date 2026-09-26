import mongoose from "mongoose";
import { env } from "@/lib/config/env";

declare global {
  var _mongooseConn: Promise<typeof mongoose> | undefined;
}

/**
 * Reuses a single connection across hot-reloads in dev and across
 * route handler invocations in prod, instead of opening a new one per request.
 */
export function dbConnect(): Promise<typeof mongoose> {
  if (!global._mongooseConn) {
    global._mongooseConn = mongoose.connect(env.MONGODB_URI);
  }
  return global._mongooseConn;
}
