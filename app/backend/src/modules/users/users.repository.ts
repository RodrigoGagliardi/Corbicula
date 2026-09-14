import { prisma } from "../../config/database";
import type { MeliponarioInput } from "./users.types";

export const usersRepository = {
  findById: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      include: { meliponario: true },
    }),

  updateById: (id: string, data: { name?: string | undefined; email?: string | undefined }) =>
    prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
      },
      include: { meliponario: true },
    }),

  // Relação 1:1 — upsert garante que jamais existam dois meliponários para o mesmo usuário.
  // undefined → null porque Prisma usa null para campos anuláveis.
  upsertMeliponario: (userId: string, data: MeliponarioInput) =>
    prisma.meliponario.upsert({
      where: { userId },
      create: {
        userId,
        nome: data.nome,
        endereco: data.endereco ?? null,
        cidade: data.cidade ?? null,
        estado: data.estado ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        bioma: data.bioma ?? null,
        areaTotal: data.areaTotal ?? null,
      },
      update: {
        nome: data.nome,
        endereco: data.endereco ?? null,
        cidade: data.cidade ?? null,
        estado: data.estado ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        bioma: data.bioma ?? null,
        areaTotal: data.areaTotal ?? null,
      },
    }),
};
