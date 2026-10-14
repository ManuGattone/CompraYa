const pool = require("../database/conexion");
const { createHash } = require("node:crypto");
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
async function autenticar(req, res, next) {
  const token = req.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("compraya_sesion="))
    ?.slice(16);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const r = await pool.query(
      "SELECT u.id,u.nombre,u.email,u.rol FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token_hash=$1 AND s.vence_en>NOW()",
      [hashToken(token)],
    );
    req.usuario = r.rows[0];
    req.tokenHash = hashToken(token);
  }
  next();
}
function requerirUsuario(req, res, next) {
  if (!req.usuario)
    return res.status(401).json({ mensaje: "Iniciá sesión para continuar." });
  next();
}
function requerirAdmin(req, res, next) {
  if (req.usuario?.rol !== "administrador")
    return res
      .status(req.usuario ? 403 : 401)
      .json({ mensaje: "Acceso exclusivo para administradores." });
  next();
}
function mismoOrigen(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  const permitido =
    process.env.APP_ORIGIN || "http://localhost:" + (process.env.PORT || 3000);
  if (
    (origin && origin !== permitido) ||
    req.headers["sec-fetch-site"] === "cross-site"
  )
    return res.status(403).json({ mensaje: "Origen no permitido." });
  next();
}
module.exports = {
  autenticar,
  requerirUsuario,
  requerirAdmin,
  mismoOrigen,
  hashToken,
};
