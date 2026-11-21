(() => {
  const carrusel = document.querySelector(".banner-carrusel");
  const slides = [...carrusel.querySelectorAll(".banner-slide")];
  const indicadores = [
    ...carrusel.querySelectorAll(".banner-indicadores button"),
  ];

  const reducirMovimiento = matchMedia("(prefers-reduced-motion: reduce)");
  let actual = 0;

  let temporizador;
  function programar() {
    clearTimeout(temporizador);
    if (!reducirMovimiento.matches && !document.hidden) {
      temporizador = setTimeout(() => mostrar(actual + 1, false), 3000);
    }
  }
  function mostrar(indice, manual = true) {
    actual = (indice + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.hidden = i !== actual;
    });
    indicadores.forEach((boton, i) => {
      if (i === actual) boton.setAttribute("aria-current", "true");
      else boton.removeAttribute("aria-current");
    });
    if (manual)
      document.getElementById("banner-estado").textContent =
        `Banner ${actual + 1} de ${slides.length}`;
    programar();
  }
  document.getElementById("banner-anterior").onclick = () =>
    mostrar(actual - 1);
  document.getElementById("banner-siguiente").onclick = () =>
    mostrar(actual + 1);
  indicadores.forEach((boton, i) => {
    boton.onclick = () => mostrar(i);
  });
  carrusel.addEventListener("keydown", (evento) => {
    if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
    evento.preventDefault();
    mostrar(actual + (evento.key === "ArrowRight" ? 1 : -1));
    // El foco siempre queda en un control visible después de cambiar.
    if (slides.some((slide) => slide.contains(document.activeElement)))
      indicadores[actual].focus();
  });
  let inicioToque;
  carrusel.addEventListener(
    "touchstart",
    (evento) => {
      const toque = evento.touches[0];
      inicioToque = { x: toque.clientX, y: toque.clientY };
    },
    { passive: true },
  );
  carrusel.addEventListener(
    "touchend",
    (evento) => {
      if (!inicioToque) return;
      const toque = evento.changedTouches[0];
      const dx = toque.clientX - inicioToque.x;
      const dy = toque.clientY - inicioToque.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy))
        mostrar(actual + (dx < 0 ? 1 : -1));
      inicioToque = null;
    },
    { passive: true },
  );
  document.addEventListener("visibilitychange", programar);
  reducirMovimiento.addEventListener("change", programar);
  carrusel.querySelectorAll("[data-busqueda-banner]").forEach((enlace) => {
    enlace.addEventListener("click", () => {
      if (!catalogoCargado) return;
      categoriaSeleccionada = "";
      document.getElementById("categoria-seleccionada").textContent =
        "Todas las categorías";
      buscador.value = enlace.dataset.busquedaBanner;
      configurarCategorias();
      mostrarProductos();
    });
  });
  carrusel.querySelector(".banner-controles").hidden = false;
  programar();
})();
