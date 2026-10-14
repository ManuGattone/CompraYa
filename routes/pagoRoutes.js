const router = require("express").Router();
const pool = require("../database/conexion");
const Pago = require("../models/pago");
const { requerirUsuario } = require("../middleware/auth");
router.get("/config", (req, res) =>
  res.json({ habilitado: Pago.habilitado(), modo: "prueba" }),
);
router.post("/preferencia", requerirUsuario, async (req, res) =>
  res
    .status(201)
    .json(
      await Pago.crear(
        pool,
        req.usuario.id,
        req.body.items,
        req.body.clave_compra,
      ),
    ),
);
router.post("/:id/verificar", requerirUsuario, async (req, res) =>
  res.json(await Pago.verificar(pool, req.usuario.id, req.params.id)),
);
module.exports = router;
