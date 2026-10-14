const {
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require("node:crypto");
const scrypt = require("node:util").promisify(scryptCallback);
class Usuario {
  constructor({ id, nombre, email, rol }) {
    Object.assign(this, { id, nombre, email, rol });
  }
  static async hash(clave) {
    const sal = randomBytes(16).toString("hex");
    const hash = await scrypt(clave, sal, 64);
    return "scrypt:" + sal + ":" + hash.toString("hex");
  }
  static async verificar(clave, almacenado) {
    const [tipo, sal, hash] = almacenado.split(":");
    if (tipo !== "scrypt" || !sal || !hash) return false;
    const esperado = Buffer.from(hash, "hex");
    const actual = await scrypt(clave, sal, 64);
    return (
      esperado.length === actual.length && timingSafeEqual(esperado, actual)
    );
  }
}
module.exports = Usuario;
