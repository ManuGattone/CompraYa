const router = require("express").Router();
const c = require("../controllers/productoController");
const { requerirAdmin } = require("../middleware/auth");
router.get("/", c.obtenerProductos);
router.post("/", requerirAdmin, c.crearProducto);
router.put("/:id", requerirAdmin, c.actualizarProducto);
router.delete("/:id", requerirAdmin, c.eliminarProducto);
module.exports = router;
