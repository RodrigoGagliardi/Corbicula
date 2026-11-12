import { useAuth } from "../../store/auth";
import { comprimirImagem } from "../../utils/imagem";
import { ErroApi } from "../api/client";
import { fotosApi } from "../api/endpoints";
import { fotosDoRegistro, guardarFoto, lerFila } from "./banco";
import { bancoDoUsuario, novoId } from "./escrita";
import { ehErroDeConexao, semRede } from "./leituraLocal";
import { pedirSincronizacaoEmSegundoPlano } from "./segundoPlano";
import { atualizarContagem, sincronizar } from "./sincronizacao";
import type { FotoPendente, VinculoFoto } from "./tipos";

// Foto anexada a uma colônia, avaliação ou colheita, online ou offline.
//  - Comprimida no aparelho antes de tudo (utils/imagem.ts).
//  - Sobe na hora pelo POST /fotos quando há rede e o registro já existe no
//    servidor (nenhum create dele na fila).
//  - Senão (offline, falha de rede/timeout, servidor indisponível — 5xx, 408,
//    429 — ou registro ainda na fila), fica
//    guardada no banco local do usuário e sobe na sincronização, depois do
//    envio da fila (services/offline/sincronizacao.ts, `enviarFotos`).
// A foto nunca bloqueia nem desfaz o registro: quem chama já salvou o registro.

export interface ResultadoFoto {
  // true = guardada no aparelho, sobe quando a conexão voltar.
  pendente: boolean;
}

export const idDoVinculo = (vinculo: VinculoFoto): string =>
  "coloniaId" in vinculo ? vinculo.coloniaId : "avaliacaoId" in vinculo ? vinculo.avaliacaoId : vinculo.producaoId;

// Bytes de um Blob; o FileReader cobre ambientes sem `Blob.arrayBuffer`.
export function lerBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as ArrayBuffer);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsArrayBuffer(blob);
  });
}

export async function anexarFoto(arquivo: File, vinculo: VinculoFoto): Promise<ResultadoFoto> {
  const comprimida = await comprimirImagem(arquivo);
  const entidadeId = idDoVinculo(vinculo);
  const usuarioId = useAuth.getState().usuario?.id;
  const db = await bancoDoUsuario(usuarioId);

  const fila = db ? await lerFila(db).catch(() => []) : [];
  const registroNaFila = fila.some((op) => op.entidadeId === entidadeId && op.operacao === "create");
  if (!semRede() && !registroNaFila) {
    try {
      await fotosApi.enviar(comprimida, vinculo);
      return { pendente: false };
    } catch (erro) {
      const transitorio =
        ehErroDeConexao(erro) || (erro instanceof ErroApi && (erro.status >= 500 || [408, 429].includes(erro.status)));
      if (!transitorio) throw erro;
    }
  }

  if (!db || !usuarioId) throw new ErroApi(0, "Sem conexão com o servidor.");
  await guardarFoto(db, {
    id: novoId(),
    vinculo,
    entidadeId,
    bytes: await lerBytes(comprimida),
    tipo: comprimida.type || "image/jpeg",
    criadoEm: new Date().toISOString(),
    estado: "pendente",
    tentativas: 0,
  });
  void atualizarContagem(usuarioId);
  // Sem rede: o Background Sync (onde houver) envia mesmo com o app fechado.
  if (!semRede()) void sincronizar(usuarioId);
  else void pedirSincronizacaoEmSegundoPlano();
  return { pendente: true };
}

// Fotos guardadas de um registro (galeria), da mais antiga para a mais nova.
export async function fotosGuardadas(vinculo: VinculoFoto): Promise<FotoPendente[]> {
  const db = await bancoDoUsuario(useAuth.getState().usuario?.id);
  if (!db) return [];
  const fotos = await fotosDoRegistro(db, idDoVinculo(vinculo));
  return fotos.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}
