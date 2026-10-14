const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const original = require("../database/conexion");
const { Pool } = require("pg");
const nombreBase = "compraya_test_" + randomUUID().replaceAll("-", "");
let db, server, base, cliente, otro, admin, producto;
async function llamar(ruta, { method = "GET", body, cookie, origin } = {}) {
  const response = await fetch(base + ruta, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(method !== "GET" ? { Origin: origin || base } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function registrar(email) {
  const r = await llamar("/api/auth/registro", {
    method: "POST",
    body: {
      nombre: "Estudiante",
      email,
      clave: "PruebaSegura123",
      rol: "administrador",
    },
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.usuario.rol, "cliente");
  return r;
}
before(async () => {
  await original.query("CREATE DATABASE " + nombreBase);
  db = new Pool({
    ...original.options,
    database: nombreBase,
    connectionString: undefined,
  });
  require.cache[require.resolve("../database/conexion")].exports = db;
  await db.query(
    fs.readFileSync(path.join(__dirname, "../database/esquema.sql"), "utf8"),
  );
  const app = require("../server");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port;
  process.env.APP_ORIGIN = base;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (db) await db.end();
  // Sólo elimina la base temporal creada por esta ejecución, nunca CompraYa.
  if (/^compraya_test_[a-f0-9]{32}$/.test(nombreBase))
    await original.query("DROP DATABASE IF EXISTS " + nombreBase);
  await original.end();
});
test("registro real, hash con sal, rol controlado y correo único", async () => {
  cliente = await registrar("Cliente@ejemplo.com");
  otro = await registrar("otro@ejemplo.com");
  admin = await registrar("admin@ejemplo.com");
  const r = await db.query("SELECT * FROM usuarios WHERE id=$1", [
    cliente.body.usuario.id,
  ]);
  assert.equal(r.rows[0].email, "cliente@ejemplo.com");
  assert.match(r.rows[0].password_hash, /^scrypt:/);
  assert.ok(!JSON.stringify(cliente.body).includes("password_hash"));
  const Usuario = require("../models/usuario");
  assert.notEqual(
    await Usuario.hash("PruebaSegura123"),
    await Usuario.hash("PruebaSegura123"),
  );
  const duplicado = await llamar("/api/auth/registro", {
    method: "POST",
    body: {
      nombre: "Otro",
      email: "cliente@ejemplo.com",
      clave: "PruebaSegura123",
    },
  });
  assert.equal(duplicado.status, 409);
});
test("login, sesión y credenciales incorrectas", async () => {
  const malo = await llamar("/api/auth/login", {
    method: "POST",
    body: { email: "cliente@ejemplo.com", clave: "Incorrecta123" },
  });
  assert.equal(malo.status, 401);
  const bueno = await llamar("/api/auth/login", {
    method: "POST",
    body: { email: "cliente@ejemplo.com", clave: "PruebaSegura123" },
  });
  assert.equal(bueno.status, 200);
  cliente.cookie = bueno.cookie;
  const sesion = await llamar("/api/auth/sesion", { cookie: cliente.cookie });
  assert.equal(sesion.body.usuario.id, cliente.body.usuario.id);
});
test("protege productos y pedidos de anónimos y clientes", async () => {
  for (const [cookie, status] of [
    [undefined, 401],
    [cliente.cookie, 403],
  ]) {
    assert.equal(
      (await llamar("/api/productos", { method: "POST", body: {}, cookie }))
        .status,
      status,
    );
    assert.equal(
      (await llamar("/api/pedidos/todos", { cookie })).status,
      status,
    );
  }
  assert.equal(
    (await llamar("/api/pedidos", { method: "POST", body: {} })).status,
    401,
  );
  assert.equal(
    (
      await llamar("/api/auth/logout", {
        method: "POST",
        cookie: cliente.cookie,
        origin: "https://ajeno.example",
      })
    ).status,
    403,
  );
});
test("administrador crea y edita productos; valida datos", async () => {
  await db.query("UPDATE usuarios SET rol='administrador' WHERE id=$1", [
    admin.body.usuario.id,
  ]);
  const body = {
    nombre: "Producto de prueba",
    categoria: "Teclados",
    precio: 10.25,
    stock: 5,
    imagen: "/images/productos/teclado.png",
  };
  const creado = await llamar("/api/productos", {
    method: "POST",
    cookie: admin.cookie,
    body,
  });
  assert.equal(creado.status, 201);
  producto = creado.body.producto;
  assert.equal(
    (
      await llamar("/api/productos/" + producto.id, {
        method: "PUT",
        cookie: admin.cookie,
        body: { ...body, nombre: "Producto editado" },
      })
    ).status,
    200,
  );
  for (const cambio of [
    { stock: -1 },
    { precio: -5 },
    { imagen: "javascript:alert(1)" },
    { stock: 1.5 },
  ])
    assert.equal(
      (
        await llamar("/api/productos", {
          method: "POST",
          cookie: admin.cookie,
          body: { ...body, ...cambio },
        })
      ).status,
      400,
    );
});
test("compra usa precio del servidor y descuenta stock", async () => {
  const body = {
    items: [{ id: producto.id, cantidad: 2, precio: 0.01 }],
    clave_compra: randomUUID(),
    total: 0.02,
  };
  const r = await llamar("/api/pedidos", {
    method: "POST",
    cookie: cliente.cookie,
    body,
  });
  assert.equal(r.status, 201);
  assert.equal(Number(r.body.pedido.total), 20.5);
  assert.equal(
    (await db.query("SELECT stock FROM productos WHERE id=$1", [producto.id]))
      .rows[0].stock,
    3,
  );
  const repetido = await llamar("/api/pedidos", {
    method: "POST",
    cookie: cliente.cookie,
    body,
  });
  assert.equal(repetido.body.pedido.id, r.body.pedido.id);
  assert.equal(
    (await db.query("SELECT stock FROM productos WHERE id=$1", [producto.id]))
      .rows[0].stock,
    3,
  );
});
test("stock insuficiente revierte toda la compra", async () => {
  const nuevo = (
    await db.query(
      "INSERT INTO productos(nombre,categoria,precio,stock) VALUES('Segundo','Mouse',1,1) RETURNING *",
    )
  ).rows[0];
  const antes = (await db.query("SELECT count(*) FROM pedidos")).rows[0].count;
  const r = await llamar("/api/pedidos", {
    method: "POST",
    cookie: cliente.cookie,
    body: {
      items: [
        { id: producto.id, cantidad: 1 },
        { id: nuevo.id, cantidad: 2 },
      ],
      clave_compra: randomUUID(),
    },
  });
  assert.equal(r.status, 409);
  assert.equal(
    (await db.query("SELECT stock FROM productos WHERE id=$1", [producto.id]))
      .rows[0].stock,
    3,
  );
  assert.equal(
    (await db.query("SELECT count(*) FROM pedidos")).rows[0].count,
    antes,
  );
});
test("dos compras simultáneas no venden dos veces la última unidad", async () => {
  const ultimo = (
    await db.query(
      "INSERT INTO productos(nombre,categoria,precio,stock) VALUES('Última unidad','Mouse',15,1) RETURNING *",
    )
  ).rows[0];
  const respuestas = await Promise.all(
    [cliente, otro].map((u) =>
      llamar("/api/pedidos", {
        method: "POST",
        cookie: u.cookie,
        body: {
          items: [{ id: ultimo.id, cantidad: 1 }],
          clave_compra: randomUUID(),
        },
      }),
    ),
  );
  assert.deepEqual(respuestas.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await db.query("SELECT stock FROM productos WHERE id=$1", [ultimo.id]))
      .rows[0].stock,
    0,
  );
});
test("cantidades inválidas y productos repetidos son rechazados", async () => {
  for (const items of [
    [],
    [{ id: producto.id, cantidad: -1 }],
    [{ id: producto.id, cantidad: 1.5 }],
    [
      { id: producto.id, cantidad: 1 },
      { id: producto.id, cantidad: 1 },
    ],
  ])
    assert.equal(
      (
        await llamar("/api/pedidos", {
          method: "POST",
          cookie: cliente.cookie,
          body: { items, clave_compra: randomUUID() },
        })
      ).status,
      400,
    );
});
test("historial propio y copia de productos sobreviven a su eliminación", async () => {
  const pedidos = await llamar("/api/pedidos", { cookie: cliente.cookie });
  assert.ok(
    pedidos.body.every((p) => p.usuario_id === cliente.body.usuario.id),
  );
  assert.ok(
    pedidos.body.some((p) =>
      p.productos.some(
        (d) =>
          d.nombre === "Producto editado" &&
          d.cantidad === 2 &&
          Number(d.precio) === 10.25,
      ),
    ),
  );
  assert.equal(
    (
      await llamar("/api/productos/" + producto.id, {
        method: "DELETE",
        cookie: admin.cookie,
      })
    ).status,
    200,
  );
  const despues = await llamar("/api/pedidos", { cookie: cliente.cookie });
  assert.ok(
    despues.body.some((p) =>
      p.productos.some(
        (d) => d.producto_id === null && d.nombre === "Producto editado",
      ),
    ),
  );
  assert.ok(
    (await llamar("/api/pedidos/todos", { cookie: admin.cookie })).body
      .length >= 2,
  );
});
test("seed repetible y migración conservan datos", async () => {
  const seed = require("../database/ampliar-catalogo");
  await seed();
  const primero = (await db.query("SELECT count(*) FROM productos")).rows[0]
    .count;
  await seed();
  assert.equal(
    (await db.query("SELECT count(*) FROM productos")).rows[0].count,
    primero,
  );
  const categorias = (
    await db.query(
      "SELECT categoria,count(*) FROM productos WHERE imagen IS NOT NULL GROUP BY categoria",
    )
  ).rows;
  assert.equal(categorias.length, 12);
  assert.ok(categorias.every((c) => Number(c.count) === 5));
  await db.query(
    fs.readFileSync(path.join(__dirname, "../database/esquema.sql"), "utf8"),
  );
  assert.equal(
    (await db.query("SELECT count(*) FROM productos")).rows[0].count,
    primero,
  );
});
test("Carrito mantiene límite, subtotal exacto y vaciado", () => {
  const vm = require("node:vm");
  const contexto = vm.createContext({});
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../public/js/Carrito.js"), "utf8") +
      ";globalThis.Carrito=Carrito;",
    contexto,
  );
  const carrito = new contexto.Carrito();
  assert.ok(
    carrito.agregarProducto({ id: 1, nombre: "A", precio: 0.1, stock: 2 }),
  );
  assert.ok(carrito.aumentarCantidad(1));
  assert.equal(carrito.aumentarCantidad(1), false);
  assert.equal(carrito.calcularTotal(), 0.2);
  carrito.vaciar();
  assert.equal(carrito.items.length, 0);
});
test(
  "navegador: registro, carrito, compra, historial, admin y responsive",
  { skip: !process.env.COMPRAYA_BROWSER_TESTS },
  async () => {
    const { chromium } = require("playwright");
    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1366, height: 900 },
      });
      const errores = [];
      page.on("pageerror", (e) => errores.push(e.message));
      await page.goto(base);
      await page.waitForSelector(".producto-card");
      assert.equal(await page.locator(".producto-card").count(), 62);
      await page.locator("#buscar-productos").fill("Logitech G203");
      assert.equal(await page.locator(".producto-card").count(), 1);
      await page.locator(".agregar-producto").click();
      await page.waitForSelector("#carrito[open]");
      await page.keyboard.press("Escape");
      await page.locator("#abrir-carrito").click();
      await page.locator("#finalizar-compra").click();
      await page.locator("#alternar-login").click();
      await page.locator("#login-nombre").fill("Usuario navegador");
      await page.locator("#login-email").fill("browser@ejemplo.com");
      await page.locator("#login-clave").fill("ClaveNavegador123");
      await page.locator("#enviar-login").click();
      await page.waitForSelector("#cerrar-sesion", { state: "visible" });
      await page.locator("#finalizar-compra").click();
      await page.waitForFunction(() =>
        document
          .querySelector("#mensaje-carrito")
          .textContent.includes("Compra realizada"),
      );
      assert.equal(await page.locator("#cantidad-carrito").textContent(), "0");
      assert.ok(
        (await page.locator("#lista-pedidos").textContent()).includes(
          "Mouse Logitech G203",
        ),
      );
      await page.locator("#cerrar-carrito").click();
      await page.locator("#cerrar-sesion").click();
      await page.waitForSelector("#abrir-login", { state: "visible" });
      await page.locator("#abrir-login").click();
      await page.locator("#login-email").fill("admin@ejemplo.com");
      await page.locator("#login-clave").fill("PruebaSegura123");
      await page.locator("#enviar-login").click();
      await page.waitForSelector("#enlace-admin", { state: "visible" });
      await page.waitForSelector("#productos-admin table");
      await page.locator("#producto-nombre").fill("Producto UI");
      await page.locator("#producto-categoria").fill("Mouse");
      await page.locator("#producto-precio").fill("25");
      await page.locator("#producto-stock").fill("2");
      await page
        .locator("#producto-imagen")
        .fill("/images/productos/mouse.png");
      await page.locator("#formulario-producto button[type=submit]").click();
      await page.waitForFunction(() =>
        document
          .querySelector("#mensaje-admin")
          .textContent.includes("guardado"),
      );
      for (const width of [1366, 390]) {
        await page.setViewportSize({ width, height: 850 });
        if (await page.locator("#limpiar-filtros").isVisible())
          await page.locator("#limpiar-filtros").click();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          "No debe haber desborde horizontal",
        );
      }
      await page.evaluate(async () => {
        const imagenes = [...document.querySelectorAll(".producto-imagen img")];
        await Promise.all(
          imagenes.map((img) => {
            img.loading = "eager";
            if (img.complete) return;
            return new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            });
          }),
        );
      });
      assert.equal(await page.locator(".producto-imagen img").count(), 61);
      assert.ok(
        await page.evaluate(() =>
          [...document.querySelectorAll(".producto-imagen img")].every(
            (img) => img.naturalWidth > 0,
          ),
        ),
        "Las fotos del catálogo deben cargar",
      );
      await page.locator("#buscar-productos").fill("Logitech");
      await page.locator("#productos").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.join(__dirname, "../artifacts/mobile.png"),
        fullPage: false,
      });
      assert.deepEqual(errores, []);
    } finally {
      await browser.close();
    }
  },
);
test("Mercado Pago de prueba: importes del servidor, propiedad, aprobación e idempotencia", async () => {
  const Pago = require("../models/pago");
  const solicitar = Pago.solicitar;
  const token = process.env.MP_ACCESS_TOKEN;
  const modo = process.env.MP_TEST_MODE;
  const clave = randomUUID();
  const p = (
    await db.query(
      "INSERT INTO productos(nombre,precio,stock,categoria) VALUES('Producto pago',50,4,'Prueba') RETURNING *",
    )
  ).rows[0];
  let respuestaPago = [];
  let creaciones = 0;
  let cuentaReal = false;
  Pago.solicitar = async (ruta, opciones) => {
    if (ruta === "/users/me")
      return { id: 999, tags: cuentaReal ? [] : ["test_user"] };
    if (ruta === "/checkout/preferences") {
      creaciones++;
      const body = JSON.parse(opciones.body);
      assert.equal(body.items[0].unit_price, 50);
      assert.equal(body.external_reference, clave);
      assert.equal(body.auto_return, undefined);
      return {
        id: "preferencia-1",
        init_point:
          "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1",
      };
    }
    return { results: respuestaPago };
  };
  try {
    process.env.MP_TEST_MODE = "true";
    process.env.MP_ACCESS_TOKEN = "credencial-falsa-solo-para-test";
    const body = {
      items: [{ id: p.id, cantidad: 2, precio: 1 }],
      clave_compra: clave,
    };
    assert.equal(
      (await llamar("/api/pagos/preferencia", { method: "POST", body })).status,
      401,
    );
    cuentaReal = true;
    assert.equal(
      (
        await llamar("/api/pagos/preferencia", {
          method: "POST",
          body,
          cookie: cliente.cookie,
        })
      ).status,
      503,
    );
    cuentaReal = false;
    assert.equal(
      (
        await llamar("/api/pagos/preferencia", {
          method: "POST",
          body,
          cookie: cliente.cookie,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await llamar("/api/pagos/preferencia", {
          method: "POST",
          body,
          cookie: cliente.cookie,
        })
      ).status,
      201,
    );
    assert.equal(creaciones, 1);
    assert.equal(
      (await db.query("SELECT stock FROM productos WHERE id=$1", [p.id]))
        .rows[0].stock,
      4,
    );
    assert.equal(
      (
        await llamar("/api/pedidos", {
          method: "POST",
          body,
          cookie: cliente.cookie,
        })
      ).status,
      409,
    );
    const ruta = "/api/pagos/" + clave + "/verificar";
    assert.equal(
      (await llamar(ruta, { method: "POST", cookie: otro.cookie })).status,
      404,
    );
    assert.equal(
      (await llamar(ruta, { method: "POST", cookie: cliente.cookie })).body
        .estado,
      "pendiente",
    );
    const aprobado = {
      id: "123456",
      external_reference: clave,
      collector_id: 999,
      live_mode: false,
      currency_id: "ARS",
      transaction_amount: 100,
      status: "approved",
    };
    for (const cambio of [
      { live_mode: true },
      { transaction_amount: 1 },
      { collector_id: 123 },
      { external_reference: randomUUID() },
    ]) {
      respuestaPago = [{ ...aprobado, ...cambio }];
      assert.equal(
        (await llamar(ruta, { method: "POST", cookie: cliente.cookie })).body
          .estado,
        "pendiente",
      );
    }
    respuestaPago = [aprobado];
    const resultado = await llamar(ruta, {
      method: "POST",
      cookie: cliente.cookie,
    });
    assert.equal(resultado.body.estado, "aprobado");
    const repetido = await llamar(ruta, {
      method: "POST",
      cookie: cliente.cookie,
    });
    assert.equal(repetido.body.pedido_id, resultado.body.pedido_id);
    assert.equal(
      (await db.query("SELECT stock FROM productos WHERE id=$1", [p.id]))
        .rows[0].stock,
      2,
    );
    assert.equal(
      (
        await db.query(
          "SELECT COUNT(*)::int AS cantidad FROM pedidos WHERE clave_compra=$1",
          [clave],
        )
      ).rows[0].cantidad,
      1,
    );
  } finally {
    Pago.solicitar = solicitar;
    if (token === undefined) delete process.env.MP_ACCESS_TOKEN;
    else process.env.MP_ACCESS_TOKEN = token;
    if (modo === undefined) delete process.env.MP_TEST_MODE;
    else process.env.MP_TEST_MODE = modo;
  }
});

test("pago aprobado con stock o precio cambiado requiere revisión y no descuenta stock", async () => {
  const Pago = require("../models/pago");
  const solicitar = Pago.solicitar;
  const clave = randomUUID();
  try {
    Pago.solicitar = async (ruta) =>
      ruta === "/users/me"
        ? { id: 999, tags: ["test_user"] }
        : {
            results: [
              {
                id: "654321",
                external_reference: clave,
                collector_id: 999,
                live_mode: false,
                currency_id: "ARS",
                transaction_amount: 50,
                status: "approved",
              },
            ],
          };
    const p = (
      await db.query(
        "INSERT INTO productos(nombre,precio,stock,categoria) VALUES('Producto agotado',50,0,'Prueba') RETURNING *",
      )
    ).rows[0];
    await db.query(
      "INSERT INTO pagos_prueba(id,usuario_id,items,total) VALUES($1,$2,$3,50)",
      [
        clave,
        cliente.body.usuario.id,
        JSON.stringify([{ id: p.id, cantidad: 1, precio: 50 }]),
      ],
    );
    assert.equal(
      (await Pago.verificar(db, cliente.body.usuario.id, clave)).estado,
      "requiere_revision",
    );
    await db.query("UPDATE productos SET stock=2,precio=60 WHERE id=$1", [
      p.id,
    ]);
    assert.equal(
      (await Pago.verificar(db, cliente.body.usuario.id, clave)).estado,
      "requiere_revision",
    );
    assert.equal(
      (await db.query("SELECT stock FROM productos WHERE id=$1", [p.id]))
        .rows[0].stock,
      2,
    );
    assert.equal(
      (
        await db.query(
          "SELECT COUNT(*)::int AS cantidad FROM pedidos WHERE clave_compra=$1",
          [clave],
        )
      ).rows[0].cantidad,
      0,
    );
  } finally {
    Pago.solicitar = solicitar;
  }
});

test(
  "navegador: checkout de prueba y regreso aprobado recuperan el pedido",
  { skip: !process.env.COMPRAYA_BROWSER_TESTS },
  async () => {
    const { chromium } = require("playwright");
    const browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      const clave = randomUUID();
      const errores = [];
      page.on("pageerror", (error) => errores.push(error.message));
      await page.route("**/api/auth/sesion", (ruta) =>
        ruta.fulfill({
          json: { usuario: { id: 123, nombre: "Comprador", rol: "cliente" } },
        }),
      );
      await page.route("**/api/productos", (ruta) =>
        ruta.fulfill({
          json: [
            {
              id: 1,
              nombre: "Teclado de prueba",
              precio: 50,
              stock: 3,
              categoria: "Teclados",
              imagen: "/images/productos/teclado.png",
            },
          ],
        }),
      );
      await page.route("**/api/pedidos", (ruta) => ruta.fulfill({ json: [] }));
      await page.route("**/api/pagos/config", (ruta) =>
        ruta.fulfill({ json: { habilitado: true, modo: "prueba" } }),
      );
      await page.route("**/api/pagos/preferencia", async (ruta) => {
        assert.equal(ruta.request().postDataJSON().items[0].cantidad, 1);
        await ruta.fulfill({
          json: { id: clave, url: base + "/?pago_prueba=" + clave },
        });
      });
      await page.route("**/api/pagos/*/verificar", (ruta) =>
        ruta.fulfill({ json: { estado: "aprobado", pedido_id: 987 } }),
      );
      await page.goto(base);
      await page.locator(".agregar-producto").click();
      await page.waitForFunction(() =>
        document
          .getElementById("finalizar-compra")
          .textContent.includes("Mercado Pago"),
      );
      assert.equal(await page.locator("#nota-pago").isVisible(), true);
      await page.locator("#finalizar-compra").click();
      await page.waitForFunction(() =>
        document
          .getElementById("estado-pago")
          .textContent.includes("Pedido #987 confirmado"),
      );
      assert.equal(await page.locator("#cantidad-carrito").textContent(), "0");
      assert.equal(
        await page.evaluate(() =>
          sessionStorage.getItem("compraya-pago-prueba"),
        ),
        null,
      );
      assert.equal(await page.locator("#verificar-pago").isVisible(), false);
      assert.deepEqual(errores, []);
    } finally {
      await browser.close();
    }
  },
);

test("logout invalida el token en PostgreSQL", async () => {
  assert.equal(
    (
      await llamar("/api/auth/logout", {
        method: "POST",
        cookie: cliente.cookie,
      })
    ).status,
    200,
  );
  assert.equal(
    (await llamar("/api/pedidos", { cookie: cliente.cookie })).status,
    401,
  );
});
