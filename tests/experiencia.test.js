const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { chromium } = require("playwright");
const path = require("node:path");

test("vista rápida, scroll, asistente y diseño móvil", async () => {
  const app = express();
  const productos = Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    nombre: "Monitor prueba " + (i + 1),
    categoria: "Monitores",
    precio: 125000,
    stock: i === 1 ? 0 : 3,
    imagen: "/images/no-existe.png",
  }));
  app.get("/api/productos", (_, res) => res.json(productos));
  app.get("/api/auth/sesion", (_, res) => res.json({ usuario: null }));
  app.use(express.static(path.join(__dirname, "../public")));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
    const page = await browser.newPage({
      viewport: { width: 1365, height: 900 },
    });
    const errores = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await page.clock.install();
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.waitForSelector(".producto-card");
    assert.equal(await page.locator(".banner-slide:visible").count(), 1);
    await page.clock.fastForward(3000);
    assert.equal(await page.locator(".banner-graficas").isVisible(), true);
    await page.clock.fastForward(3000);
    assert.equal(await page.locator(".banner-audio").isVisible(), true);
    await page.clock.fastForward(3000);
    assert.equal(await page.locator(".banner-slide").first().isVisible(), true);
    await page.getByRole("button", { name: "Banner siguiente" }).click();
    assert.equal(await page.locator(".banner-graficas").isVisible(), true);
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator(".banner-audio").isVisible(), true);
    assert.equal(
      await page
        .locator(".banner-audio img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      true,
    );
    await page.getByRole("button", { name: "Ir al banner 1" }).click();
    await page.getByRole("button", { name: "Banner anterior" }).click();
    assert.equal(await page.locator(".banner-audio").isVisible(), true);
    await page.locator(".banner-audio a").click();
    assert.equal(
      await page.locator("#buscar-productos").inputValue(),
      "auriculares",
    );
    await page.locator("#buscar-productos").fill("");
    assert.equal(await page.locator("#banner-pausa").count(), 0);
    await page.getByRole("button", { name: "Ir al banner 1" }).click();
    assert.equal(await page.locator(".producto-card").count(), 16);
    assert.ok((await page.locator(".producto-pendiente").count()) > 0);
    const primera = page.locator(".producto-card").first();
    assert.equal(await page.locator(".ver-producto").count(), 0);
    assert.equal(
      await primera.evaluate((e) => getComputedStyle(e).cursor),
      "pointer",
    );
    await primera.focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("#detalle-producto[open]");
    await page.keyboard.press("Escape");
    await primera.getByRole("button", { name: /Agregar/ }).click();
    await page.waitForSelector("#carrito[open]");
    assert.equal(
      await page.locator("#detalle-producto").evaluate((d) => d.open),
      false,
    );
    await page.locator("#lista-carrito .eliminar").click();
    await page.locator("#cerrar-carrito").click();
    await primera.locator("h3").click();
    await page.waitForSelector("#detalle-producto[open]");
    assert.equal(
      await page.locator("#detalle-nombre").textContent(),
      "Monitor prueba 1",
    );
    await page.getByRole("button", { name: "Cerrar detalle" }).click();
    await primera.locator("h3").click();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("#detalle-producto").evaluate((d) => d.open),
      false,
    );
    await primera.locator("h3").click();
    await page.locator("#detalle-agregar").click();
    await page.waitForSelector("#carrito[open]");
    assert.equal(await page.locator("#cantidad-carrito").textContent(), "1");
    await page.locator("#cerrar-carrito").click();
    await page
      .locator(".producto-card")
      .nth(1)
      .locator(".producto-imagen")
      .click();
    assert.equal(await page.locator("#detalle-agregar").isDisabled(), true);
    await page.keyboard.press("Escape");
    await page.locator(".producto-card").last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    assert.equal(
      await page
        .locator(".producto-card")
        .last()
        .evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    await page.locator("#abrir-chat").click();
    await page.locator("#chat-consulta").fill("monitor");
    await page.locator("#chat-consulta").press("Enter");
    assert.deepEqual(errores, []);
    assert.equal(
      await page.locator(".chat-mensaje button").count(),
      3,
      await page.locator("#chat-mensajes").textContent(),
    );
    await page.locator(".chat-mensaje button").first().click();
    await page.waitForSelector("#detalle-producto[open]");
    await page.keyboard.press("Escape");
    await page.locator("#chat-consulta").fill("<img src=x onerror=alert(1)>");
    await page.locator("#chat-consulta").press("Enter");
    assert.equal(await page.locator(".chat-mensajes img").count(), 0);
    await page.locator("#cerrar-chat").click();
    await page.locator("#buscar-productos").fill("Monitor prueba 16");
    assert.equal(await page.locator(".producto-card").count(), 1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#buscar-productos").fill("");
    assert.equal(await page.locator(".producto-pendiente").count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#abrir-chat").click();
    const chat = await page.locator("#chat-compraya").boundingBox();
    assert.ok(chat.x >= 0 && chat.x + chat.width <= 390 && chat.y >= 0);
    await page.locator("#cerrar-chat").click();
    await primera.locator("h3").click();
    const detalle = await page.locator("#detalle-producto").boundingBox();
    assert.ok(detalle.x >= 0 && detalle.x + detalle.width <= 390);
    assert.deepEqual(errores, []);
  } finally {
    if (browser) await browser.close();
    await new Promise((r) => server.close(r));
  }
});
