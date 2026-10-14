const pool = require("./conexion");
pool
  .query(
    require("fs").readFileSync(
      require("path").join(__dirname, "esquema.sql"),
      "utf8",
    ),
  )
  .then(() => console.log("Esquema preparado; datos conservados."))
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
