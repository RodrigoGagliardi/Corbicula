import { useAuth } from "../../store/auth";
import { comprimirImagem } from "../../utils/imagem";
import { ErroApi } from "../api/client";
import { fotosApi } from "../api/endpoints";
import { fotosDoRegistro, guardarFoto, lerFila, lerFotos, removerFoto, type BancoOffline } from "./banco";
import { bancoDoUsuario, novoId } from "./escrita";
import { entidadesBloqueadas, situacaoDaFoto, type SituacaoFoto } from "./fila";
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

export type FotoComSituacao = FotoPendente & { situacao: SituacaoFoto };

// Fotos guardadas de um registro (galeria), da mais antiga para a mais nova.
export async function fotosGuardadas(vinculo: VinculoFoto): Promise<FotoComSituacao[]> {
  const db = await bancoDoUsuario(useAuth.getState().usuario?.id);
  if (!db) return [];
  const [fotos, fila] = await Promise.all([fotosDoRegistro(db, idDoVinculo(vinculo)), lerFila(db)]);
  const bloqueadas = entidadesBloqueadas(fila);
  return fotos.map((f) => ({ ...f, situacao: situacaoDaFoto(f, fila, bloqueadas) })).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}

// ─── Fotos paradas: ver, tentar de novo, baixar ou descartar ─────────────────
// Foto recusada pelo servidor ou presa atrás de uma decisão não sai sozinha
// (CAP-9): só pelo envio aceito ou pela escolha do usuário na tela de Sincronização.

export interface FotoNoAparelho extends FotoComSituacao {
  // Registro da foto ("Colônia TETRANGU-001", "Avaliação de 12/11/2026 · ...") e o detalhe dele.
  rotulo: string;
  rotaDetalhe: string | null;
}

const dataCurta = (iso: string | undefined) => (iso ? ` de ${new Date(iso).toLocaleDateString("pt-BR")}` : "");

async function descreverRegistro(db: BancoOffline, vinculo: VinculoFoto): Promise<{ rotulo: string; rotaDetalhe: string | null }> {
  if ("coloniaId" in vinculo) {
    const c = await db.get("colonias", vinculo.coloniaId);
    return { rotulo: c ? `Colônia ${c.codigo}` : "Colônia", rotaDetalhe: c ? `/app/colonias/${c.id}` : null };
  }
  if ("avaliacaoId" in vinculo) {
    const a = await db.get("avaliacoes", vinculo.avaliacaoId);
    const c = a ? await db.get("colonias", a.coloniaId) : undefined;
    return {
      rotulo: `Avaliação${dataCurta(a?.dataAvaliacao)}${c ? ` · ${c.codigo}` : ""}`,
      rotaDetalhe: a ? `/app/colonias/${a.coloniaId}/avaliacoes/${a.id}` : null,
    };
  }
  const p = await db.get("producoes", vinculo.producaoId);
  return { rotulo: `Colheita${dataCurta(p?.dataColheita)}`, rotaDetalhe: null };
}

// Todas as fotos guardadas no aparelho, as que esperam o usuário primeiro.
export async function listarFotosNoAparelho(): Promise<FotoNoAparelho[]> {
  const db = await bancoDoUsuario(useAuth.getState().usuario?.id);
  if (!db) return [];
  const [fotos, fila] = await Promise.all([lerFotos(db), lerFila(db)]);
  const bloqueadas = entidadesBloqueadas(fila);
  const ordem: Record<SituacaoFoto, number> = { recusada: 0, presa: 1, aguardando: 2 };
  const lista = await Promise.all(
    fotos.map(async (f) => ({ ...f, situacao: situacaoDaFoto(f, fila, bloqueadas), ...(await descreverRegistro(db, f.vinculo)) }))
  );
  return lista.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.criadoEm.localeCompare(b.criadoEm));
}

async function fotoDoUsuario(id: string): Promise<{ db: BancoOffline; usuarioId: string; foto: FotoPendente }> {
  const usuarioId = useAuth.getState().usuario?.id;
  const db = await bancoDoUsuario(usuarioId);
  const foto = db ? await db.get("fotos", id) : undefined;
  if (!db || !usuarioId || !foto) throw new ErroApi(404, "Esta foto já foi resolvida.");
  return { db, usuarioId, foto };
}

// Foto recusada volta a "pendente" e entra no envio. Com rede, sincroniza na
// hora (a promessa termina com o resultado: enviada ou recusada de novo, com o
// motivo novo); sem rede, sobe na próxima sincronização.
export async function tentarFotoDeNovo(id: string): Promise<void> {
  const { db, usuarioId, foto } = await fotoDoUsuario(id);
  await guardarFoto(db, { ...foto, estado: "pendente", ultimoErro: undefined });
  await atualizarContagem(usuarioId);
  if (!semRede()) await sincronizar(usuarioId);
  else void pedirSincronizacaoEmSegundoPlano();
}

// Apaga a foto do aparelho (quem chama confirma antes: ela não chegou ao servidor).
export async function descartarFoto(id: string): Promise<void> {
  const { db, usuarioId } = await fotoDoUsuario(id);
  await removerFoto(db, id);
  await atualizarContagem(usuarioId);
}

const EXTENSOES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Nome do arquivo baixado: registro + data em que a foto foi guardada.
export function nomeDoArquivo(foto: Pick<FotoPendente, "tipo" | "criadoEm">, rotulo: string): string {
  const base = rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // Data local (no fuso do aparelho), não a UTC: uma foto da noite não leva a data do dia seguinte.
  const d = new Date(foto.criadoEm);
  const data = Number.isNaN(d.getTime())
    ? ""
    : `-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `corbicula-${base || "foto"}${data}.${EXTENSOES[foto.tipo] ?? "jpg"}`;
}

// Salva a foto no aparelho, sem mexer nela.
export function baixarFoto(foto: Pick<FotoPendente, "bytes" | "tipo" | "criadoEm">, rotulo: string): void {
  const url = URL.createObjectURL(new Blob([foto.bytes], { type: foto.tipo }));
  const link = Object.assign(document.createElement("a"), { href: url, download: nomeDoArquivo(foto, rotulo) });
  // No documento e com a URL revogada depois: Firefox e Safari cancelam o download de um link solto ou revogado na hora.
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
