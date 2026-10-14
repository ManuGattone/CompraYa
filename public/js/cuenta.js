let compraPendiente = null;
let comprando = false;
let generacionSesion = 0;
function dibujarPedidos(contenedor, pedidos, admin = false) {
  contenedor.replaceChildren();
  if (!pedidos.length) {
    contenedor.append(crearTexto("p", "Todavía no hay pedidos."));
    return;
  }
  for (const pedido of pedidos) {
    const tarjeta = crearTexto("article", "", "pedido-card");
    tarjeta.append(
      crearTexto("h3", "Pedido #" + pedido.id),
      crearTexto(
        "p",
        new Date(pedido.fecha).toLocaleString("es-AR") +
          " · Estado: " +
          pedido.estado,
      ),
    );
    if (admin)
      tarjeta.append(
        crearTexto("p", pedido.usuario_nombre + " · " + pedido.usuario_email),
      );
    const lista = document.createElement("ul");
    for (const p of pedido.productos)
      lista.append(
        crearTexto(
          "li",
          p.nombre +
            " · " +
            p.cantidad +
            " · " +
            formatoPrecio.format(p.precio) +
            " = " +
            formatoPrecio.format(p.subtotal),
        ),
      );
    tarjeta.append(
      lista,
      crearTexto("strong", "Total: " + formatoPrecio.format(pedido.total)),
    );
    contenedor.append(tarjeta);
  }
}
async function cargarPedidos(admin = false) {
  if (!usuarioActual || (admin && usuarioActual.rol !== "administrador"))
    return;
  const generacion = generacionSesion;
  const mensaje = document.getElementById(
    admin ? "mensaje-admin" : "mensaje-pedidos",
  );
  try {
    const pedidos = await api("/api/pedidos" + (admin ? "/todos" : ""));
    if (generacion !== generacionSesion) return;
    dibujarPedidos(
      document.getElementById(admin ? "pedidos-admin" : "lista-pedidos"),
      pedidos,
      admin,
    );
    mensaje.textContent = "";
  } catch (e) {
    if (generacion === generacionSesion) mensaje.textContent = e.message;
  }
}
function dibujarAdmin() {
  if (usuarioActual?.rol !== "administrador") return;
  const datalist = document.getElementById("categorias-admin");
  datalist.replaceChildren();
  for (const categoria of [...new Set(productos.map((p) => p.categoria))]) {
    const opcion = document.createElement("option");
    opcion.value = categoria;
    datalist.append(opcion);
  }
  const tabla = document.createElement("table");
  const encabezado = document.createElement("thead");
  const titulos = document.createElement("tr");
  for (const t of ["Producto", "Categoría", "Precio", "Stock", "Acciones"])
    titulos.append(crearTexto("th", t));
  encabezado.append(titulos);
  tabla.append(encabezado);
  const cuerpo = document.createElement("tbody");
  for (const p of productos) {
    const fila = document.createElement("tr");
    for (const valor of [
      p.nombre,
      p.categoria,
      formatoPrecio.format(p.precio),
      p.stock,
    ])
      fila.append(crearTexto("td", valor));
    const acciones = document.createElement("td");
    const editar = crearBoton("Editar", () => {
      for (const campo of [
        "id",
        "nombre",
        "categoria",
        "precio",
        "stock",
        "imagen",
      ])
        document.getElementById("producto-" + campo).value = p[campo] ?? "";
      document.getElementById("titulo-form-producto").textContent =
        "Editar producto #" + p.id;
      document.getElementById("formulario-producto").scrollIntoView();
      document.getElementById("producto-nombre").focus();
    });
    editar.className = "boton";
    const eliminar = crearBoton("Eliminar", async () => {
      if (
        !confirm(
          "¿Eliminar " + p.nombre + "? Los pedidos anteriores se conservarán.",
        )
      )
        return;
      eliminar.disabled = true;
      try {
        await api("/api/productos/" + p.id, { method: "DELETE" });
        await cargarProductos();
        document.getElementById("mensaje-admin").textContent =
          "Producto eliminado.";
      } catch (e) {
        document.getElementById("mensaje-admin").textContent = e.message;
      } finally {
        eliminar.disabled = false;
      }
    });
    eliminar.className = "boton";
    acciones.append(editar, eliminar);
    fila.append(acciones);
    cuerpo.append(fila);
  }
  tabla.append(cuerpo);
  document.getElementById("productos-admin").replaceChildren(tabla);
}
function limpiarFormulario() {
  document.getElementById("formulario-producto").reset();
  document.getElementById("producto-id").value = "";
  document.getElementById("titulo-form-producto").textContent =
    "Crear producto";
}
document
  .getElementById("cancelar-edicion")
  .addEventListener("click", limpiarFormulario);
document
  .getElementById("formulario-producto")
  .addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const boton = evento.submitter;
    boton.disabled = true;
    const id = document.getElementById("producto-id").value;
    const datos = {};
    for (const campo of ["nombre", "categoria", "imagen"])
      datos[campo] = document.getElementById("producto-" + campo).value;
    datos.precio = Number(document.getElementById("producto-precio").value);
    datos.stock = Number(document.getElementById("producto-stock").value);
    try {
      await api("/api/productos" + (id ? "/" + id : ""), {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(datos),
      });
      limpiarFormulario();
      await cargarProductos();
      document.getElementById("mensaje-admin").textContent =
        "Producto guardado correctamente.";
    } catch (e) {
      document.getElementById("mensaje-admin").textContent = e.message;
    } finally {
      boton.disabled = false;
    }
  });
document
  .getElementById("finalizar-compra")
  .addEventListener("click", async () => {
    if (comprando) return;
    if (!usuarioActual) {
      document.getElementById("mensaje-carrito").textContent =
        "Iniciá sesión para finalizar la compra.";
      document.getElementById("abrir-login").click();
      return;
    }
    const items = carrito.items.map((item) => ({
      id: item.producto.id,
      cantidad: item.cantidad,
    }));
    if (!items.length) return;
    const firma = JSON.stringify([usuarioActual.id, items]);
    if (!compraPendiente || compraPendiente.firma !== firma)
      compraPendiente = { firma, clave: crypto.randomUUID() };
    comprando = true;
    window.compraEnCurso = true;
    document
      .querySelectorAll(
        "#lista-carrito button, .agregar-producto, #cerrar-sesion",
      )
      .forEach((control) => {
        control.disabled = true;
      });
    const boton = document.getElementById("finalizar-compra");
    boton.disabled = true;
    document.getElementById("mensaje-carrito").textContent =
      "Confirmando compra…";
    try {
      const resultado = await api("/api/pedidos", {
        method: "POST",
        body: JSON.stringify({ items, clave_compra: compraPendiente.clave }),
      });
      compraPendiente = null;
      carrito.vaciar();
      actualizarCarrito();
      await cargarProductos();
      document.getElementById("mensaje-carrito").textContent =
        resultado.mensaje +
        " Pedido #" +
        resultado.pedido.id +
        ". Total: " +
        formatoPrecio.format(resultado.pedido.total);
      await cargarPedidos();
      if (usuarioActual?.rol === "administrador") await cargarPedidos(true);
    } catch (e) {
      if (e.status === 409) await cargarProductos();
      document.getElementById("mensaje-carrito").textContent =
        e.message +
        (e.status === 409
          ? " Revisá las cantidades del carrito actualizado."
          : " Tu carrito se conserva; podés reintentar.");
    } finally {
      comprando = false;
      window.compraEnCurso = false;
      document.getElementById("cerrar-sesion").disabled = false;
      actualizarCarrito(document.getElementById("mensaje-carrito").textContent);
    }
  });
document
  .getElementById("recargar-pedidos")
  .addEventListener("click", () => cargarPedidos());
document
  .getElementById("recargar-admin")
  .addEventListener("click", () => cargarPedidos(true));
document.addEventListener("sesion-cambiada", () => {
  generacionSesion++;
  compraPendiente = null;
  limpiarFormulario();
  if (usuarioActual) {
    cargarPedidos();
    if (usuarioActual.rol === "administrador") {
      dibujarAdmin();
      cargarPedidos(true);
    }
  }
});
document.addEventListener("catalogo-cargado", dibujarAdmin);
