// Simulador local: solo datos ficticios, nunca se guardan ni envían tarjetas.
const checkoutDemo = document.createElement("dialog");
checkoutDemo.id = "checkout-demo";
checkoutDemo.className = "checkout-demo";
checkoutDemo.setAttribute("aria-labelledby", "demo-titulo");
checkoutDemo.innerHTML = `
  <button type="button" class="cerrar-panel demo-cerrar" aria-label="Cerrar pago de prueba">×</button>
  <div id="demo-formulario-vista">
    <p class="etiqueta">CHECKOUT · DEMOSTRACIÓN</p>
    <h2 id="demo-titulo">Terminá tu compra</h2>
    <p class="demo-aviso">Pago de prueba. No se realizan cobros. Usá únicamente la tarjeta ficticia del simulador.</p>
    <form id="demo-formulario">
      <fieldset class="demo-metodos"><legend>Medio de pago</legend>
        <label><input type="radio" name="demo-metodo" value="credito" checked /> Crédito</label>
        <label><input type="radio" name="demo-metodo" value="debito" /> Débito</label>
      </fieldset>
      <div class="demo-tarjeta" aria-label="Vista previa de tarjeta ficticia">
        <div><strong>CompraYa</strong><span>PRUEBA</span></div>
        <p id="demo-numero-preview">•••• •••• •••• ••••</p>
        <small>TITULAR DE PRUEBA <span>12/30</span></small>
      </div>
      <button id="demo-usar-tarjeta" class="demo-usar" type="button">+ Agregar tarjeta de prueba</button>
      <div class="demo-campos">
        <label class="demo-ancho">Número de tarjeta<input id="demo-numero" readonly placeholder="Agregá la tarjeta ficticia" /></label>
        <label class="demo-ancho">Titular<input id="demo-titular" readonly placeholder="Nombre ficticio" /></label>
        <label>Vencimiento<input id="demo-vencimiento" readonly placeholder="MM/AA" /></label>
        <label>Código de seguridad<input id="demo-codigo" readonly placeholder="CVV" /></label>
      </div>
      <p class="demo-total">Total de prueba <strong id="demo-total"></strong></p>
      <p id="demo-error" role="status"></p>
      <button class="boton" type="submit">Confirmar pago de prueba</button>
    </form>
  </div>
  <div id="demo-exito" class="demo-exito" hidden tabindex="-1">
    <span class="demo-tilde" aria-hidden="true">✓</span>
    <p class="etiqueta">PAGO SIMULADO</p>
    <h2>¡Compra confirmada!</h2>
    <p id="demo-confirmacion"></p>
    <p>No se realizó ningún cobro. Tu pedido de demostración quedó registrado en Mis compras.</p>
    <button id="demo-continuar" class="boton" type="button">Seguir comprando</button>
  </div>`;
document.body.appendChild(checkoutDemo);
let resolverDemo;
let tarjetaDemoAgregada = false;
function solicitarTarjetaDemo(total) {
  if (checkoutDemo.open) return Promise.resolve(false);
  tarjetaDemoAgregada = false;
  checkoutDemo.querySelector("form").reset();
  checkoutDemo.querySelectorAll(".demo-campos input").forEach((input) => {
    input.value = "";
  });
  document.getElementById("demo-numero-preview").textContent =
    "•••• •••• •••• ••••";
  document.getElementById("demo-error").textContent = "";
  document.getElementById("demo-usar-tarjeta").textContent =
    "+ Agregar tarjeta de prueba";
  document.getElementById("demo-total").textContent =
    formatoPrecio.format(total);
  document.getElementById("demo-formulario-vista").hidden = false;
  document.getElementById("demo-exito").hidden = true;
  checkoutDemo.showModal();
  return new Promise((resolve) => {
    resolverDemo = resolve;
  });
}
checkoutDemo.querySelector(".demo-cerrar").onclick = () => checkoutDemo.close();
checkoutDemo.addEventListener("close", () => {
  if (resolverDemo) {
    resolverDemo(false);
    resolverDemo = null;
  }
  checkoutDemo.querySelectorAll(".demo-campos input").forEach((input) => {
    input.value = "";
  });
});
document.getElementById("demo-usar-tarjeta").onclick = () => {
  tarjetaDemoAgregada = true;
  document.getElementById("demo-numero").value = "4242 4242 4242 4242";
  document.getElementById("demo-titular").value = "TITULAR DE PRUEBA";
  document.getElementById("demo-vencimiento").value = "12/30";
  document.getElementById("demo-codigo").value = "123";
  document.getElementById("demo-numero-preview").textContent =
    "4242 4242 4242 4242";
  document.getElementById("demo-error").textContent = "";
  document.getElementById("demo-usar-tarjeta").textContent =
    "✓ Tarjeta de prueba agregada";
};
document
  .getElementById("demo-formulario")
  .addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!tarjetaDemoAgregada) {
      document.getElementById("demo-error").textContent =
        "Agregá la tarjeta de prueba para continuar.";
      return;
    }
    const resolver = resolverDemo;
    resolverDemo = null;
    checkoutDemo.close();
    resolver?.(true);
  });
function mostrarExitoDemo(pedido) {
  document.getElementById("demo-formulario-vista").hidden = true;
  document.getElementById("demo-exito").hidden = false;
  document.getElementById("demo-confirmacion").textContent =
    `Pedido #${pedido.id} · ${formatoPrecio.format(pedido.total)}`;
  checkoutDemo.showModal();
  document.getElementById("demo-exito").focus();
}
document.getElementById("demo-continuar").onclick = () => {
  checkoutDemo.close();
  if (panelCarrito.open) panelCarrito.close();
  document.getElementById("productos").scrollIntoView();
};
