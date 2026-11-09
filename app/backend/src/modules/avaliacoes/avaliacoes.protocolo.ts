import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { normalizarNome } from "../parametros/parametros.conjuntos";
import { TEMPLATES } from "../parametros/parametros.templates";

// ─── Protocolo de avaliação (CAP-4) ───────────────────────────────────────────
// O protocolo é o que a avaliação de fato aplicou: os parâmetros avaliados e o
// texto dos critérios Bom/Médio/Ruim vigentes, já com o override da espécie da
// colônia. É gravado uma vez (imutável) e compartilhado entre as avaliações com
// o mesmo conteúdo, então editar um critério depois nunca muda o protocolo de
// uma avaliação antiga: a próxima avaliação recebe outro.
//
// Conteúdo canônico: { versao: 1, itens }, onde itens é a lista ordenada pelo
// nome normalizado (minúsculas, sem acentos), cada item com { nome,
// criterioBom, criterioMedio, criterioRuim, especieCodigo } (especieCodigo =
// null quando vale o critério genérico). Cada texto entra em Unicode NFC e sem
// espaços nas pontas, para que o mesmo texto visível dê o mesmo hash.
// hash = SHA-256 (hex) do JSON.stringify desse objeto. Sem ids: o mesmo
// conteúdo dá o mesmo hash em qualquer meliponário, independentemente da ordem.
// `versao` muda se a forma canônica mudar (hashes de versões diferentes não se
// comparam).

export const VERSAO_PROTOCOLO = 1;

export interface ItemProtocolo {
  nome: string;
  criterioBom: string;
  criterioMedio: string;
  criterioRuim: string;
  especieCodigo: string | null;
}

interface ParametroAplicado {
  nome: string;
  criterioBom: string;
  criterioMedio: string;
  criterioRuim: string;
  override?: { criterioBom: string; criterioMedio: string; criterioRuim: string; especieCodigo: string } | null;
}

export interface ProtocoloCanonico {
  versao: typeof VERSAO_PROTOCOLO;
  itens: ItemProtocolo[];
}

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const texto = (s: string) => s.normalize("NFC").trim();

export function conteudoCanonico(parametros: ParametroAplicado[]): ProtocoloCanonico {
  const itens = parametros
    .map((p) => {
      const c = p.override ?? p;
      // Ordem fixa das chaves: o JSON (e o hash) não depende da origem do objeto.
      return {
        nome: texto(p.nome),
        criterioBom: texto(c.criterioBom),
        criterioMedio: texto(c.criterioMedio),
        criterioRuim: texto(c.criterioRuim),
        especieCodigo: p.override?.especieCodigo ?? null,
      };
    })
    .sort((a, b) => comparar(normalizarNome(a.nome), normalizarNome(b.nome)) || comparar(a.nome, b.nome));
  return { versao: VERSAO_PROTOCOLO, itens };
}

export function hashProtocolo(conteudo: ProtocoloCanonico): string {
  return createHash("sha256").update(JSON.stringify(conteudo)).digest("hex");
}

// Template de origem: o conjunto avaliado tem exatamente os parâmetros de um
// template publicado (nome normalizado), com os mesmos textos de critério.
// Vale a maior versão compatível.
export function templateDoConteudo({ itens }: ProtocoloCanonico): { codigo: string; versao: number } | null {
  const porNome = new Map(itens.map((i) => [normalizarNome(i.nome), i]));
  let melhor: { codigo: string; versao: number } | null = null;
  for (const t of TEMPLATES) {
    if (t.parametros.length !== itens.length || porNome.size !== itens.length) continue;
    const coincide = t.parametros.every((tp) => {
      const item = porNome.get(normalizarNome(tp.nome));
      return (
        item !== undefined &&
        item.criterioBom === texto(tp.criterioBom) &&
        item.criterioMedio === texto(tp.criterioMedio) &&
        item.criterioRuim === texto(tp.criterioRuim)
      );
    });
    if (coincide && (melhor === null || t.versao > melhor.versao)) melhor = { codigo: t.id, versao: t.versao };
  }
  return melhor;
}

// Cria ou reaproveita o protocolo (único por usuário + hash) dos parâmetros
// avaliados, com os critérios vigentes agora. Os parâmetros já foram validados
// pelo service (pertencem ao usuário).
export async function resolverProtocolo(
  userId: string,
  especieId: string | null,
  parametroIds: string[]
): Promise<string> {
  const [parametros, overrides] = await Promise.all([
    prisma.parametro.findMany({
      where: { id: { in: parametroIds }, userId },
      select: { id: true, nome: true, criterioBom: true, criterioMedio: true, criterioRuim: true },
    }),
    especieId
      ? prisma.parametroEspecie.findMany({
          where: { parametroId: { in: parametroIds }, especieId },
          select: {
            parametroId: true,
            criterioBom: true,
            criterioMedio: true,
            criterioRuim: true,
            especie: { select: { codigo: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const overridePorParametro = new Map(
    overrides.map((o) => [
      o.parametroId,
      {
        criterioBom: o.criterioBom,
        criterioMedio: o.criterioMedio,
        criterioRuim: o.criterioRuim,
        especieCodigo: o.especie.codigo,
      },
    ])
  );
  const conteudo = conteudoCanonico(
    parametros.map((p) => ({ ...p, override: overridePorParametro.get(p.id) ?? null }))
  );
  const hash = hashProtocolo(conteudo);

  const existente = await prisma.protocolo.findUnique({ where: { userId_hash: { userId, hash } }, select: { id: true } });
  if (existente) return existente.id;

  const template = templateDoConteudo(conteudo);
  try {
    const criado = await prisma.protocolo.create({
      data: {
        userId,
        hash,
        conteudo: conteudo as unknown as Prisma.InputJsonValue,
        templateCodigo: template?.codigo ?? null,
        templateVersao: template?.versao ?? null,
      },
      select: { id: true },
    });
    return criado.id;
  } catch (err) {
    // Duas avaliações simultâneas com o mesmo protocolo: a outra criou primeiro.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const outro = await prisma.protocolo.findUnique({ where: { userId_hash: { userId, hash } }, select: { id: true } });
      if (outro) return outro.id;
    }
    throw err;
  }
}
