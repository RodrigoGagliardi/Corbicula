import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../shared/env";
import { erroNaoEncontrado, erroRequisicao } from "../../shared/errors";
import { fotosRepository, type VinculosFoto } from "./fotos.repository";
import {
  EXTENSOES_POR_MIME,
  type ArquivoFoto,
  type AtualizarFotoInput,
  type FiltrosFoto,
  type VinculoFotoInput,
} from "./fotos.types";

// ─── Armazenamento em disco ───────────────────────────────────────────────────
// Arquivos em <UPLOADS_DIR>/fotos/<uuid>.<ext>, servidos estaticamente em
// /uploads/fotos/<uuid>.<ext>. O nome é um UUID aleatório (não adivinhável).
// Para migrar para S3/Cloudinary, basta trocar estas três funções.

const URL_PREFIXO = "/uploads/";

async function salvarArquivo(arquivo: ArquivoFoto): Promise<string> {
  const ext = EXTENSOES_POR_MIME[arquivo.mimetype];
  const nome = `${randomUUID()}.${ext}`;
  const dir = path.join(env.UPLOADS_DIR, "fotos");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, nome), arquivo.buffer);
  return `${URL_PREFIXO}fotos/${nome}`;
}

function caminhoDaUrl(url: string): string | null {
  if (!url.startsWith(URL_PREFIXO)) return null;
  const relativo = path.normalize(url.slice(URL_PREFIXO.length));
  if (relativo.startsWith("..")) return null;
  return path.join(env.UPLOADS_DIR, relativo);
}

// Remoção de arquivo nunca derruba a operação principal — no pior caso sobra
// um arquivo sem registro no disco.
export async function apagarArquivos(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      const caminho = caminhoDaUrl(url);
      if (caminho) await unlink(caminho).catch(() => undefined);
    })
  );
}

// Usado antes de excluir colônia/avaliação/produção: o cascade do banco apaga
// as linhas de `fotos`, mas os arquivos em disco precisam ser removidos aqui.
export function listarArquivosDe(where: Prisma.FotoWhereInput): Promise<string[]> {
  return fotosRepository.listarUrls(where);
}

// ─── Regra de integridade (claude.md §8) ──────────────────────────────────────
// Toda foto precisa de pelo menos uma FK. Além disso, as FKs são derivadas e
// verificadas em cadeia para garantir coerência e propriedade:
//   avaliacaoParametro → avaliacao → colonia
//   producao → colonia
// O coloniaId é sempre preenchido, o que permite a galeria da colônia e faz a
// foto sobreviver (vinculada à avaliação) se o parâmetro for removido.

async function resolverVinculos(userId: string, input: VinculoFotoInput): Promise<VinculosFoto> {
  const { coloniaId, avaliacaoId, avaliacaoParametroId, producaoId } = input;

  if (!coloniaId && !avaliacaoId && !avaliacaoParametroId && !producaoId) {
    throw erroRequisicao(
      "A foto precisa estar vinculada a uma colônia, avaliação, parâmetro avaliado ou colheita."
    );
  }
  if ((avaliacaoId || avaliacaoParametroId) && producaoId) {
    throw erroRequisicao("A foto deve se referir a uma avaliação ou a uma colheita, não a ambas.");
  }

  let colonia: string | undefined;
  let avaliacao: string | undefined;

  const conferir = (atual: string | undefined, derivado: string, campo: string) => {
    if (atual !== undefined && atual !== derivado) {
      throw erroRequisicao(`${campo} não corresponde aos demais vínculos da foto.`);
    }
    return derivado;
  };

  if (avaliacaoParametroId) {
    const ap = await prisma.avaliacaoParametro.findFirst({
      where: { id: avaliacaoParametroId, avaliacao: { colonia: { userId } } },
      select: { avaliacaoId: true, avaliacao: { select: { coloniaId: true } } },
    });
    if (!ap) throw erroNaoEncontrado("Parâmetro avaliado não encontrado");
    avaliacao = ap.avaliacaoId;
    colonia = ap.avaliacao.coloniaId;
  }

  if (avaliacaoId) {
    const av = await prisma.avaliacao.findFirst({
      where: { id: avaliacaoId, colonia: { userId } },
      select: { coloniaId: true },
    });
    if (!av) throw erroNaoEncontrado("Avaliação não encontrada");
    avaliacao = conferir(avaliacao, avaliacaoId, "avaliacaoId");
    colonia = conferir(colonia, av.coloniaId, "avaliacaoId");
  }

  if (producaoId) {
    const pr = await prisma.producao.findFirst({
      where: { id: producaoId, colonia: { userId } },
      select: { coloniaId: true },
    });
    if (!pr) throw erroNaoEncontrado("Colheita não encontrada");
    colonia = pr.coloniaId;
  }

  if (coloniaId) {
    const col = await prisma.colonia.findFirst({ where: { id: coloniaId, userId }, select: { id: true } });
    if (!col) throw erroNaoEncontrado("Colônia não encontrada");
    colonia = conferir(colonia, coloniaId, "coloniaId");
  }

  return {
    coloniaId: colonia!,
    avaliacaoId: avaliacao ?? null,
    avaliacaoParametroId: avaliacaoParametroId ?? null,
    producaoId: producaoId ?? null,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const fotosService = {
  listar(userId: string, filtros: FiltrosFoto) {
    return fotosRepository.listar(userId, filtros);
  },

  async buscarPorId(id: string, userId: string) {
    const foto = await fotosRepository.buscarPorId(id, userId);
    if (!foto) throw erroNaoEncontrado("Foto não encontrada");
    return foto;
  },

  async criar(userId: string, input: VinculoFotoInput, arquivo: ArquivoFoto) {
    if (!EXTENSOES_POR_MIME[arquivo.mimetype]) {
      throw erroRequisicao("Formato não suportado. Envie JPEG, PNG ou WebP.");
    }

    const vinculos = await resolverVinculos(userId, input);
    const url = await salvarArquivo(arquivo);
    const tamanhoKb = Math.ceil(arquivo.buffer.length / 1024);

    try {
      return await fotosRepository.criar(url, tamanhoKb, input.legenda ?? null, vinculos);
    } catch (err) {
      await apagarArquivos([url]);
      throw err;
    }
  },

  async atualizar(id: string, userId: string, data: AtualizarFotoInput) {
    await fotosService.buscarPorId(id, userId);
    return fotosRepository.atualizarLegenda(id, data.legenda);
  },

  async excluir(id: string, userId: string) {
    const foto = await fotosService.buscarPorId(id, userId);
    await fotosRepository.excluir(id);
    await apagarArquivos([foto.url]);
  },
};
