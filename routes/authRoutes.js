const router = require("express").Router();
const pool = require("../database/conexion");
const Usuario = require("../models/usuario");
const { randomBytes } = require("node:crypto");
const { hashToken, requerirUsuario } = require("../middleware/auth");
const intentos = new Map();
function limitar(req, res, next) {
  const ahora = Date.now();
  const key = req.ip;
  let entrada = intentos.get(key);
  if (!entrada || entrada.vence < ahora) {
    entrada = { cantidad: 0, vence: ahora + 15 * 60 * 1000 };
    intentos.set(key, entrada);
  }
  if (++entrada.cantidad > 30)
    return res
      .status(429)
      .json({ mensaje: "Demasiados intentos. Probá en 15 minutos." });
  if (intentos.size > 10000)
    for (const [k, v] of intentos) if (v.vence < ahora) intentos.delete(k);
  next();
}
function cookie(res, token, edad) {
  res.cookie("compraya_sesion", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: edad,
    path: "/",
  });
}
async function iniciar(res, usuario) {
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO sesiones(token_hash,usuario_id,vence_en) VALUES($1,$2,NOW()+INTERVAL '7 days')",
    [hashToken(token), usuario.id],
  );
  cookie(res, token, 7 * 24 * 60 * 60 * 1000);
  return new Usuario(usuario);
}
function validar(body, registro) {
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    typeof body.clave !== "string" ||
    body.clave.length < 8 ||
    body.clave.length > 128 ||
    (registro && (!nombre || nombre.length > 60))
  ) {
    const e = new Error(
      "Ingresá un correo válido, nombre y contraseña de 8 a 128 caracteres.",
    );
    e.status = 400;
    throw e;
  }
  return { email, nombre, clave: body.clave };
}
router.get("/sesion", (req, res) =>
  res.json({ usuario: req.usuario ? new Usuario(req.usuario) : null }),
);
router.post("/registro", limitar, async (req, res) => {
  const { email, nombre, clave } = validar(req.body, true);
  const hash = await Usuario.hash(clave);
  try {
    const r = await pool.query(
      "INSERT INTO usuarios(nombre,email,password_hash) VALUES($1,$2,$3) RETURNING *",
      [nombre, email, hash],
    );
    res.status(201).json({ usuario: await iniciar(res, r.rows[0]) });
  } catch (e) {
    if (e.code === "23505") {
      e.status = 409;
      e.message = "Ya existe una cuenta con ese correo.";
    }
    throw e;
  }
});
router.post("/login", limitar, async (req, res) => {
  const { email, clave } = validar(req.body, false);
  const r = await pool.query("SELECT * FROM usuarios WHERE email=$1", [email]);
  // Incluso un correo inexistente ejecuta scrypt para reducir diferencias de tiempo.
  const dummy = "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
  const valido = await Usuario.verificar(
    clave,
    r.rows[0]?.password_hash || dummy,
  );
  if (!r.rows[0] || !valido)
    return res
      .status(401)
      .json({ mensaje: "Correo o contraseña incorrectos." });
  if (req.tokenHash)
    await pool.query("DELETE FROM sesiones WHERE token_hash=$1", [
      req.tokenHash,
    ]);
  res.json({ usuario: await iniciar(res, r.rows[0]) });
});
router.post("/logout", requerirUsuario, async (req, res) => {
  await pool.query("DELETE FROM sesiones WHERE token_hash=$1", [req.tokenHash]);
  cookie(res, "", 0);
  res.json({ mensaje: "Sesión cerrada." });
});
module.exports = router;
