const pool = require("../database/conexion");
const Producto = require("../models/producto");
function id(req) {
  const valor = Number(req.params.id);
  if (!Number.isInteger(valor) || valor <= 0)
    throw Object.assign(new Error("ID inválido."), { status: 400 });
  return valor;
}
exports.obtenerProductos = async (req, res) =>
  res.json((await pool.query("SELECT * FROM productos ORDER BY id")).rows);
exports.crearProducto = async (req, res) => {
  const p = new Producto(req.body);
  const r = await pool.query(
    "INSERT INTO productos(nombre,precio,stock,categoria,imagen) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [p.nombre, p.precio, p.stock, p.categoria, p.imagen],
  );
  res.status(201).json({ mensaje: "Producto creado.", producto: r.rows[0] });
};
exports.actualizarProducto = async (req, res) => {
  const identificador = id(req);
  const previo = (
    await pool.query("SELECT * FROM productos WHERE id=$1", [identificador])
  ).rows[0];
  if (!previo)
    return res.status(404).json({ mensaje: "Producto no encontrado." });
  const p = new Producto({ ...previo, ...req.body });
  const r = await pool.query(
    "UPDATE productos SET nombre=$1,precio=$2,stock=$3,categoria=$4,imagen=$5 WHERE id=$6 RETURNING *",
    [p.nombre, p.precio, p.stock, p.categoria, p.imagen, identificador],
  );
  if (!r.rows.length)
    return res.status(404).json({ mensaje: "Producto no encontrado." });
  res.json({ mensaje: "Producto actualizado.", producto: r.rows[0] });
};
exports.eliminarProducto = async (req, res) => {
  const r = await pool.query("DELETE FROM productos WHERE id=$1 RETURNING id", [
    id(req),
  ]);
  res.status(r.rows.length ? 200 : 404).json({
    mensaje: r.rows.length ? "Producto eliminado." : "Producto no encontrado.",
  });
};
