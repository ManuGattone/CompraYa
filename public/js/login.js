// La sesión vive en una cookie HttpOnly; el navegador nunca recibe el hash.
let usuarioActual = null;
async function api(url, opciones = {}) {
  const respuesta = await fetch(url, {
    ...opciones,
    headers: { "Content-Type": "application/json", ...opciones.headers },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok)
    throw Object.assign(
      new Error(datos.mensaje || "No se pudo completar la operación."),
      { status: respuesta.status },
    );
  return datos;
}
function actualizarUsuario(usuario) {
  usuarioActual = usuario;
  document.getElementById("usuario-actual").textContent = usuario
    ? "Hola, " + usuario.nombre
    : "";
  document.getElementById("usuario-actual").hidden = !usuario;
  document.getElementById("abrir-login").hidden = !!usuario;
  document.getElementById("cerrar-sesion").hidden = !usuario;
  document.getElementById("enlace-historial").hidden = !usuario;
  document.getElementById("enlace-admin").hidden =
    usuario?.rol !== "administrador";
  document.getElementById("historial").hidden = !usuario;
  document.getElementById("administracion").hidden =
    usuario?.rol !== "administrador";
  document.getElementById("lista-pedidos").replaceChildren();
  document.getElementById("pedidos-admin").replaceChildren();
  document.getElementById("productos-admin").replaceChildren();
  document.dispatchEvent(new Event("sesion-cambiada"));
}
(() => {
  const dialogo = document.getElementById("dialogo-login");
  const formulario = document.getElementById("formulario-login");
  const nombre = document.getElementById("login-nombre");
  const email = document.getElementById("login-email");
  const clave = document.getElementById("login-clave");
  const mensaje = document.getElementById("mensaje-login");
  const enviar = document.getElementById("enviar-login");
  let registro = false;
  function modo(nuevo) {
    registro = nuevo;
    formulario.reset();
    mensaje.textContent = "";
    document.getElementById("campo-nombre").hidden = !registro;
    nombre.required = registro;
    clave.autocomplete = registro ? "new-password" : "current-password";
    document.getElementById("titulo-login").textContent = registro
      ? "Crear cuenta"
      : "Iniciar sesión";
    enviar.textContent = registro ? "Registrarme" : "Ingresar";
    document.getElementById("alternar-login").textContent = registro
      ? "Ya tengo cuenta. Ingresar"
      : "¿No tenés cuenta? Registrate";
  }
  document.getElementById("abrir-login").addEventListener("click", () => {
    modo(false);
    dialogo.showModal();
    email.focus();
  });
  document
    .getElementById("cerrar-login")
    .addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("close", () => {
    formulario.reset();
    mensaje.textContent = "";
  });
  document.getElementById("alternar-login").addEventListener("click", () => {
    modo(!registro);
    (registro ? nombre : email).focus();
  });
  document
    .getElementById("cerrar-sesion")
    .addEventListener("click", async () => {
      try {
        await api("/api/auth/logout", { method: "POST" });
        actualizarUsuario(null);
      } catch (e) {
        document.getElementById("mensaje-carrito").textContent = e.message;
      }
    });
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    enviar.disabled = true;
    mensaje.textContent = "";
    try {
      const datos = await api(
        "/api/auth/" + (registro ? "registro" : "login"),
        {
          method: "POST",
          body: JSON.stringify({
            nombre: nombre.value,
            email: email.value,
            clave: clave.value,
          }),
        },
      );
      actualizarUsuario(datos.usuario);
      dialogo.close();
    } catch (e) {
      mensaje.textContent = e.message;
    } finally {
      enviar.disabled = false;
    }
  });
  // Retira las cuentas de la vieja simulación al migrar a autenticación real.
  localStorage.removeItem("compraya-cuentas-demo");
  sessionStorage.removeItem("compraya-sesion-demo");
  api("/api/auth/sesion")
    .then((datos) => actualizarUsuario(datos.usuario))
    .catch((e) => {
      document.getElementById("mensaje-carrito").textContent = e.message;
    });
})();
