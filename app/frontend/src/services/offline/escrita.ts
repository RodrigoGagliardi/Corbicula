import { useAuth } from "../../store/auth";
import type { AvaliacaoInput, ColoniaInput, ProducaoInput } from "../../types/api";
import { ErroApi } from "../api/client";
import { avaliacoesApi, coloniasApi, producoesApi } from "../api/endpoints";
import { abrirBanco, enfileirar, indexedDbDisponivel, lerFila, lerMeta, type BancoOffline, type MudancaLocal } from "./banco";
import { montarOperacao, relacionadasDe, temPendenciaRelacionada } from "./fila";
import { ehErroDeConexao, semRede } from "./leituraLocal";
import { atualizarAvaliacao, atualizarColonia, atualizarProducao, novaAvaliacao, novaColonia, novaProducao } from "./linhaLocal";
import { atualizarContagem, sincronizar } from "./sincronizacao";
import type { AcaoOperacao, LinhaLocal, TipoOperacao } from "./tipos";
import {
  validarEdicaoAvaliacao,
  validarEdicaoColonia,
  validarExclusaoColonia,
  validarNovaAvaliacao,
  validarNovaColonia,
} from "./validacoes";

// Escritas de colônia, avaliação e colheita, online ou offline.
//  - Online, sem pendência na fila para a entidade nem para as colônias que ela
//    referencia, vai pela API REST como sempre (o create leva o id gerado aqui)
//    e dispara uma sincronização, que traz a versão do servidor para a cópia local.
//    Erros HTTP (400, 409...) chegam ao formulário como antes.
//  - Offline, com falha de rede/timeout (`ErroApi(0)`) ou com pendência
//    relacionada, vira operação na fila e a mudança aparece na hora na cópia
//    local. Um create que o servidor já tinha aplicado antes do timeout volta do
//    /sync como `aplicado` (mesmo id): nada duplica.
//  - No caminho da fila, as regras do servidor são checadas antes na cópia local
//    (validacoes.ts): a escrita que ele recusaria não entra na fila e o
//    formulário mostra a mesma mensagem que ele daria.

export interface ResultadoEscrita {
  id: string;
  // true = ficou na fila (ainda não chegou ao servidor).
  offline: boolean;
}

const SEM_CONEXAO = "Sem conexão com o servidor.";
export const MENSAGEM_FORA_DA_COPIA_ESCRITA =
  "Este registro ainda não está na cópia offline. Salve de novo quando a conexão voltar.";

// UUID v4. `crypto.randomUUID` só existe em contexto seguro (HTTPS ou localhost);
// aberto por http num IP da rede local, o fallback usa `getRandomValues`.
export function novoId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

interface ContextoLocal {
  db: BancoOffline;
  usuarioId: string;
  agora: string;
}

interface Pedido {
  tipo: TipoOperacao;
  operacao: AcaoOperacao;
  entidadeId: string;
  coloniaId?: string;
  dados: object;
  // `updatedAt` da versão que o usuário editou (update).
  updatedAtEditado?: string;
  remoto: () => Promise<unknown>;
  // Mudança na cópia local, montada com o estado do banco (e a linha anterior, no update).
  local: (ctx: ContextoLocal) => Promise<{ mudancas: MudancaLocal[]; base?: LinhaLocal }>;
}

async function bancoDoUsuario(usuarioId: string | undefined): Promise<BancoOffline | null> {
  if (!usuarioId || !indexedDbDisponivel()) return null;
  try {
    return await abrirBanco(usuarioId);
  } catch {
    return null;
  }
}

async function escrever(p: Pedido): Promise<ResultadoEscrita> {
  const usuarioId = useAuth.getState().usuario?.id;
  const db = await bancoDoUsuario(usuarioId);
  const dados = p.dados as Record<string, unknown>;
  const ligadas = [p.entidadeId, ...relacionadasDe(p.tipo, dados, p.coloniaId)];

  const fila = db ? await lerFila(db).catch(() => []) : [];
  if (!semRede() && !temPendenciaRelacionada(fila, ligadas)) {
    try {
      await p.remoto();
      if (usuarioId) {
        const ciclo = sincronizar(usuarioId);
        // Com operações na fila, as telas leem a cópia local: espera o pull trazer
        // o registro recém-salvo antes de a tela abri-lo.
        if (fila.length > 0) await ciclo;
      }
      return { id: p.entidadeId, offline: false };
    } catch (erro) {
      if (!ehErroDeConexao(erro)) throw erro;
    }
  }

  // Sem cópia local carregada não há onde guardar a mudança.
  if (!db || !usuarioId || !(await lerMeta(db)).desde) throw new ErroApi(0, SEM_CONEXAO);

  const agora = new Date().toISOString();
  const { mudancas, base } = await p.local({ db, usuarioId, agora });
  // A fila é relida: a sincronização pode ter mudado enquanto a REST tentava.
  const operacao = montarOperacao(await lerFila(db), {
    id: novoId(),
    tipo: p.tipo,
    operacao: p.operacao,
    entidadeId: p.entidadeId,
    coloniaId: p.coloniaId,
    dados,
    criadoEm: agora,
    updatedAtEditado: p.updatedAtEditado,
    base,
  });
  await enfileirar(db, operacao, mudancas);
  void atualizarContagem(usuarioId);
  if (!semRede()) void sincronizar(usuarioId);
  return { id: p.entidadeId, offline: true };
}

async function linhaExistente<T>(linha: Promise<T | undefined>): Promise<T> {
  const encontrada = await linha;
  if (!encontrada) throw new ErroApi(0, MENSAGEM_FORA_DA_COPIA_ESCRITA);
  return encontrada;
}

type Versao = { id: string; updatedAt: string };

export const escritas = {
  criarColonia(dados: ColoniaInput): Promise<ResultadoEscrita> {
    const id = novoId();
    return escrever({
      tipo: "colonia",
      operacao: "create",
      entidadeId: id,
      dados,
      remoto: () => coloniasApi.criar({ ...dados, id }),
      local: async ({ db, usuarioId, agora }) => {
        const [especies, colonias] = await Promise.all([db.getAll("especies"), db.getAll("colonias")]);
        // Espécie final já com a herança da mãe (a regra do servidor, num lugar só).
        const especieId = validarNovaColonia(id, dados, colonias);
        const linha = novaColonia(id, { ...dados, especieId }, { userId: usuarioId, especies, colonias, agora });
        return { mudancas: [{ store: "colonias", gravar: linha }] };
      },
    });
  },

  atualizarColonia(colonia: Versao, dados: Partial<ColoniaInput>): Promise<ResultadoEscrita> {
    return escrever({
      tipo: "colonia",
      operacao: "update",
      entidadeId: colonia.id,
      dados,
      updatedAtEditado: colonia.updatedAt,
      remoto: () => coloniasApi.atualizar(colonia.id, dados),
      local: async ({ db, usuarioId, agora }) => {
        const [linha, especies, colonias] = await Promise.all([
          linhaExistente(db.get("colonias", colonia.id)),
          db.getAll("especies"),
          db.getAll("colonias"),
        ]);
        validarEdicaoColonia(linha, dados, colonias);
        const gravar = atualizarColonia(linha, dados, { userId: usuarioId, especies, colonias, agora });
        return { mudancas: [{ store: "colonias", gravar }], base: linha };
      },
    });
  },

  excluirColonia(id: string): Promise<ResultadoEscrita> {
    return escrever({
      tipo: "colonia",
      operacao: "delete",
      entidadeId: id,
      dados: {},
      remoto: () => coloniasApi.excluir(id),
      local: async ({ db }) => {
        const [avaliacoes, producoes] = await Promise.all([
          db.countFromIndex("avaliacoes", "coloniaId", id),
          db.getAllKeysFromIndex("producoes", "coloniaId", id),
        ]);
        // O servidor recusaria (preservação do histórico): nada entra na fila.
        validarExclusaoColonia(avaliacoes);
        // O cascade do servidor apaga as colheitas da colônia.
        return { mudancas: [{ store: "colonias", remover: [id] }, { store: "producoes", remover: producoes }] };
      },
    });
  },

  criarAvaliacao(coloniaId: string, dados: AvaliacaoInput): Promise<ResultadoEscrita> {
    const id = novoId();
    return escrever({
      tipo: "avaliacao",
      operacao: "create",
      entidadeId: id,
      coloniaId,
      dados,
      remoto: () => avaliacoesApi.criar(coloniaId, { ...dados, id }),
      local: async ({ db, agora }) => {
        const [colonias, parametros] = await Promise.all([db.getAll("colonias"), db.getAll("parametros")]);
        validarNovaAvaliacao(coloniaId, dados, colonias, parametros);
        return { mudancas: [{ store: "avaliacoes", gravar: novaAvaliacao(id, coloniaId, dados, agora, novoId) }] };
      },
    });
  },

  atualizarAvaliacao(coloniaId: string, avaliacao: Versao, dados: Partial<AvaliacaoInput>): Promise<ResultadoEscrita> {
    return escrever({
      tipo: "avaliacao",
      operacao: "update",
      entidadeId: avaliacao.id,
      coloniaId,
      dados,
      updatedAtEditado: avaliacao.updatedAt,
      remoto: () => avaliacoesApi.atualizar(coloniaId, avaliacao.id, dados),
      local: async ({ db, agora }) => {
        const [linha, parametros] = await Promise.all([linhaExistente(db.get("avaliacoes", avaliacao.id)), db.getAll("parametros")]);
        validarEdicaoAvaliacao(linha, dados, parametros, new Date(agora));
        return { mudancas: [{ store: "avaliacoes", gravar: atualizarAvaliacao(linha, dados, agora, novoId) }], base: linha };
      },
    });
  },

  excluirAvaliacao(coloniaId: string, id: string): Promise<ResultadoEscrita> {
    return escrever({
      tipo: "avaliacao",
      operacao: "delete",
      entidadeId: id,
      coloniaId,
      dados: {},
      remoto: () => avaliacoesApi.excluir(coloniaId, id),
      local: async () => ({ mudancas: [{ store: "avaliacoes", remover: [id] }] }),
    });
  },

  criarProducao(dados: ProducaoInput): Promise<ResultadoEscrita> {
    const id = novoId();
    return escrever({
      tipo: "producao",
      operacao: "create",
      entidadeId: id,
      coloniaId: dados.coloniaId,
      dados,
      remoto: () => producoesApi.criar({ ...dados, id }),
      local: async ({ agora }) => ({ mudancas: [{ store: "producoes", gravar: novaProducao(id, dados, agora) }] }),
    });
  },

  atualizarProducao(
    producao: Versao & { coloniaId: string },
    dados: Partial<Omit<ProducaoInput, "coloniaId">>
  ): Promise<ResultadoEscrita> {
    return escrever({
      tipo: "producao",
      operacao: "update",
      entidadeId: producao.id,
      coloniaId: producao.coloniaId,
      dados,
      updatedAtEditado: producao.updatedAt,
      remoto: () => producoesApi.atualizar(producao.id, dados),
      local: async ({ db }) => {
        const linha = await linhaExistente(db.get("producoes", producao.id));
        return { mudancas: [{ store: "producoes", gravar: atualizarProducao(linha, dados) }], base: linha };
      },
    });
  },

  excluirProducao(producao: { id: string; coloniaId: string }): Promise<ResultadoEscrita> {
    return escrever({
      tipo: "producao",
      operacao: "delete",
      entidadeId: producao.id,
      coloniaId: producao.coloniaId,
      dados: {},
      remoto: () => producoesApi.excluir(producao.id),
      local: async () => ({ mudancas: [{ store: "producoes", remover: [producao.id] }] }),
    });
  },
};
