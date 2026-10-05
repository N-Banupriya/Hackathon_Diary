// Creates the tables. Run once: DATABASE_URL=... npm run db:init
import pg from "pg";
import { readFileSync } from "fs";
const src = readFileSync(new URL("../lib/db.js", import.meta.url), "utf8");
const schema = src.split("export const SCHEMA = `")[1].split("`;")[0];
const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL first"); process.exit(1); }
const local = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query(schema);
await client.end();
console.log("Tables are ready.");
