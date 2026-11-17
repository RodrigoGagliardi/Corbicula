import type { ArquivoParametros, CriteriosTexto, ModoAplicacao, Parametro } from "../types/api";

// Prévia de aplicar um template ou arquivo de parâmetros (tela 18). Espelha as
// regras do servidor (app/backend/src/modules/parametros/parametros.conjuntos.ts),
// que é quem decide de fato e devolve o resumo oficial:
// - mesmo nome (sem diferenciar maiúsculas/acentos) = mesmo parâmetro, mantido
//   com os critérios do usuário; reativado se estava desativado;
// - "substituir" desativa (nunca exclui) os parâmetros fora do conjunto.

export const normalizarNome = (nome: string) =>
  nome.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");

type Item = CriteriosTexto & { nome: string; ativo?: boolean };

export interface Previa {
  novos: string[];
  reativar: string[];
  desativar: string[];
  existentes: string[];
  criteriosDiferentes: string[];
}

export function previaAplicacao(atuais: Parametro[], itens: Item[], modo: ModoAplicacao): Previa {
  const porNome = new Map(atuais.map((p) => [normalizarNome(p.nome), p]));
  const usados = new Set<string>();
  const previa: Previa = { novos: [], reativar: [], desativar: [], existentes: [], criteriosDiferentes: [] };

  for (const item of itens) {
    const ativo = item.ativo ?? true;
    const existente = porNome.get(normalizarNome(item.nome));
    if (!existente) {
      previa.novos.push(item.nome.trim());
      continue;
    }
    usados.add(existente.id);
    previa.existentes.push(existente.nome);
    if (
      existente.criterioBom !== item.criterioBom ||
      existente.criterioMedio !== item.criterioMedio ||
      existente.criterioRuim !== item.criterioRuim
    ) {
      previa.criteriosDiferentes.push(existente.nome);
    }
    const novoAtivo = modo === "substituir" ? ativo : existente.ativo || ativo;
    if (novoAtivo && !existente.ativo) previa.reativar.push(existente.nome);
    if (!novoAtivo && existente.ativo) previa.desativar.push(existente.nome);
  }

  if (modo === "substituir") {
    for (const p of atuais) if (!usados.has(p.id) && p.ativo) previa.desativar.push(p.nome);
  }
  return previa;
}

// Lê o arquivo escolhido pelo usuário. Valida o essencial para dar uma mensagem
// clara antes de enviar; a validação completa é a do servidor.
export function lerArquivoParametros(texto: string): { dados: ArquivoParametros } | { erro: string } {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    return { erro: "O arquivo não é um JSON válido." };
  }
  const d = dados as Partial<ArquivoParametros> | null;
  if (!d || typeof d !== "object" || d.formato !== "corbicula-parametros") {
    return { erro: "Este arquivo não é uma exportação de parâmetros do Corbicula." };
  }
  if (d.versao !== 1) return { erro: `Versão do arquivo não suportada (${String(d.versao)}).` };
  if (!Array.isArray(d.parametros) || d.parametros.length === 0) return { erro: "O arquivo não tem parâmetros." };
  const invalido = d.parametros.find(
    (p) => !p || typeof p.nome !== "string" || ![p.criterioBom, p.criterioMedio, p.criterioRuim].every((c) => typeof c === "string" && c.trim())
  );
  if (invalido) return { erro: `Parâmetro incompleto no arquivo: "${String(invalido?.nome ?? "?")}".` };
  return { dados: d as ArquivoParametros };
}
