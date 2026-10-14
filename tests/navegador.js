const { spawnSync } = require("node:child_process");
const r = spawnSync(process.execPath, ["--test", "tests/compra.test.js"], {
  stdio: "inherit",
  env: { ...process.env, COMPRAYA_BROWSER_TESTS: "1" },
});
process.exitCode = r.status ?? 1;
