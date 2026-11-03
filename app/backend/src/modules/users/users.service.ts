import { usersRepository } from "./users.repository";
import type { MeliponarioInput, UpdateProfileInput } from "./users.types";

export const usersService = {
  async getProfile(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new Error("Usuário não encontrado");
    const { password: _pwd, ...userPublico } = user;
    return userPublico;
  },

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await usersRepository.updateById(userId, data);
    const { password: _pwd, ...userPublico } = user;
    return userPublico;
  },

  async upsertMeliponario(userId: string, data: MeliponarioInput) {
    return usersRepository.upsertMeliponario(userId, data);
  },
};
