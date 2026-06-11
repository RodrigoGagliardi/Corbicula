import { Router } from "express";

const router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Retorna todos os usuários
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
router.get("/", (req, res) => {
  res.json([{ id: 1, nome: "Ronaldo" }]);
});

export default router;