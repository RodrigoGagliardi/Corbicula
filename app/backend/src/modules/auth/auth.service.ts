import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database";
import { env } from "../../shared/env";
import type { LoginBody, RegisterBody } from "./auth.types";

function gerarToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, env.JWT_SECRET, { expiresIn: "7d" });
}

export const authService = {
  async register(data: RegisterBody) {
    const jaExiste = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (jaExiste) {
      const err = new Error("E-mail já cadastrado");
      (err as NodeJS.ErrnoException).code = "CONFLICT";
      throw err;
    }

    const senhaHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: senhaHash,
      },
      include: { meliponario: true },
    });

    const token = gerarToken(user.id, user.email);
    const { password: _pwd, ...userPublico } = user;
    return { token, user: userPublico };
  },

  async login(data: LoginBody) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { meliponario: true },
    });

    const erroCredenciais = new Error("Credenciais inválidas");
    (erroCredenciais as NodeJS.ErrnoException).code = "UNAUTHORIZED";

    if (!user) throw erroCredenciais;

    const senhaCorreta = await bcrypt.compare(data.password, user.password);
    if (!senhaCorreta) throw erroCredenciais;

    const token = gerarToken(user.id, user.email);
    const { password: _pwd, ...userPublico } = user;
    return { token, user: userPublico };
  },
};
