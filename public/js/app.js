const carrito = new Carrito();
let productos = [];
let categoriaSeleccionada = "";
let catalogoCargado = false;
const buscador = document.getElementById("buscar-productos");
const menuCategorias = document.getElementById("menu-categorias");
const panelCarrito = document.getElementById("carrito");
function abrirCarrito() {
  if (!panelCarrito.open) panelCarrito.showModal();
}
document.getElementById("abrir-carrito").addEventListener("click", abrirCarrito);
document.getElementById("cerrar-carrito").addEventListener("click", () => panelCarrito.close());
panelCarrito.addEventListener("click", (evento) => {
  if (evento.target !== panelCarrito) return;
  const rect = panelCarrito.getBoundingClientRect();
  if (evento.clientX < rect.left || evento.clientX > rect.right || evento.clientY < rect.top || evento.clientY > rect.bottom) panelCarrito.close();
});

function normalizarTexto(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function nombreCategoria(categoria) {
  return categoria === "Placas de video" ? "Tarjetas gráficas" : categoria;
}

function configurarCategorias() {
  const lista = document.getElementById("lista-categorias");
  lista.replaceChildren();
  const categorias = [
    ...new Set(productos.map((p) => p.categoria).filter(Boolean)),
  ].sort((a, b) => nombreCategoria(a).localeCompare(nombreCategoria(b), "es"));
  ["", ...categorias].forEach((categoria) => {
    const cantidad = categoria
      ? productos.filter((p) => p.categoria === categoria).length
      : productos.length;
    const boton = crearBoton(
      "",
      () => {
        categoriaSeleccionada = categoria;
        document.getElementById("categoria-seleccionada").textContent =
          categoria ? nombreCategoria(categoria) : "Todas las categorías";
        lista.querySelectorAll("button").forEach((opcion) => {
          opcion.setAttribute("aria-pressed", String(opcion === boton));
        });
        menuCategorias.open = false;
        menuCategorias.querySelector("summary").focus();
        mostrarProductos();
        document.getElementById("productos").scrollIntoView();
      },
      categoria ? nombreCategoria(categoria) : "Todas las categorías",
    );
    boton.setAttribute(
      "aria-pressed",
      String(categoria === categoriaSeleccionada),
    );
    boton.append(
      crearTexto(
        "span",
        categoria ? nombreCategoria(categoria) : "Todas las categorías",
      ),
      crearTexto("span", cantidad, "cantidad-categoria"),
    );
    lista.appendChild(boton);
  });
}

buscador.addEventListener("input", () => {
  if (catalogoCargado) mostrarProductos();
});
document
  .getElementById("formulario-busqueda")
  .addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!catalogoCargado) return;
    mostrarProductos();
    document.getElementById("productos").scrollIntoView();
  });
document.getElementById("limpiar-filtros").addEventListener("click", () => {
  buscador.value = "";
  categoriaSeleccionada = "";
  document.getElementById("categoria-seleccionada").textContent =
    "Todas las categorías";
  configurarCategorias();
  mostrarProductos();
  buscador.focus();
});
document.addEventListener("click", (evento) => {
  if (!menuCategorias.contains(evento.target)) menuCategorias.open = false;
});
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && menuCategorias.open) {
    menuCategorias.open = false;
    menuCategorias.querySelector("summary").focus();
  }
});

const formatoPrecio = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function crearTexto(etiqueta, texto, clase = "") {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = texto;
  elemento.className = clase;
  return elemento;
}

function crearBoton(texto, accion, etiqueta = texto) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.textContent = texto;
  boton.setAttribute("aria-label", etiqueta);
  boton.addEventListener("click", accion);
  return boton;
}

async function cargarProductos() {
  const estado = document.getElementById("estado-productos");
  try {
    const respuesta = await fetch("/api/productos");
    if (!respuesta.ok) {
      throw new Error("No se pudo obtener el catálogo");
    }
    productos = await respuesta.json();
    carrito.sincronizar(productos);
    catalogoCargado = true;
    configurarCategorias();
    buscador.disabled = false;
    document.querySelector("#formulario-busqueda button").disabled = false;
    mostrarProductos();
    actualizarCarrito();
    document.dispatchEvent(new Event("catalogo-cargado"));
  } catch (error) {
    estado.textContent =
      "No pudimos cargar los productos. Intentá recargar la página.";
    document
      .getElementById("lista-categorias")
      .replaceChildren(
        crearTexto("p", "Categorías no disponibles", "categorias-cargando"),
      );
    console.error("Error cargando productos:", error);
  }
}

function mostrarProductos() {
  const contenedor = document.getElementById("lista-productos");
  contenedor.replaceChildren();

  const palabras = normalizarTexto(buscador.value).split(/\s+/).filter(Boolean);
  const visibles = productos.filter((producto) => {
    const texto = normalizarTexto(
      producto.nombre +
        " " +
        producto.categoria +
        " " +
        nombreCategoria(producto.categoria),
    );
    return (
      (!categoriaSeleccionada ||
        producto.categoria === categoriaSeleccionada) &&
      palabras.every((palabra) => texto.includes(palabra))
    );
  });
  document.getElementById("limpiar-filtros").hidden =
    !categoriaSeleccionada && palabras.length === 0;
  document.getElementById("estado-productos").textContent = !productos.length
    ? "Todavía no hay productos disponibles."
    : !visibles.length
      ? "No encontramos productos con esos filtros. Probá otra búsqueda o categoría."
      : `${visibles.length} ${visibles.length === 1 ? "producto" : "productos"}${categoriaSeleccionada ? " en " + nombreCategoria(categoriaSeleccionada) : " disponibles"}`;

  visibles.forEach((producto) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "producto-card";
    const marco = document.createElement("div");
    marco.className = "producto-imagen";
    const sinFoto = () => {
      marco.classList.add("producto-sin-foto");
      marco.replaceChildren(crearTexto("span", "Foto no disponible"));
    };
    if (producto.imagen) {
      const imagen = document.createElement("img");
      imagen.alt = producto.nombre;
      imagen.loading = "lazy";
      imagen.decoding = "async";
      imagen.width = 320;
      imagen.height = 200;
      imagen.addEventListener("error", sinFoto, { once: true });
      imagen.src = producto.imagen;
      marco.appendChild(imagen);
    } else {
      sinFoto();
    }
    tarjeta.appendChild(marco);
    tarjeta.append(
      crearTexto("p", nombreCategoria(producto.categoria), "categoria"),
      crearTexto("h3", producto.nombre),
      crearTexto("p", formatoPrecio.format(producto.precio), "precio"),
      crearTexto(
        "p",
        Number(producto.stock) > 0
          ? "Stock disponible: " + producto.stock
          : "Sin stock",
        "stock",
      ),
    );
    const boton = crearBoton(
      "Agregar al carrito",
      () => {
        const agregado = carrito.agregarProducto(producto);
        actualizarCarrito(
          agregado
            ? producto.nombre + " agregado al carrito."
            : "No hay más stock disponible.",
        );
        if (agregado) abrirCarrito();
      },
      "Agregar " + producto.nombre + " al carrito",
    );
    boton.className = "boton agregar-producto";
    boton.dataset.productoId = String(producto.id);
    tarjeta.appendChild(boton);
    contenedor.appendChild(tarjeta);
  });
  actualizarBotonesProductos();
}

function actualizarBotonesProductos() {
  document.querySelectorAll(".agregar-producto").forEach((boton) => {
    const producto = productos.find(
      (producto) => String(producto.id) === boton.dataset.productoId,
    );
    const item = carrito.items.find((item) => item.producto.id === producto.id);
    const cantidad = item ? item.cantidad : 0;
    boton.disabled =
      Boolean(window.compraEnCurso) || !(Number(producto.stock) > cantidad);
    boton.textContent =
      Number(producto.stock) <= 0
        ? "Sin stock"
        : boton.disabled
          ? "Stock máximo en el carrito"
          : "Agregar al carrito";
  });
}

function actualizarCarrito(mensaje = "") {
  // Conservamos el foco cuando se vuelve a dibujar un control del carrito.
  const focoAnterior = document.activeElement.dataset.control;
  mostrarCarrito();
  actualizarBotonesProductos();
  const cantidad = carrito.obtenerCantidadTotal();
  document.getElementById("finalizar-compra").disabled =
    Boolean(window.compraEnCurso) || cantidad === 0;
  document.getElementById("cantidad-carrito").textContent = cantidad;
  document.getElementById("unidades-resumen").textContent = cantidad;
  document.getElementById("total-carrito").textContent = formatoPrecio.format(
    carrito.calcularTotal(),
  );
  document.getElementById("mensaje-carrito").textContent = mensaje;
  if (focoAnterior) {
    const controles = Array.from(document.querySelectorAll("[data-control]"));
    const siguiente =
      controles.find(
        (boton) => boton.dataset.control === focoAnterior && !boton.disabled,
      ) || controles.find((boton) => !boton.disabled);
    if (siguiente) {
      siguiente.focus();
    } else {
      document.getElementById("carrito-vacio").focus();
    }
  }
}

function mostrarCarrito() {
  const contenedor = document.getElementById("lista-carrito");
  contenedor.replaceChildren();
  if (carrito.items.length === 0) {
    const vacio = crearTexto(
      "p",
      "Tu carrito está vacío. Buscá un producto en el catálogo y agregalo al carrito.",
      "carrito-vacio",
    );
    vacio.id = "carrito-vacio";
    vacio.tabIndex = -1;
    contenedor.appendChild(vacio);
    return;
  }

  carrito.items.forEach((item) => {
    const { producto, cantidad } = item;
    const fila = document.createElement("article");
    fila.className = "carrito-item";
    const detalle = document.createElement("div");
    detalle.append(
      crearTexto("h3", producto.nombre),
      crearTexto(
        "p",
        formatoPrecio.format(producto.precio) + " por unidad",
        "stock",
      ),
    );
    const controles = document.createElement("div");
    controles.className = "controles-cantidad";
    const menos = crearBoton(
      "−",
      () => {
        carrito.disminuirCantidad(producto.id);
        actualizarCarrito("Cantidad de " + producto.nombre + " actualizada.");
      },
      "Disminuir cantidad de " + producto.nombre,
    );
    menos.dataset.control = "menos-" + producto.id;
    const mas = crearBoton(
      "+",
      () => {
        const aumentado = carrito.aumentarCantidad(producto.id);
        actualizarCarrito(
          aumentado
            ? "Cantidad de " + producto.nombre + " actualizada."
            : "Stock máximo alcanzado.",
        );
      },
      "Aumentar cantidad de " + producto.nombre,
    );
    mas.dataset.control = "mas-" + producto.id;
    mas.disabled = cantidad >= producto.stock;
    controles.append(menos, crearTexto("span", cantidad, "cantidad"), mas);
    const eliminar = crearBoton(
      "Eliminar",
      () => {
        carrito.eliminarProducto(producto.id);
        actualizarCarrito(producto.nombre + " eliminado del carrito.");
      },
      "Eliminar " + producto.nombre + " del carrito",
    );
    eliminar.className = "eliminar";
    eliminar.dataset.control = "eliminar-" + producto.id;
    const subtotal = (Math.round(producto.precio * 100) * cantidad) / 100;
    fila.append(
      detalle,
      controles,
      crearTexto("strong", formatoPrecio.format(subtotal), "subtotal"),
      eliminar,
    );
    contenedor.appendChild(fila);
  });
}

actualizarCarrito();
cargarProductos();
