const router = require("express").Router();
const pool = require("../database/conexion");
const Pedido = require("../models/pedido");
const { requerirUsuario, requerirAdmin } = require("../middleware/auth");
router.get("/", requerirUsuario, async (req, res) =>
  res.json(await Pedido.listar(pool, req.usuario.id)),
);
router.get("/todos", requerirAdmin, async (req, res) =>
  res.json(await Pedido.listar(pool, null)),
);
router.post("/", requerirUsuario, async (req, res) =>
  res.status(201).json({
    mensaje: "¡Compra realizada correctamente!",
    pedido: await Pedido.confirmar(
      pool,
      req.usuario.id,
      req.body.items,
      req.body.clave_compra,
    ),
  }),
);
module.exports = router;
