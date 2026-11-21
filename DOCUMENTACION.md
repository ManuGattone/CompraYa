# CompraYa — Documentación del proyecto

## Qué es CompraYa

CompraYa es una tienda online de productos de tecnología que desarrollamos como proyecto de Programación Orientada a Objetos. La idea es que una persona pueda ver los productos, buscar lo que necesita, agregarlo al carrito y registrar una compra.

También tenemos una parte de administración para manejar los productos y consultar los pedidos. Los precios están expresados en pesos argentinos y los valores del catálogo son de demostración.

## Qué usamos para hacerlo

| Tecnología | Para qué la usamos |
|---|---|
| HTML | Para armar el contenido de la página. |
| CSS | Para los colores, tamaños, distribución y adaptación a distintas pantallas. |
| JavaScript | Para el carrito, los filtros y las acciones de la interfaz. |
| Node.js | Para ejecutar el código del servidor. |
| Express | Para recibir las solicitudes de la página y responder desde el servidor. |
| PostgreSQL | Para guardar usuarios, productos, sesiones y pedidos. |
| Git y GitHub | Para guardar el código y llevar un historial de los cambios. |
| Render | Para el despliegue de la aplicación y su acceso desde internet. |

El repositorio del proyecto es https://github.com/ManuGattone/CompraYa.

La dirección de despliegue documentada es https://compraya-ik2n.onrender.com. La disponibilidad y la configuración del servicio se revisan por separado en Render.

## Cómo funciona la página

Cuando una persona entra, la página le pide al servidor el listado de productos. El servidor consulta PostgreSQL y devuelve los datos para mostrar el catálogo.

Desde ahí se puede buscar por nombre o filtrar por categoría. Cada producto muestra su imagen, precio y disponibilidad. Si no tiene stock, no se puede agregar al carrito.

En el carrito se pueden cambiar las cantidades y ver los subtotales y el total. Para finalizar la compra hay que iniciar sesión.

Antes de confirmar, el servidor vuelve a consultar los precios y el stock. Esto evita depender solamente de los datos que muestra el navegador. Si la compra se confirma, se guarda el pedido y se descuenta el stock. Después, el usuario puede consultar el pedido en “Mis compras”.

## Diseño para celular y computadora

La página tiene un diseño responsive. Esto significa que acomoda sus elementos según el tamaño de la pantalla para poder usarla desde una computadora o un celular.

En el CSS actual partimos de una distribución general y hacemos ajustes para pantallas más chicas, principalmente a los 800 y 560 píxeles. Por eso, técnicamente el enfoque está más cerca de desktop first que de mobile first.

Para explicar el avance podemos decir que trabajamos en una tienda responsive, con ajustes para facilitar su uso desde el celular.

## Para qué sirve cada carpeta

| Carpeta | Qué guardamos ahí |
|---|---|
| `public` | La parte que ve y usa el usuario: HTML, CSS, JavaScript e imágenes. |
| `routes` | Las rutas de la API para productos, usuarios y pedidos. |
| `controllers` | El código que organiza las operaciones para listar, crear, editar y eliminar productos. |
| `models` | Las clases del proyecto y las reglas de productos, usuarios, pedidos y pagos. |
| `middleware` | Las verificaciones de sesión, permisos y origen de las solicitudes. |
| `database` | La conexión con PostgreSQL, los archivos para crear las tablas y la carga inicial del catálogo. |
| `tests` | Las pruebas del funcionamiento del proyecto. |
| `output` | Archivos auxiliares de preparación y vistas de productos e imágenes. |
| `artifacts` | Capturas y resultados generados por las pruebas. No se sube a Git. |
| `node_modules` | Las librerías que se instalan con npm. No se sube a Git. |
| `.git` | El historial local de cambios del proyecto. |

Dentro de `public`, la carpeta `css` contiene los estilos, `js` contiene el comportamiento de la interfaz e `images` contiene las imágenes.

Separamos el código para que cada parte tenga una responsabilidad y sea más fácil encontrar qué tenemos que modificar.

## Archivos principales

| Archivo | Para qué sirve |
|---|---|
| `server.js` | Inicia el servidor y conecta las rutas y verificaciones de la aplicación. |
| `package.json` | Indica las dependencias y los comandos para ejecutar el proyecto. |
| `.env` | Guarda la configuración privada del entorno, como las credenciales de PostgreSQL. |
| `.env.example` | Sirve de ejemplo para saber qué variables tenemos que configurar. |
| `.gitignore` | Indica qué archivos y carpetas no se suben a Git. |
| `README.md` | Explica la instalación, configuración y funcionamiento técnico del proyecto. |

## Cómo usamos la programación orientada a objetos

Usamos clases para separar los datos y las responsabilidades de cada parte.

- **Producto:** representa un producto y valida reglas de precio y stock. Su método `vender` controla que la cantidad solicitada sea válida y que alcance el stock.
- **Carrito:** administra los productos seleccionados y sus cantidades. También calcula el total y permite vaciar o sincronizar el carrito.
- **Usuario:** representa los datos públicos del usuario y contiene los métodos para generar y verificar el hash de la contraseña.
- **Pedido:** valida los productos de una compra, organiza su confirmación y permite consultar el historial.

Las clases colaboran entre sí. Por ejemplo, al confirmar una compra usamos las reglas de los productos y guardamos el pedido. En esta implementación no usamos herencia.

## Qué guardamos en PostgreSQL

Los datos reales se guardan en PostgreSQL. La carpeta `database` contiene los archivos para preparar y conectar la base, pero no reemplaza a la base de datos.

| Tabla | Qué contiene |
|---|---|
| `productos` | Nombre, precio, stock, categoría e imagen de los productos. |
| `usuarios` | Nombre, email, hash de la contraseña y rol. |
| `sesiones` | El hash del token de sesión, el usuario asociado y la fecha de vencimiento. |
| `pedidos` | El usuario que compró, la fecha, el total y el estado del pedido. |
| `detalles_pedido` | Los productos, cantidades, nombres y precios guardados al momento de comprar. |

Guardamos los nombres y precios de la compra en sus detalles para conservar el historial aunque después se modifique o elimine un producto.

## Por qué teníamos un SQL con cinco productos

En la primera carga se agregaban cinco productos de ejemplo con un `INSERT`. Después ampliamos el catálogo: la carga actual incluye 60 productos, cinco por cada una de las 12 categorías.

Los datos del catálogo están en `database/catalogo.json` y se cargan con `npm run seed`. También tenemos una alternativa SQL en `database/seed.sql`.

El texto que queda abierto en el editor de pgAdmin no muestra necesariamente todos los registros que ya tiene la base. Para ver lo guardado en la base seleccionada podemos ejecutar:

```sql
SELECT * FROM productos ORDER BY id;
```

Si aparecen solamente cinco productos, esa base puede tener la carga inicial. También hay que comprobar si estamos consultando la base local o la que usa la aplicación publicada, porque pueden ser distintas.

## Registro, contraseñas e inicio de sesión

Cuando una persona se registra, guardamos sus datos en la tabla `usuarios`. Las cuentas nuevas tienen el rol de cliente.

La contraseña no se guarda como texto plano. Guardamos un hash generado con scrypt y una sal aleatoria en la columna `password_hash`. Al iniciar sesión, el servidor verifica la contraseña ingresada contra ese hash.

Cuando los datos son correctos, creamos una sesión que dura siete días. En PostgreSQL guardamos el hash del token de esa sesión y en el navegador guardamos el token dentro de una cookie llamada `compraya_sesion`.

La cookie es `HttpOnly`, así que el JavaScript de la página no puede leerla. El navegador la envía al servidor y el servidor consulta la sesión para reconocer al usuario. Al cerrar sesión, se elimina el registro correspondiente.

## Cliente y administrador

Un cliente puede ver productos, usar el carrito, registrar compras y consultar sus propios pedidos.

Un administrador también puede crear, editar y eliminar productos, cambiar precios y stock, y consultar todos los pedidos.

Los permisos se comprueban en el servidor. No alcanza con mostrar u ocultar un botón en la página. El registro común no permite elegir el rol de administrador: ese permiso se asigna mediante el comando de administración del proyecto.

## Cómo se guarda una compra

El navegador envía los identificadores de los productos y sus cantidades. El servidor obtiene los precios de PostgreSQL y verifica que haya stock suficiente.

El pedido, sus detalles y el descuento de stock se guardan dentro de una transacción. Esto significa que se confirma todo junto o se vuelve atrás si ocurre un error. Así evitamos que quede un pedido guardado a medias.

También usamos una clave de compra para evitar que un reintento de la misma operación genere dos pedidos.

## Checkout de demostración

El carrito abre un simulador con selección de crédito o débito y una tarjeta ficticia precargada. No realiza cobros ni envía o guarda datos de tarjeta. Al confirmar se crea un pedido de demostración con precios y stock validados por el servidor, y aparece una confirmación con tilde verde. Cancelar conserva el carrito. No necesita cuentas ni credenciales de una pasarela externa.

## GitHub y Render

GitHub nos sirve para guardar y compartir el código y llevar un historial de los cambios. Render nos sirve para ejecutar la aplicación y permitir el acceso desde internet.

Las variables privadas del servicio publicado se configuran en Render. Tener una variable en el archivo `.env` de nuestra computadora no significa que también esté configurada en Render.

Lo mismo pasa con PostgreSQL: la aplicación publicada debe conectarse a la base que tenga configurada en su entorno. Los cambios en una base local no se copian automáticamente a otra base.

## Cómo se ejecuta en una computadora

Necesitamos Node.js 24 o superior y PostgreSQL. Primero instalamos las dependencias:

```sh
npm install
```

Después copiamos `.env.example` a `.env`, completamos los datos de conexión y creamos la base si todavía no existe. Con la configuración lista ejecutamos:

```sh
npm run migrate
npm run seed
npm start
```

La migración prepara las tablas, el seed agrega los productos que falten y `npm start` inicia el servidor. Por defecto, entramos desde `http://localhost:3000`.

En Windows, si PowerShell bloquea `npm.ps1`, podemos usar `npm.cmd` en los mismos comandos.

## Pruebas y próximos pasos

El proyecto incluye pruebas de registro, sesiones, permisos, carrito, compras, stock e historial. También hay pruebas de navegador para revisar los recorridos de la interfaz y su adaptación a computadora y celular.

Se ejecutan con `npm test` y `npm run test:ui`. Usan una base temporal independiente; el usuario de PostgreSQL necesita permiso para crearla. Las pruebas de navegador requieren Microsoft Edge. Esta documentación no implica que se hayan vuelto a ejecutar ahora.

Para la entrega tenemos que comprobar el checkout de demostración en Render y su funcionamiento desde el celular.

## Cómo lo podemos contar en la presentación

“CompraYa es una tienda online de tecnología. Usamos HTML, CSS y JavaScript para la interfaz, Node.js con Express para el servidor y PostgreSQL para guardar los datos.

Ya tenemos catálogo, filtros, registro, inicio de sesión, carrito, pedidos y una parte de administración. La página es responsive, así que se adapta a computadoras y celulares.

Las contraseñas se guardan como hash y usamos sesiones para reconocer a cada usuario. Cuando se confirma una compra, el servidor valida el stock y guarda el pedido completo en una transacción.

Tenemos el código en GitHub y usamos Render para el despliegue. También incorporamos un checkout de demostración con tarjeta ficticia y confirmación de compra.”
