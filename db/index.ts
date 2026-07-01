import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
    throw "No process.env.DATABASE_URL Found";
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema, logger: true })
export default db
