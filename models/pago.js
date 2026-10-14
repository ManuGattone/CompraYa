const Pedido = require("./pedido");
const Producto = require("./producto");
const fallo = (mensaje, status = 400) =>
  Object.assign(new Error(mensaje), { status });

class Pago {
  static habilitado() {
    return process.env.MP_TEST_MODE === "true" && !!process.env.MP_ACCESS_TOKEN;
  }
  static async solicitar(ruta, opciones = {}) {
    if (!Pago.habilitado())
      throw fallo("Mercado Pago de prueba todavía no está configurado.", 503);
    const respuesta = await fetch("https://api.mercadopago.com" + ruta, {
      ...opciones,
      headers: {
        Authorization: "Bearer " + process.env.MP_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!respuesta.ok)
      throw fallo(
        "Mercado Pago no pudo completar la operación. Revisá las credenciales de prueba o reintentá.",
        502,
      );
    return respuesta.json();
  }
  static async vendedor() {
    const usuario = await Pago.solicitar("/users/me");
    if (!usuario.tags?.includes("test_user"))
      throw fallo(
        "Esta integración solo acepta credenciales de una cuenta vendedora de prueba.",
        503,
      );
    return usuario.id;
  }
  static async crear(pool, usuarioId, items, clave) {
    const seleccion = Pedido.validarItems(items).map((i) => ({
      id: i.id,
      cantidad: i.cantidad,
    }));
    if (
      typeof clave !== "string" ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(clave)
    )
      throw fallo("Identificador de compra inválido.");
    await Pago.vendedor();
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SELECT id FROM usuarios WHERE id=$1 FOR UPDATE", [
        usuarioId,
      ]);
      let pago = (
        await db.query("SELECT * FROM pagos_prueba WHERE id=$1", [clave])
      ).rows[0];
      if (
        pago &&
        (pago.usuario_id !== usuarioId ||
          JSON.stringify(
            pago.items.map((i) => ({ id: i.id, cantidad: i.cantidad })),
          ) !== JSON.stringify(seleccion))
      )
        throw fallo("Identificador de compra ya utilizado.", 409);
      if (pago?.pedido_id)
        throw fallo("Este pago ya tiene un pedido confirmado.", 409);
      if (!pago) {
        const filas = (
          await db.query("SELECT * FROM productos WHERE id=ANY($1::int[])", [
            seleccion.map((i) => i.id),
          ])
        ).rows;
        const cotizacion = seleccion.map((item) => {
          const fila = filas.find((p) => p.id === item.id);
          if (!fila) throw fallo("Un producto ya no está disponible.", 409);
          const producto = new Producto(fila);
          producto.vender(item.cantidad);
          return {
            ...item,
            nombre: producto.nombre,
            precio: producto.precioCentavos / 100,
          };
        });
        const centavos = cotizacion.reduce(
          (total, i) => total + Math.round(i.precio * 100) * i.cantidad,
          0,
        );
        if (!Number.isSafeInteger(centavos) || centavos > 99999999999999)
          throw fallo("El total excede el límite permitido.");
        pago = (
          await db.query(
            "INSERT INTO pagos_prueba(id,usuario_id,items,total) VALUES($1,$2,$3,$4) RETURNING *",
            [clave, usuarioId, JSON.stringify(cotizacion), centavos / 100],
          )
        ).rows[0];
      }
      if (!pago.url_pago) {
        const origen = new URL(
          process.env.APP_ORIGIN || "http://localhost:3000",
        ).origin;
        const retorno = origen + "/?pago_prueba=" + clave;
        const preferencia = await Pago.solicitar("/checkout/preferences", {
          method: "POST",
          body: JSON.stringify({
            items: pago.items.map((i) => ({
              id: String(i.id),
              title: i.nombre,
              quantity: i.cantidad,
              unit_price: i.precio,
              currency_id: "ARS",
            })),
            external_reference: clave,
            back_urls: { success: retorno, failure: retorno, pending: retorno },
            ...(origen.startsWith("https://") &&
            !["localhost", "127.0.0.1"].includes(new URL(origen).hostname)
              ? { auto_return: "approved" }
              : {}),
          }),
        });
        const destino = new URL(preferencia.init_point);
        if (
          destino.protocol !== "https:" ||
          !/(^|\.)mercadopago\.com(\.ar)?$/.test(destino.hostname)
        )
          throw fallo("Dirección de pago inválida.", 502);
        pago = (
          await db.query(
            "UPDATE pagos_prueba SET preferencia_id=$2,url_pago=$3 WHERE id=$1 RETURNING *",
            [clave, preferencia.id, destino.href],
          )
        ).rows[0];
      }
      await db.query("COMMIT");
      return { id: pago.id, url: pago.url_pago };
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  }
  static async verificar(pool, usuarioId, clave) {
    if (typeof clave !== "string" || !/^[a-f0-9-]{36}$/i.test(clave))
      throw fallo("Identificador inválido.");
    const pago = (
      await pool.query(
        "SELECT * FROM pagos_prueba WHERE id=$1 AND usuario_id=$2",
        [clave, usuarioId],
      )
    ).rows[0];
    if (!pago) throw fallo("Pago no encontrado.", 404);
    if (pago.pedido_id)
      return { estado: "aprobado", pedido_id: pago.pedido_id };
    const vendedor = await Pago.vendedor();
    const respuesta = await Pago.solicitar(
      "/v1/payments/search?external_reference=" + encodeURIComponent(clave),
    );
    const validos = (respuesta.results || []).filter(
      (p) =>
        p.external_reference === clave &&
        p.live_mode === false &&
        String(p.collector_id) === String(vendedor) &&
        p.currency_id === "ARS" &&
        Math.round(Number(p.transaction_amount) * 100) ===
          Math.round(Number(pago.total) * 100),
    );
    const aprobado = validos.find((p) => p.status === "approved");
    if (!aprobado) {
      const estado = validos.some((p) =>
        ["pending", "in_process", "authorized"].includes(p.status),
      )
        ? "pendiente"
        : validos.length
          ? "rechazado"
          : "pendiente";
      await pool.query(
        "UPDATE pagos_prueba SET estado=$2 WHERE id=$1 AND pedido_id IS NULL",
        [clave, estado],
      );
      return { estado };
    }
    const precios = Object.fromEntries(
      pago.items.map((i) => [i.id, Math.round(i.precio * 100)]),
    );
    let pedido;
    try {
      pedido = await Pedido.confirmar(
        pool,
        usuarioId,
        pago.items.map((i) => ({ id: i.id, cantidad: i.cantidad })),
        clave,
        precios,
      );
    } catch (e) {
      if (e.status !== 409) throw e;
      await pool.query(
        "UPDATE pagos_prueba SET estado='requiere_revision',pago_id=$2 WHERE id=$1 AND pedido_id IS NULL",
        [clave, String(aprobado.id)],
      );
      return { estado: "requiere_revision", mensaje: e.message };
    }
    await pool.query(
      "UPDATE pagos_prueba SET estado='aprobado',pago_id=$2,pedido_id=$3 WHERE id=$1",
      [clave, String(aprobado.id), pedido.id],
    );
    return { estado: "aprobado", pedido_id: pedido.id };
  }
}
module.exports = Pago;
