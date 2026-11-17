import { prisma } from "../../config/database";
import { erroNaoEncontrado, erroRequisicao } from "../../shared/errors";
import { TEMPLATES } from "./parametros.templates";
import { FORMATO_ARQUIVO_PARAMETROS, type ItemConjunto, type ModoAplicacao } from "./parametros.types";

// Aplicação de um CONJUNTO de parâmetros (template ou arquivo importado) ao
// usuário, numa única transação: ou tudo é aplicado, ou nada.
//
// Regras de integridade (o histórico de avaliações nunca muda de significado):
// - Parâmetro que já existe (mesmo nome, sem diferenciar maiúsculas/acentos) é
//   mantido como está: seus critérios NÃO são sobrescritos, porque podem ter
//   sido usados em avaliações. Se estava desativado, é reativado.
// - "substituir" desativa os parâmetros fora do conjunto — nunca exclui.
// - Sempre sobra pelo menos 1 parâmetro ativo.

export interface ResumoAplicacao {
  criados: string[];
  reativados: string[];
  desativados: string[];
  // Já existiam e foram mantidos com os critérios do usuário.
  existentes: string[];
  // Subconjunto de `existentes` cujo texto dos critérios difere do conjunto.
  criteriosDiferentes: string[];
  // Códigos de espécie do arquivo que não existem no catálogo.
  especiesIgnoradas: string[];
}

export const normalizarNome = (nome: string) =>
  nome.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");

export async function aplicarConjunto(userId: string, itens: ItemConjunto[], modo: ModoAplicacao): Promise<ResumoAplicacao> {
  const nomes = itens.map((i) => normalizarNome(i.nome));
  const repetido = nomes.find((n, i) => nomes.indexOf(n) !== i);
  if (repetido) throw erroRequisicao(`Parâmetro repetido no conjunto: "${itens[nomes.indexOf(repetido)]!.nome}"`);

  const codigos = [...new Set(itens.flatMap((i) => i.criteriosEspecie?.map((c) => c.especie.toUpperCase()) ?? []))];

  return prisma.$transaction(async (tx) => {
    const resumo: ResumoAplicacao = {
      criados: [],
      reativados: [],
      desativados: [],
      existentes: [],
      criteriosDiferentes: [],
      especiesIgnoradas: [],
    };

    const atuais = await tx.parametro.findMany({ where: { userId }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
    const porNome = new Map(atuais.map((p) => [normalizarNome(p.nome), p]));
    const especies = codigos.length
      ? await tx.especie.findMany({ where: { codigo: { in: codigos } }, select: { id: true, codigo: true } })
      : [];
    const especiePorCodigo = new Map(especies.map((e) => [e.codigo, e.id]));
    resumo.especiesIgnoradas = codigos.filter((c) => !especiePorCodigo.has(c));

    let proximaOrdem = atuais.reduce((max, p) => Math.max(max, p.ordem), 0) + 1;
    const usados = new Set<string>();

    for (const [indice, item] of itens.entries()) {
      const ativo = item.ativo ?? true;
      const existente = porNome.get(nomes[indice]!);

      if (existente) {
        usados.add(existente.id);
        resumo.existentes.push(existente.nome);
        if (
          existente.criterioBom !== item.criterioBom ||
          existente.criterioMedio !== item.criterioMedio ||
          existente.criterioRuim !== item.criterioRuim
        ) {
          resumo.criteriosDiferentes.push(existente.nome);
        }
        // mesclar: só reativa. substituir: o estado passa a ser o do conjunto.
        const novoAtivo = modo === "substituir" ? ativo : existente.ativo || ativo;
        if (novoAtivo && !existente.ativo) resumo.reativados.push(existente.nome);
        if (!novoAtivo && existente.ativo) resumo.desativados.push(existente.nome);
        const novaOrdem = modo === "substituir" ? indice + 1 : existente.ordem;
        if (novoAtivo !== existente.ativo || novaOrdem !== existente.ordem) {
          await tx.parametro.update({ where: { id: existente.id }, data: { ativo: novoAtivo, ordem: novaOrdem } });
        }
        continue;
      }

      await tx.parametro.create({
        data: {
          userId,
          nome: item.nome.trim(),
          ordem: modo === "substituir" ? indice + 1 : proximaOrdem++,
          ativo,
          criterioBom: item.criterioBom,
          criterioMedio: item.criterioMedio,
          criterioRuim: item.criterioRuim,
          criteriosEspecie: {
            create: (item.criteriosEspecie ?? [])
              .filter((c) => especiePorCodigo.has(c.especie.toUpperCase()))
              .map((c) => ({
                especieId: especiePorCodigo.get(c.especie.toUpperCase())!,
                criterioBom: c.criterioBom,
                criterioMedio: c.criterioMedio,
                criterioRuim: c.criterioRuim,
              })),
          },
        },
      });
      resumo.criados.push(item.nome.trim());
    }

    if (modo === "substituir") {
      const fora = atuais.filter((p) => !usados.has(p.id) && p.ativo);
      if (fora.length) {
        await tx.parametro.updateMany({ where: { id: { in: fora.map((p) => p.id) } }, data: { ativo: false } });
        resumo.desativados.push(...fora.map((p) => p.nome));
      }
    }

    const ativos = await tx.parametro.count({ where: { userId, ativo: true } });
    if (ativos === 0) throw erroRequisicao("O resultado deixaria nenhum parâmetro ativo — é preciso pelo menos 1.");

    return resumo;
  });
}

export async function aplicarTemplate(userId: string, templateId: string, modo: ModoAplicacao) {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw erroNaoEncontrado("Template não encontrado");
  return aplicarConjunto(userId, template.parametros, modo);
}

// Arquivo de exportação dos parâmetros do usuário (formato versionado, aceito
// de volta por POST /parametros/importar). Critérios por espécie vão pelo
// código Kew, que é estável entre instalações — o UUID da espécie não é.
export async function exportarParametros(userId: string) {
  const parametros = await prisma.parametro.findMany({
    where: { userId },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    include: {
      criteriosEspecie: { include: { especie: { select: { codigo: true } } }, orderBy: { especie: { codigo: "asc" } } },
    },
  });
  return {
    formato: FORMATO_ARQUIVO_PARAMETROS,
    versao: 1 as const,
    exportadoEm: new Date().toISOString(),
    metodologia:
      "Cada parâmetro é classificado como bom, medio ou ruim em cada avaliação. " +
      "Score = (n_bom × 100 + n_medio × 50 + n_ruim × 0) / n_parametros_avaliados. " +
      "criteriosEspecie substituem os critérios genéricos para colônias da espécie (código Kew).",
    parametros: parametros.map((p) => ({
      nome: p.nome,
      ativo: p.ativo,
      criterioBom: p.criterioBom,
      criterioMedio: p.criterioMedio,
      criterioRuim: p.criterioRuim,
      criteriosEspecie: p.criteriosEspecie.map((c) => ({
        especie: c.especie.codigo,
        criterioBom: c.criterioBom,
        criterioMedio: c.criterioMedio,
        criterioRuim: c.criterioRuim,
      })),
    })),
  };
}
