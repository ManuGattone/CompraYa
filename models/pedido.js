const Producto = require("./producto");
class Pedido {
  static validarItems(items) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 100)
      throw Object.assign(
        new Error("El carrito debe contener entre 1 y 100 productos."),
        { status: 400 },
      );
    const ids = new Set();
    for (const item of items) {
      if (
        !item ||
        !Number.isInteger(item.id) ||
        item.id <= 0 ||
        !Number.isInteger(item.cantidad) ||
        item.cantidad <= 0 ||
        item.cantidad > 10000 ||
        ids.has(item.id)
      )
        throw Object.assign(new Error("Productos o cantidades inválidos."), {
          status: 400,
        });
      ids.add(item.id);
    }
    return [...items].sort((a, b) => a.id - b.id);
  }
  static async confirmar(pool, usuarioId, items, clave) {
    const seleccion = Pedido.validarItems(items);
    if (
      typeof clave !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        clave,
      )
    )
      throw Object.assign(new Error("Identificador de compra inválido."), {
        status: 400,
      });
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      // Serializa reintentos de un mismo usuario; el stock se bloquea en orden de id.
      await db.query("SELECT id FROM usuarios WHERE id=$1 FOR UPDATE", [
        usuarioId,
      ]);
      const previo = await db.query(
        "SELECT * FROM pedidos WHERE usuario_id=$1 AND clave_compra=$2",
        [usuarioId, clave],
      );
      if (previo.rows.length) {
        await db.query("COMMIT");
        return previo.rows[0];
      }
      const r = await db.query(
        "SELECT * FROM productos WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE",
        [seleccion.map((i) => i.id)],
      );
      let totalCentavos = 0;
      const detalles = [];
      for (const item of seleccion) {
        const fila = r.rows.find((p) => p.id === item.id);
        if (!fila)
          throw Object.assign(new Error("Un producto ya no está disponible."), {
            status: 409,
          });
        const producto = new Producto(fila);
        producto.vender(item.cantidad);
        const subtotal = producto.precioCentavos * item.cantidad;
        totalCentavos += subtotal;
        detalles.push({ producto, cantidad: item.cantidad, subtotal });
      }
      if (
        !Number.isSafeInteger(totalCentavos) ||
        totalCentavos > 99999999999999
      )
        throw Object.assign(new Error("El total excede el límite permitido."), {
          status: 400,
        });
      const pedido = (
        await db.query(
          "INSERT INTO pedidos(usuario_id,total,clave_compra) VALUES($1,$2,$3) RETURNING *",
          [usuarioId, totalCentavos / 100, clave],
        )
      ).rows[0];
      for (const { producto, cantidad, subtotal } of detalles) {
        await db.query(
          "INSERT INTO detalles_pedido(pedido_id,producto_id,nombre,cantidad,precio,subtotal) VALUES($1,$2,$3,$4,$5,$6)",
          [
            pedido.id,
            producto.id,
            producto.nombre,
            cantidad,
            producto.precioCentavos / 100,
            subtotal / 100,
          ],
        );
        await db.query("UPDATE productos SET stock=$1 WHERE id=$2", [
          producto.stock,
          producto.id,
        ]);
      }
      await db.query("COMMIT");
      return pedido;
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  }
  static async listar(pool, usuarioId) {
    const r = await pool.query(
      `SELECT p.*,u.nombre AS usuario_nombre,u.email AS usuario_email,
   COALESCE(json_agg(json_build_object('producto_id',d.producto_id,'nombre',d.nombre,'cantidad',d.cantidad,'precio',d.precio,'subtotal',d.subtotal) ORDER BY d.id) FILTER(WHERE d.id IS NOT NULL),'[]') AS productos
   FROM pedidos p JOIN usuarios u ON u.id=p.usuario_id LEFT JOIN detalles_pedido d ON d.pedido_id=p.id
   WHERE ($1::int IS NULL OR p.usuario_id=$1) GROUP BY p.id,u.id ORDER BY p.fecha DESC,p.id DESC`,
      [usuarioId],
    );
    return r.rows;
  }
}
module.exports = Pedido;
