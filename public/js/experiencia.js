// Vista rápida, entradas al hacer scroll y asistente local del catálogo.
const experiencia = document.createElement("div");
experiencia.innerHTML = `
  <dialog id="detalle-producto" class="detalle-producto" aria-labelledby="detalle-nombre">
    <button type="button" class="cerrar-panel detalle-cerrar" aria-label="Cerrar detalle">×</button>
    <div class="detalle-layout">
      <div id="detalle-imagen" class="detalle-imagen"></div>
      <div class="detalle-info">
        <p class="etiqueta">CONOCÉ TU PRÓXIMO UPGRADE</p>
        <p id="detalle-categoria" class="categoria"></p>
        <h2 id="detalle-nombre"></h2>
        <p id="detalle-precio" class="precio"></p>
        <p id="detalle-stock" class="detalle-stock"></p>
        <p class="detalle-nota">Precio en pesos argentinos. Sumalo a tu carrito y revisá tu compra antes de finalizar.</p>
        <button id="detalle-agregar" type="button" class="boton"></button>
        <button type="button" class="detalle-volver">Seguir explorando</button>
      </div>
    </div>
  </dialog>
  <aside id="chat-compraya" class="chat" aria-labelledby="chat-titulo" hidden>
    <header class="chat-encabezado">
      <span class="chat-avatar" aria-hidden="true">✦</span>
      <div><h2 id="chat-titulo">Tu guía CompraYa</h2><p>Asistente automático del catálogo</p></div>
      <button id="cerrar-chat" type="button" aria-label="Cerrar asistente">×</button>
    </header>
    <div id="chat-mensajes" class="chat-mensajes" role="log" aria-label="Conversación" aria-live="polite" aria-relevant="additions"></div>
    <div class="chat-sugerencias" aria-label="Consultas sugeridas">
      <button type="button">Buscar productos</button><button type="button">Cómo comprar</button><button type="button">Mi carrito</button>
    </div>
    <form id="chat-formulario" class="chat-formulario">
      <label class="solo-lectores" for="chat-consulta">Escribí tu consulta</label>
      <input id="chat-consulta" placeholder="¿Qué estás buscando?" maxlength="300" autocomplete="off" required />
      <button type="submit" aria-label="Enviar consulta">↗</button>
    </form>
    <p class="chat-pie">Respuestas automáticas · Sin atención humana en vivo</p>
  </aside>
  <button id="abrir-chat" class="chat-lanzador" type="button" aria-expanded="false" aria-controls="chat-compraya">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 11h8M7 15h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    <span>¿Te ayudamos?</span><span class="chat-indicador" aria-hidden="true"></span>
  </button>`;
document.body.appendChild(experiencia);

const detalleProducto = document.getElementById("detalle-producto");
function abrirDetalleProducto(producto) {
  // Consultamos siempre el catálogo actual, incluso desde una respuesta anterior del chat.
  producto = productos.find((p) => String(p.id) === String(producto.id));
  if (!producto) return;
  document.getElementById("detalle-nombre").textContent = producto.nombre;
  document.getElementById("detalle-categoria").textContent = nombreCategoria(
    producto.categoria,
  );
  document.getElementById("detalle-precio").textContent = formatoPrecio.format(
    producto.precio,
  );
  document.getElementById("detalle-stock").textContent =
    Number(producto.stock) > 0
      ? `● Disponible · ${producto.stock} unidades en stock`
      : "Sin stock por el momento";
  const marco = document.getElementById("detalle-imagen");
  marco.replaceChildren();
  const sinFoto = () =>
    marco.replaceChildren(crearTexto("p", "Foto no disponible", "stock"));
  if (producto.imagen) {
    const imagen = document.createElement("img");
    imagen.alt = producto.nombre;
    imagen.addEventListener("error", sinFoto, { once: true });
    imagen.src = producto.imagen;
    marco.appendChild(imagen);
  } else sinFoto();
  const agregar = document.getElementById("detalle-agregar");
  agregar.classList.add("agregar-producto");
  agregar.dataset.productoId = String(producto.id);
  agregar.onclick = () => {
    const agregado = carrito.agregarProducto(producto);
    actualizarCarrito(
      agregado
        ? producto.nombre + " agregado al carrito."
        : "No hay más stock disponible.",
    );
    if (agregado) {
      detalleProducto.close();
      abrirCarrito();
    }
  };
  actualizarBotonesProductos();
  if (!detalleProducto.open) detalleProducto.showModal();
}
detalleProducto.querySelector(".detalle-cerrar").onclick = () =>
  detalleProducto.close();
detalleProducto.querySelector(".detalle-volver").onclick = () =>
  detalleProducto.close();
detalleProducto.addEventListener("click", (evento) => {
  if (evento.target !== detalleProducto) return;
  const r = detalleProducto.getBoundingClientRect();
  if (
    evento.clientX < r.left ||
    evento.clientX > r.right ||
    evento.clientY < r.top ||
    evento.clientY > r.bottom
  )
    detalleProducto.close();
});

const movimientoReducido = matchMedia("(prefers-reduced-motion: reduce)");
const observadorProductos =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entradas) => {
          entradas.forEach(({ target, isIntersecting }) => {
            if (!isIntersecting) return;
            target.classList.remove("producto-pendiente");
            target.classList.add("producto-visible");
            target.addEventListener(
              "animationend",
              () => target.classList.remove("producto-visible"),
              { once: true },
            );
            observadorProductos.unobserve(target);
          });
        },
        { threshold: 0.08 },
      )
    : null;
document.addEventListener("catalogo-redibujando", () =>
  observadorProductos?.disconnect(),
);
document.addEventListener("catalogo-renderizado", () => {
  if (!observadorProductos || movimientoReducido.matches) return;
  document.querySelectorAll(".producto-card").forEach((tarjeta) => {
    tarjeta.classList.add("producto-pendiente");
    observadorProductos.observe(tarjeta);
    tarjeta.addEventListener(
      "focusin",
      () => {
        tarjeta.classList.remove("producto-pendiente");
        observadorProductos.unobserve(tarjeta);
      },
      { once: true },
    );
  });
});
movimientoReducido.addEventListener("change", () => {
  if (!movimientoReducido.matches) return;
  observadorProductos?.disconnect();
  document
    .querySelectorAll(".producto-pendiente")
    .forEach((t) => t.classList.remove("producto-pendiente"));
});

const chat = document.getElementById("chat-compraya");
const lanzadorChat = document.getElementById("abrir-chat");
const consultaChat = document.getElementById("chat-consulta");
const mensajesChat = document.getElementById("chat-mensajes");
function alternarChat(abrir) {
  chat.hidden = !abrir;
  lanzadorChat.setAttribute("aria-expanded", String(abrir));
  if (abrir) consultaChat.focus();
  else lanzadorChat.focus();
}
lanzadorChat.onclick = () => alternarChat(chat.hidden);
document.getElementById("cerrar-chat").onclick = () => alternarChat(false);
chat.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") {
    evento.preventDefault();
    alternarChat(false);
  }
});
function mensajeChat(texto, usuario = false) {
  const mensaje = crearTexto(
    "div",
    texto,
    "chat-mensaje" + (usuario ? " chat-usuario" : ""),
  );
  mensaje.setAttribute("aria-label", usuario ? "Vos" : "Asistente CompraYa");
  mensajesChat.appendChild(mensaje);
  // Acotamos el historial durante visitas largas.
  while (mensajesChat.children.length > 60)
    mensajesChat.firstElementChild.remove();
  mensajesChat.scrollTop = mensajesChat.scrollHeight;
  return mensaje;
}
document.addEventListener("DOMContentLoaded", () =>
  mensajeChat(
    "¡Hola! Soy la guía automática de CompraYa ✦ Busquemos tu próximo componente. Decime un producto, una marca o elegí una opción de abajo.",
  ),
);
function responderChat(consulta) {
  const texto = normalizarTexto(consulta);
  if (/\b(hola|buenas|hey)\b/.test(texto)) {
    mensajeChat(
      "¡Hola! ¿Buscás un monitor, un teclado, auriculares o algún componente? Escribí el nombre o la marca y consulto el catálogo.",
    );
  } else if (/carrito/.test(texto)) {
    const respuesta = mensajeChat(
      `Tenés ${carrito.obtenerCantidadTotal()} unidades en el carrito. Total: ${formatoPrecio.format(carrito.calcularTotal())}.`,
    );
    respuesta.appendChild(crearBoton("Ver mi carrito →", abrirCarrito));
  } else if (/comprar|compra|pagar|pago/.test(texto)) {
    mensajeChat(
      "Abrí la vista rápida de un producto o agregalo directamente al carrito. Revisá las cantidades y elegí Finalizar compra. Para completar la compra necesitás iniciar sesión o registrarte. El carrito muestra el total antes de confirmar.",
    );
  } else if (/envio|entrega|garantia|devolucion|contacto|humano/.test(texto)) {
    mensajeChat(
      "No tengo información confirmada sobre envíos, garantías o canales de atención. Soy un asistente automático: puedo ayudarte a buscar productos, consultar precios y stock, o revisar tu carrito.",
    );
  } else if (texto === "buscar productos" || /ayuda|que podes/.test(texto)) {
    mensajeChat(
      "Escribí un producto, categoría, marca o modelo, por ejemplo «monitor» o «Logitech». Te muestro hasta tres coincidencias con precio y stock actuales.",
    );
  } else if (!catalogoCargado) {
    mensajeChat(
      "El catálogo todavía no está disponible. Si no termina de cargar, recargá la página. Mientras tanto puedo explicarte cómo comprar o ayudarte con el carrito.",
    );
  } else {
    const palabras = texto
      .split(/\s+/)
      .filter(
        (p) =>
          p.length > 1 &&
          ![
            "busco",
            "buscar",
            "quiero",
            "tenes",
            "tienen",
            "necesito",
            "precio",
            "stock",
            "hay",
            "ver",
            "un",
            "una",
            "de",
            "el",
            "la",
            "los",
            "las",
            "me",
            "para",
            "por",
            "favor",
            "mostrar",
            "productos",
          ].includes(p),
      );
    const coincidencias = palabras.length
      ? productos.filter((p) => {
          const descripcion = normalizarTexto(
            p.nombre + " " + p.categoria + " " + nombreCategoria(p.categoria),
          );
          return palabras.every((palabra) => descripcion.includes(palabra));
        })
      : [];
    const respuesta = mensajeChat(
      coincidencias.length
        ? `Encontré ${coincidencias.length} ${coincidencias.length === 1 ? "opción" : "opciones"}. Tocá una para ver sus detalles:`
        : "No encontré coincidencias. Probá con una marca o una palabra más general, como «monitor», «teclado» o «auriculares».",
    );
    coincidencias.slice(0, 3).forEach((p) => {
      const boton = crearBoton(
        `${p.nombre} · ${formatoPrecio.format(p.precio)} · ${Number(p.stock) > 0 ? "Disponible" : "Sin stock"}`,
        () => abrirDetalleProducto(p),
      );
      respuesta.appendChild(boton);
    });
    mensajesChat.scrollTop = mensajesChat.scrollHeight;
  }
}
function enviarConsulta(texto) {
  texto = texto.trim().slice(0, 300);
  if (!texto) return;
  mensajeChat(texto, true);
  responderChat(texto);
}
document
  .getElementById("chat-formulario")
  .addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarConsulta(consultaChat.value);
    consultaChat.value = "";
    consultaChat.focus();
  });
document.querySelectorAll(".chat-sugerencias button").forEach((boton) => {
  boton.onclick = () => enviarConsulta(boton.textContent);
});
