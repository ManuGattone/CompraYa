const path = require("node:path");
try {
  process.loadEnvFile(path.join(__dirname, "../.env"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const { Pool } = require("pg");
module.exports = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || "localhost",
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
      },
);
