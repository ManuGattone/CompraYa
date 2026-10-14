class Producto {
  constructor({ id, nombre, precio, stock, categoria, imagen } = {}) {
    Object.assign(this, {
      id,
      nombre: typeof nombre === "string" ? nombre.trim() : "",
      precio: Number(precio),
      stock: Number(stock),
      categoria: typeof categoria === "string" ? categoria.trim() : "",
      imagen: imagen || null,
    });
    if (
      !this.nombre ||
      this.nombre.length > 200 ||
      !this.categoria ||
      this.categoria.length > 100 ||
      precio == null ||
      !["number", "string"].includes(typeof precio) ||
      precio === "" ||
      !Number.isFinite(this.precio) ||
      this.precio <= 0 ||
      this.precio > 999999999 ||
      stock == null ||
      !["number", "string"].includes(typeof stock) ||
      stock === "" ||
      !Number.isInteger(this.stock) ||
      this.stock < 0 ||
      this.stock > 2147483647 ||
      (this.imagen &&
        (typeof this.imagen !== "string" ||
          this.imagen.length > 2000 ||
          !/^(\/images\/productos\/[\w.-]+|https:\/\/[^\s]+)$/.test(
            this.imagen,
          )))
    ) {
      const e = new Error(
        "Revisá nombre, categoría, precio positivo, stock entero e imagen válida.",
      );
      e.status = 400;
      throw e;
    }
  }
  vender(cantidad) {
    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > this.stock) {
      const e = new Error(
        "Stock insuficiente para " +
          this.nombre +
          ". Disponible: " +
          this.stock,
      );
      e.status = 409;
      throw e;
    }
    this.stock -= cantidad;
  }
  get precioCentavos() {
    return Math.round(this.precio * 100);
  }
}
module.exports = Producto;
