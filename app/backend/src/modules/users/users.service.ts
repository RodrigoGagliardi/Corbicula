import bcrypt from "bcrypt";
import { erroConflito, erroNaoEncontrado, erroRequisicao } from "../../shared/errors";
import { apagarArquivos, listarArquivosDe } from "../fotos/fotos.service";
import { usersRepository } from "./users.repository";
import type { AlterarSenhaInput, ExcluirContaInput, MeliponarioInput, UpdateProfileInput } from "./users.types";

// Confere a senha do usuário. Senha errada é 400, não 401: o token continua
// válido, e um 401 encerraria a sessão no cliente.
async function conferirSenha(userId: string, senha: string) {
  const user = await usersRepository.findById(userId);
  if (!user) throw erroNaoEncontrado("Usuário não encontrado");
  if (!(await bcrypt.compare(senha, user.password))) throw erroRequisicao("Senha incorreta");
  return user;
}

export const usersService = {
  async getProfile(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw erroNaoEncontrado("Usuário não encontrado");
    const { password: _pwd, ...userPublico } = user;
    return userPublico;
  },

  async updateProfile(userId: string, data: UpdateProfileInput) {
    if (data.email !== undefined) {
      const dono = await usersRepository.findByEmail(data.email);
      if (dono && dono.id !== userId) throw erroConflito("E-mail já cadastrado");
    }
    const user = await usersRepository.updateById(userId, data);
    const { password: _pwd, ...userPublico } = user;
    return userPublico;
  },

  async upsertMeliponario(userId: string, data: MeliponarioInput) {
    return usersRepository.upsertMeliponario(userId, data);
  },

  async alterarSenha(userId: string, data: AlterarSenhaInput) {
    await conferirSenha(userId, data.senhaAtual);
    await usersRepository.updateSenha(userId, await bcrypt.hash(data.novaSenha, 10));
  },

  // Direito de exclusão (LGPD): apaga a conta e todos os dados, inclusive os
  // arquivos de fotos em disco. Não há como desfazer — o cliente deve oferecer
  // o backup antes.
  async excluirConta(userId: string, data: ExcluirContaInput) {
    await conferirSenha(userId, data.senha);
    const arquivos = await listarArquivosDe({ colonia: { userId } });
    await usersRepository.excluir(userId);
    await apagarArquivos(arquivos);
  },
};
