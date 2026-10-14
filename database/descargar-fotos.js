// Descarga fotos oficiales y registra su procedencia.
const fs = require("node:fs");
const path = require("node:path");
const manifest = path.join(__dirname, "fuentes-imagenes.json");
const fuentes = JSON.parse(fs.readFileSync(manifest, "utf8"));

async function obtener(url) {
  const respuesta = await fetch(url, {
    signal: AbortSignal.timeout(40000),
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta;
}
async function descargar(item) {
  try {
    if (
      item.imagen &&
      fs.existsSync(path.join(__dirname, "../public", item.imagen))
    )
      return;
    if (!item.url) {
      const html = await (await obtener(item.pagina)).text();
      fs.writeFileSync(
        path.join(require("node:os").tmpdir(), `compraya-${item.archivo}.html`),
        html,
      );
      const metas = html.match(/<meta\b[^>]*>/gi) || [];
      const meta = metas.find((tag) =>
        /(?:property|name)=["']og:image["']/i.test(tag),
      );
      const url = meta?.match(/content=["']([^"']+)["']/i)?.[1];
      if (!url) throw new Error("No se encontró foto og:image");
      item.url = new URL(
        url.replaceAll("&amp;", "&"),
        item.pagina,
      ).href.replace(/^http:/, "https:");
    }
    const respuesta = await obtener(item.url);
    const tipo = respuesta.headers.get("content-type").split(";")[0];
    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[tipo];
    if (!extension) throw new Error(`Formato inesperado: ${tipo}`);
    const contenido = Buffer.from(await respuesta.arrayBuffer());
    item.imagen = `/images/productos/${item.archivo}.${extension}`;
    fs.writeFileSync(path.join(__dirname, "../public", item.imagen), contenido);
    console.log(item.archivo, contenido.length, item.url);
  } catch (error) {
    console.error(item.archivo, error.message);
    process.exitCode = 1;
  }
}
(async () => {
  await Promise.all(fuentes.map(descargar));
  fs.writeFileSync(manifest, JSON.stringify(fuentes, null, 2) + "\n");
})();
