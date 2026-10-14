const pool = require("./conexion");
const fs = require("node:fs");
const path = require("node:path");
const catalogo = require("./catalogo.json");
async function sembrar() {
  for (const producto of catalogo) {
    if (!fs.existsSync(path.join(__dirname, "../public", producto.imagen)))
      throw new Error(
        "Falta la foto de " + producto.nombre + ". Ejecutá npm run imagenes.",
      );
  }
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    // Impide duplicados si dos cargas se ejecutan simultáneamente.
    await cliente.query("LOCK TABLE productos IN SHARE ROW EXCLUSIVE MODE");
    let insertados = 0;
    for (const p of catalogo) {
      const resultado = await cliente.query(
        "INSERT INTO productos(nombre,precio,stock,categoria,imagen) SELECT $1::varchar,$2::numeric,$3::integer,$4::varchar,$5::text WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre=$1 OR imagen=$5) RETURNING id",
        [p.nombre, p.precio, p.stock, p.categoria, p.imagen],
      );
      insertados += resultado.rowCount;
    }
    // Corrige únicamente el error de codificación conocido del catálogo original.
    await cliente.query(
      "UPDATE productos SET nombre='Micrófono HyperX SoloCast 2 USB' WHERE nombre='Micr?fono HyperX SoloCast 2 USB' AND imagen='/images/productos/microfono.jpg'",
    );
    await cliente.query("COMMIT");
    console.log(
      insertados +
        " productos agregados. Precios, stock e imágenes existentes conservados.",
    );
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}
if (require.main === module)
  sembrar()
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
module.exports = sembrar;
