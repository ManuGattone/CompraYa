const configuracionPago = api("/api/pagos/config");
configuracionPago
  .then((config) => {
    document.getElementById("finalizar-compra").textContent = config.habilitado
      ? "Pagar con Mercado Pago (prueba)"
      : "Finalizar compra";
    document.getElementById("nota-pago").hidden = !config.habilitado;
  })
  .catch(() => {});

async function iniciarPagoPrueba(items, clave) {
  const config = await configuracionPago;
  if (!config.habilitado) return false;
  const pago = await api("/api/pagos/preferencia", {
    method: "POST",
    body: JSON.stringify({ items, clave_compra: clave }),
  });
  sessionStorage.setItem(
    "compraya-pago-prueba",
    JSON.stringify({ id: pago.id, usuarioId: usuarioActual.id, items }),
  );
  location.assign(pago.url);
  return true;
}

let verificandoPago = false;
let carritoRestaurado = false;
const idRetorno = new URLSearchParams(location.search).get("pago_prueba");
if (idRetorno && /^[a-f0-9-]{36}$/i.test(idRetorno)) {
  document.getElementById("retorno-pago").hidden = false;
  document.getElementById("estado-pago").textContent =
    "Verificá el pago de prueba. Si hace falta, iniciá sesión con tu cuenta de CompraYa.";
}
function pagoGuardado() {
  try {
    return JSON.parse(sessionStorage.getItem("compraya-pago-prueba"));
  } catch {
    return null;
  }
}
async function verificarPago() {
  const guardado = pagoGuardado();
  const id =
    idRetorno ||
    (guardado?.usuarioId === usuarioActual?.id ? guardado.id : null);
  if (!id || verificandoPago) return;
  const aviso = document.getElementById("retorno-pago");
  const mensaje = document.getElementById("estado-pago");
  const boton = document.getElementById("verificar-pago");
  aviso.hidden = false;
  if (!usuarioActual) {
    mensaje.textContent = "Iniciá sesión para verificar tu pago de prueba.";
    return;
  }
  verificandoPago = true;
  boton.disabled = true;
  try {
    const resultado = await api(
      "/api/pagos/" + encodeURIComponent(id) + "/verificar",
      { method: "POST" },
    );
    if (resultado.estado === "aprobado") {
      mensaje.textContent =
        "Pago de prueba aprobado. Pedido #" +
        resultado.pedido_id +
        " confirmado.";
      boton.hidden = true;
      if (guardado?.id === id && guardado.usuarioId === usuarioActual.id) {
        sessionStorage.removeItem("compraya-pago-prueba");
        carrito.vaciar();
        actualizarCarrito();
      }
      await cargarProductos();
      await cargarPedidos();
      if (usuarioActual.rol === "administrador") await cargarPedidos(true);
      if (idRetorno) history.replaceState(null, "", "/#historial");
    } else {
      mensaje.textContent =
        resultado.estado === "requiere_revision"
          ? "El pago de prueba fue aprobado, pero el pedido requiere revisión: " +
            resultado.mensaje
          : resultado.estado === "rechazado"
            ? "El pago de prueba fue rechazado. Tu carrito se conserva para reintentar."
            : "El pago de prueba todavía no está aprobado o fue cancelado. Podés consultar otra vez o volver al carrito.";
    }
  } catch (e) {
    mensaje.textContent = e.message;
  } finally {
    verificandoPago = false;
    boton.disabled = false;
  }
}
document
  .getElementById("verificar-pago")
  .addEventListener("click", verificarPago);
function restaurarPagoPendiente() {
  const guardado = pagoGuardado();
  if (!catalogoCargado || !usuarioActual) return;
  if (!carritoRestaurado && guardado?.usuarioId === usuarioActual.id) {
    carritoRestaurado = true;
    for (const item of guardado.items || []) {
      const producto = productos.find((p) => p.id === item.id);
      if (!producto) continue;
      for (let n = 0; n < Math.min(item.cantidad, Number(producto.stock)); n++)
        carrito.agregarProducto(producto);
    }
    actualizarCarrito();
    verificarPago();
  } else if (idRetorno && !guardado && !carritoRestaurado) {
    carritoRestaurado = true;
    verificarPago();
  }
}
document.addEventListener("sesion-cambiada", restaurarPagoPendiente);
document.addEventListener("catalogo-cargado", restaurarPagoPendiente);
