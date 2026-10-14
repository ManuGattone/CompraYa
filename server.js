const express = require("express");
const path = require("node:path");
require("./database/conexion");
const { autenticar, mismoOrigen } = require("./middleware/auth");
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use(mismoOrigen);
app.use(
  "/api",
  (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.body === undefined) req.body = {};
    if (
      req.body === null ||
      Array.isArray(req.body) ||
      typeof req.body !== "object"
    ) {
      return res
        .status(400)
        .json({ mensaje: "El cuerpo de la petición debe ser un objeto JSON." });
    }
    next();
  },
  autenticar,
);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/productos", require("./routes/productoRoutes"));
app.use("/api/pedidos", require("./routes/pedidoRoutes"));
app.use("/api", (req, res) =>
  res.status(404).json({ mensaje: "Ruta no encontrada." }),
);
app.use(express.static(path.join(__dirname, "public")));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error("Error:", err.message);
  res.status(status).json({
    mensaje:
      status >= 500
        ? "No pudimos completar la operación. Revisá la conexión y el esquema de PostgreSQL."
        : err.message,
  });
});
if (require.main === module)
  app.listen(Number(process.env.PORT || 3000), () =>
    console.log("CompraYa: http://localhost:" + (process.env.PORT || 3000)),
  );
module.exports = app;
