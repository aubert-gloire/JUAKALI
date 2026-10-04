import { connectDB } from '../server/src/db';
import { app } from '../server/src/app';

// Ensure the DB is connected before handling requests.
// In serverless environments the module may be reused across invocations,
// so connectDB() is idempotent (cached connection).
export default async function handler(req: Parameters<typeof app>[0], res: Parameters<typeof app>[1]) {
  await connectDB();
  app(req, res);
}
