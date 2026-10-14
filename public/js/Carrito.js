/**
 * Guarda el carrito en memoria. No conoce el HTML ni la base de datos.
 * Cada elemento contiene un producto y la cantidad elegida.
 */
class Carrito {
  constructor() {
    this.items = [];
  }

  agregarProducto(producto) {
    const existente = this.items.find(
      (item) => item.producto.id === producto.id,
    );
    if (existente) {
      return this.aumentarCantidad(producto.id);
    }

    const stock = Number(producto.stock);
    const precio = Number(producto.precio);
    if (
      !Number.isInteger(stock) ||
      stock <= 0 ||
      !Number.isFinite(precio) ||
      precio < 0
    ) {
      return false;
    }

    // Copiamos el producto para no modificar el catálogo.
    this.items.push({ producto: { ...producto, stock, precio }, cantidad: 1 });
    return true;
  }

  eliminarProducto(id) {
    this.items = this.items.filter((item) => item.producto.id !== id);
  }

  aumentarCantidad(id) {
    const item = this.items.find((item) => item.producto.id === id);
    if (!item || item.cantidad >= item.producto.stock) {
      return false;
    }
    item.cantidad++;
    return true;
  }

  disminuirCantidad(id) {
    const item = this.items.find((item) => item.producto.id === id);
    if (!item) {
      return false;
    }
    item.cantidad--;
    if (item.cantidad === 0) {
      this.eliminarProducto(id);
    }
    return true;
  }

  vaciar() {
    this.items = [];
  }

  sincronizar(productos) {
    this.items = this.items.filter((item) => {
      const actual = productos.find((p) => p.id === item.producto.id);
      if (!actual || Number(actual.stock) <= 0) return false;
      item.producto = {
        ...actual,
        precio: Number(actual.precio),
        stock: Number(actual.stock),
      };
      item.cantidad = Math.min(item.cantidad, item.producto.stock);
      return true;
    });
  }

  calcularTotal() {
    // Sumamos centavos enteros para evitar errores de decimales.
    const centavos = this.items.reduce(
      (total, item) =>
        total + Math.round(item.producto.precio * 100) * item.cantidad,
      0,
    );
    return centavos / 100;
  }

  obtenerCantidadTotal() {
    return this.items.reduce((total, item) => total + item.cantidad, 0);
  }
}
