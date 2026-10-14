# CompraYa

Tienda de tecnología desarrollada como proyecto IFTS de **Programación Orientada a Objetos**. Permite explorar productos, registrarse, comprar según el stock disponible y consultar pedidos. Incluye administración de productos y consulta de todas las compras.

Usa Node.js 24, Express 5, PostgreSQL, HTML, CSS y JavaScript. Mantiene la paleta violeta/turquesa, el carrito y el diseño responsive original. Los precios están expresados en pesos argentinos (ARS).

## Instalación y configuración

1. Instalá Node.js 24 o superior y PostgreSQL. Iniciá el servicio de PostgreSQL.
2. Desde la carpeta del proyecto, ejecutá `npm install` (o `npm ci` para instalar las versiones del lockfile).
3. Copiá `.env.example` a `.env` y completá los datos de tu PostgreSQL. En PowerShell: `Copy-Item .env.example .env`. Si ya tenés un archivo `.env`, conservá tu configuración.
4. Si empezás de cero, creá la base `CompraYa` desde pgAdmin o con `createdb -U postgres CompraYa`. Si ya existe, usala sin recrearla.
5. Ejecutá `npm run migrate` y luego `npm run seed`.
6. Ejecutá `npm start` y abrí **http://localhost:3000**. Para desarrollo con recarga del servidor: `npm run dev`.

En Windows, si PowerShell bloquea npm.ps1, usá `npm.cmd` en lugar de `npm`; no hace falta cambiar la política del sistema. Por ejemplo: `npm.cmd start`.

### Variables de entorno

| Variable            | Función                                                              |
| ------------------- | -------------------------------------------------------------------- |
| PGHOST / PGPORT     | Servidor y puerto de PostgreSQL; por defecto localhost y 5432        |
| PGDATABASE          | Nombre de la base, por ejemplo CompraYa                              |
| PGUSER / PGPASSWORD | Usuario y contraseña de PostgreSQL                                   |
| DATABASE_URL        | Alternativa: cadena completa de conexión                             |
| PORT                | Puerto HTTP, por defecto 3000                                        |
| APP_ORIGIN          | Origen permitido para operaciones, por ejemplo http://localhost:3000 |
| NODE_ENV            | development en local; production exige HTTPS para la cookie segura   |

No subas `.env` a Git. La conexión no contiene credenciales dentro del código. Si cambiás el puerto o accedés desde otra dirección, actualizá APP_ORIGIN con la misma dirección que usás en el navegador. Para una publicación real, configurá HTTPS y NODE_ENV=production.

## Usuarios y administrador

Desde **Ingresar**, elegí **Registrate**. Se guardan cuentas reales en PostgreSQL; las contraseñas de 8 a 128 caracteres se procesan con scrypt y una sal aleatoria. Las cuentas nuevas siempre tienen rol cliente. Las sesiones duran siete días y usan una cookie HttpOnly y SameSite=Strict; el servidor guarda únicamente el hash del token. Cerrar sesión revoca ese token en PostgreSQL.

Para habilitar tu cuenta de administrador, registrala primero y ejecutá en tu terminal:

```sh
npm run admin -- tu-correo@ejemplo.com
```

Volvé a iniciar sesión o recargá la página para ver **Administración**. No hay un usuario administrador ni una contraseña predeterminados. Sólo alguien con acceso a la configuración de PostgreSQL y a esta terminal puede promover cuentas mediante el comando.

El panel permite crear productos, editar nombre, categoría, precio, imagen y stock, eliminarlos y consultar todos los pedidos. La API también verifica el rol. La imagen puede ser una ruta como `/images/productos/modelo.png` o una URL HTTPS.

## Compra e historial

Agregá productos al carrito y ajustá las cantidades. Cada fila muestra su subtotal; el resumen suma el total sin cargos adicionales. Los productos agotados tienen el botón deshabilitado. El carrito vive en memoria durante la visita.

**Finalizar compra** requiere sesión. El navegador envía identificadores, cantidades y una clave de compra. El servidor obtiene los precios vigentes de PostgreSQL, valida las cantidades, bloquea las filas de productos y guarda pedido, detalles y descuento de stock dentro de una sola transacción. Si algo falla, revierte todos esos cambios. La clave evita duplicar una misma compra al reintentar después de un problema de red.

Al confirmar se muestra el número de pedido, se vacía el carrito y se actualiza el catálogo. **Mis compras** muestra fecha, productos, cantidades, precio unitario, subtotales, total y estado. El estado inicial es confirmado. Los nombres y precios quedan copiados en los detalles: editar o eliminar un producto conserva el historial. El administrador puede consultar todos los pedidos; cada cliente sólo ve los propios.

El proyecto registra pedidos de demostración y permite integrar Mercado Pago Checkout Pro con cuentas de prueba. No procesa cobros reales, facturación ni envíos. El carrito se abre en un panel lateral y conserva los controles de cantidades y totales.

### Mercado Pago de prueba

1. En Mercado Pago Developers, creá una aplicación de Checkout Pro y dos cuentas de prueba de Argentina: vendedor y comprador.
2. Obtené el Access Token de la cuenta **vendedora de prueba**. No uses la credencial de tu cuenta real ni la publiques en GitHub o en capturas.
3. En Render → CompraYa → Environment, agregá `MP_TEST_MODE=true` y `MP_ACCESS_TOKEN` con ese token. Conservá `APP_ORIGIN=https://compraya-ik2n.onrender.com` y `NODE_ENV=production`.
4. Usá como build `npm ci && npm run migrate && npm run seed`, y como inicio `npm start`. La migración agrega la tabla `pagos_prueba` sin borrar pedidos existentes.
5. Registrate o ingresá en CompraYa, agregá productos y pulsá **Pagar con Mercado Pago (prueba)**. En el checkout de Mercado Pago ingresá con la cuenta **compradora de prueba**, distinta del vendedor, y usá tarjetas de prueba indicadas por Mercado Pago.
6. Al volver, CompraYa consulta el pago en la API. El pedido solo se confirma si el pago pertenece al vendedor de prueba, tiene el identificador esperado, moneda ARS, el importe correcto y estado aprobado. Se rechazan cuentas vendedoras reales y pagos con `live_mode=true`.

Las preferencias usan precios obtenidos de PostgreSQL; no aceptan importes del navegador. Las consultas repetidas de un pago aprobado no duplican el pedido ni descuentan stock dos veces. Sin configuración de Mercado Pago sigue disponible la compra de demostración original; cuando está habilitado, no se puede confirmar por esa ruta sin pagar.

El carrito previo al checkout se guarda en `sessionStorage` para recuperarlo al regresar en la misma pestaña. El resultado aparece arriba del catálogo y permite consultar otra vez si está pendiente o rechazado. Las tarjetas se ingresan en Mercado Pago, nunca en CompraYa.

**Alcance académico:** la verificación se hace al volver a CompraYa o al pulsar consultar estado; no hay webhook ni conciliación automática en segundo plano. No se reserva stock durante el checkout. Si el stock o el precio cambian antes de verificar el pago, se marca **requiere revisión**, sin confirmar el pedido. No hay devolución automática; esta integración está limitada a pruebas, no a ventas reales.

Se verificó con PostgreSQL y respuestas simuladas de Mercado Pago: importes, propiedad del pago, rechazo de cuentas reales, idempotencia y cambios de stock/precio. La prueba completa contra Mercado Pago requiere configurar las cuentas y credenciales.

## Base de datos y catálogo

- `database/esquema.sql`: esquema completo para una base nueva y migración aditiva para la instalación existente. Define productos, usuarios, sesiones, pedidos y detalles_pedido. Agrega la columna imagen si falta.
- `database/seed.sql`: carga SQL del catálogo. Puede ejecutarse desde pgAdmin después del esquema.
- `database/catalogo.json`: datos usados por `npm run seed`.
- `database/fuentes-imagenes.json`: modelo, página de procedencia, URL observada y ruta local de cada fotografía.
- `public/images/productos/`: fotografías servidas localmente. `npm run imagenes` recupera archivos faltantes y necesita Internet.

El catálogo inicial tiene **60 productos, cinco por categoría**: Almacenamiento, Auriculares, Joysticks, Micrófonos, Monitores, Mouse, Mousepads, Notebooks, Parlantes, Placas de video, Teclados y Webcams. Incluye Logitech, Redragon, HyperX, HP, Samsung, Kingston y MSI/NVIDIA. Las fotos corresponden a los modelos y usan `object-fit: contain` para mantener proporciones y tarjetas consistentes. Las fuentes y derechos se detallan en [database/IMAGENES.md](database/IMAGENES.md).

Los precios y stocks del seed son de demostración. El seed agrega productos ausentes sin reemplazar precios, stock ni imágenes existentes; repetirlo no duplica el catálogo. Corrige de forma puntual el nombre original del micrófono que tenía un carácter dañado. Si ya tenés productos adicionales, los conserva y el total puede superar 60.

La migración y el seed no contienen DROP, TRUNCATE ni borrados de datos. El esquema aditivo supone que la tabla productos existente tiene id, nombre, precio, stock y categoria, como la versión original. No modifica tipos ni restricciones de columnas existentes. Ejecutá estas cargas con el servidor detenido para preparar la presentación.

## Estructura y POO

Las carpetas separan responsabilidades. `public` contiene la interfaz; `routes` recibe las solicitudes HTTP; `models` contiene clases y operaciones con datos; `controllers` organiza las operaciones de productos; `middleware` verifica sesión, permisos y origen; `database` contiene la conexión, el esquema y la carga inicial; `tests` prueba el funcionamiento. `artifacts` contiene capturas generadas por las pruebas: no es necesaria para ejecutar la tienda y está excluida de GitHub. `node_modules` contiene dependencias instaladas con npm y también está excluida. `.env` guarda configuración local privada; `.env.example` muestra las variables sin contraseñas reales.

```text
server.js                   Aplicación Express, seguridad y rutas
models/                     Clases de dominio
models/pago.js              Preferencia y verificación de pagos de prueba
controllers/                Operaciones HTTP de productos
middleware/auth.js          Sesión, permisos y control de origen
routes/                     Autenticación, productos y pedidos
database/                   Conexión, esquema, seed y fuentes de imágenes
public/index.html           Interfaz de la tienda
public/js/Carrito.js         Clase del carrito, sin dependencias del HTML
public/js/app.js             Catálogo, filtros y representación del carrito
public/js/login.js           Interfaz de autenticación y cliente HTTP
public/js/cuenta.js          Compra, historial y administración
public/js/pagos.js           Checkout y retorno de Mercado Pago de prueba
public/css/styles.css       Diseño responsive
tests/                      Pruebas de dominio, API, PostgreSQL y navegador
```

**Producto** encapsula datos y reglas de precio/stock; su método `vender` impide cantidades inválidas. **Carrito** administra productos y cantidades, calcula el total con centavos enteros y permite vaciar/sincronizar la selección. **Usuario** expone sólo datos públicos y encapsula el hash y la verificación de contraseñas. **Pedido** centraliza la validación de la compra, su confirmación transaccional y la consulta del historial. No se usa herencia: estas entidades tienen responsabilidades diferentes y colaboran entre sí.

La vista usa el carrito sin conocer PostgreSQL. Las rutas verifican permisos y delegan las reglas del pedido al modelo. Las consultas SQL usan parámetros; los valores de usuarios y productos se dibujan con `textContent` para evitar inyectar HTML. La clase Producto original ya no contiene ejemplos ni console.log de prueba.

## Pruebas

```sh
npm test
npm run test:ui
```

Las pruebas crean una **base temporal independiente** llamada `compraya_test_<identificador>` y la eliminan al terminar. No hacen compras ni cambios de stock en CompraYa. El usuario PostgreSQL necesita permiso CREATEDB para ejecutarlas. Si se interrumpe el proceso, puede quedar esa base temporal; no afecta la base del proyecto.

`npm test` verifica registro/hash, login/logout, permisos, validación, cálculos, compras simultáneas, rollback por stock insuficiente, reintentos, historial y seed repetible. `npm run test:ui` agrega navegación real con Playwright y Microsoft Edge instalado: registro, carrito, compra, historial, administración y ausencia de desborde horizontal en PC y celular. Las capturas se guardan en `artifacts/`. Las herramientas de pruebas son dependencias de desarrollo.

## Guion breve para presentar

1. Buscar por modelo y filtrar una categoría; explicar las fotografías locales y el estado sin stock.
2. Registrar una cuenta, llenar el carrito y mostrar el límite de cantidades y los subtotales.
3. Finalizar, mostrar el mensaje y el historial, y comprobar el stock actualizado.
4. Entrar como administrador, crear/editar un producto y consultar los pedidos.
5. Explicar las cuatro clases, la separación de responsabilidades y por qué una transacción evita una compra parcialmente guardada.
