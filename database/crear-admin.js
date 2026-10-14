// Promueve una cuenta ya registrada; nunca permite elegir el rol desde el registro web.
const pool = require("./conexion");
const email = process.argv[2]?.trim().toLowerCase();
(async () => {
  if (!email)
    throw new Error(
      "Uso: npm run admin -- correo@ejemplo.com (primero registr? esa cuenta).",
    );
  const r = await pool.query(
    "UPDATE usuarios SET rol='administrador' WHERE email=$1 RETURNING id,email",
    [email],
  );
  if (!r.rows.length)
    throw new Error("No existe esa cuenta. Registrala primero.");
  console.log("Cuenta administradora:", r.rows[0].email);
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
