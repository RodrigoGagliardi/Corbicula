import type { AvaliacaoInput, ColoniaInput } from "../../types/api";
import { LIMITE_EDICAO_DIAS } from "../../utils/score";
import { ErroApi } from "../api/client";
import type { AvaliacaoServidor, ColoniaServidor, ParametroServidor } from "./tipos";

// Regras do servidor checadas na cópia local antes de uma escrita entrar na
// fila (funções puras). Espelham, com os mesmos textos e status:
//  - app/backend/src/modules/colonias/colonias.service.ts (genealogia, espécie, exclusão);
//  - app/backend/src/modules/avaliacoes/avaliacoes.service.ts (7 dias, parâmetros ativos).
// O servidor continua a autoridade: se recusar mesmo assim, a operação para
// esperando decisão do usuário. Ao mudar uma regra ou um texto lá, mude aqui.
// Ficam com os formulários (não espelhadas aqui) as regras de 400 que eles já
// impedem: data e motivo do status, motivos das ações, ao menos um parâmetro.
// Um código provisório (criado offline) aparece como tal nas mensagens.

const conflito = (mensagem: string) => new ErroApi(409, mensagem);
const naoEncontrado = (mensagem: string) => new ErroApi(404, mensagem);

// Dia em UTC, como `dia()` no servidor.
const dia = (d: string) => new Date(d).toISOString().slice(0, 10);

type Relacionada = Pick<ColoniaServidor, "id" | "codigo" | "especieId" | "dataEntrada">;
type Filha = { especieId: string | null; dataEntrada: string };

function buscarRelacionada(colonias: readonly ColoniaServidor[], id: string, papel: string): Relacionada {
  const colonia = colonias.find((c) => c.id === id);
  if (!colonia) throw naoEncontrado(`Colônia ${papel} não encontrada ou não pertence ao usuário`);
  return colonia;
}

function conferirOrigem(rel: Relacionada, papel: string, filha: Filha) {
  if (rel.especieId && filha.especieId && rel.especieId !== filha.especieId) {
    throw conflito(`A espécie deve ser a mesma da colônia ${papel} (${rel.codigo}): uma divisão não muda de espécie.`);
  }
  if (dia(filha.dataEntrada) < dia(rel.dataEntrada)) {
    throw conflito(`A data de entrada não pode ser anterior à da colônia ${papel} (${rel.codigo}, ${dia(rel.dataEntrada)}).`);
  }
}

// Sobe a linhagem a partir da nova mãe; encontrar a própria colônia seria ciclo.
function conferirCiclo(colonias: readonly ColoniaServidor[], id: string, maeId: string) {
  const porId = new Map(colonias.map((c) => [c.id, c]));
  const visitados = new Set<string>();
  let atual: string | null = maeId;
  while (atual && !visitados.has(atual)) {
    if (atual === id) throw conflito("Genealogia inválida: a colônia mãe é descendente desta colônia");
    visitados.add(atual);
    atual = porId.get(atual)?.coloniaMaeId ?? null;
  }
}

function conferirDerivadas(colonias: readonly ColoniaServidor[], id: string, origem: Filha) {
  const derivadas = colonias
    .filter((c) => c.coloniaMaeId === id || c.coloniaDoadoraCampeirasId === id)
    .sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0));
  const codigos = (lista: Relacionada[]) => lista.map((d) => d.codigo).join(", ");

  const outraEspecie = derivadas.filter((d) => origem.especieId && d.especieId && d.especieId !== origem.especieId);
  if (outraEspecie.length > 0) {
    throw conflito(
      `A espécie deve ser a mesma das colônias formadas a partir desta (${codigos(outraEspecie)}): uma divisão não muda de espécie.`
    );
  }
  const anteriores = derivadas.filter((d) => dia(d.dataEntrada) < dia(origem.dataEntrada));
  if (anteriores.length > 0) {
    throw conflito(`A data de entrada não pode ser posterior à das colônias formadas a partir desta (${codigos(anteriores)}).`);
  }
}

function conferirVinculos(id: string | null, final: { origem: string; maeId: string | null; doadoraId: string | null }) {
  if (final.origem !== "divisao") {
    if (final.maeId) throw conflito("Colônia mãe só se aplica a colônias de origem divisão");
    if (final.doadoraId) throw conflito("Colônia doadora de campeiras só se aplica a colônias de origem divisão");
  }
  if (!final.doadoraId) return;
  if (final.doadoraId === id) throw conflito("Uma colônia não pode doar campeiras para si mesma");
  if (final.doadoraId === final.maeId) throw conflito("A doadora de campeiras deve ser outra colônia, diferente da mãe");
}

// Create: confere os vínculos e devolve a espécie final (a filha sem espécie
// herda a da mãe, como no servidor).
export function validarNovaColonia(id: string, dados: ColoniaInput, colonias: readonly ColoniaServidor[]): string | null {
  conferirVinculos(id, { origem: dados.origem, maeId: dados.coloniaMaeId ?? null, doadoraId: dados.coloniaDoadoraCampeirasId ?? null });
  let especieId = dados.especieId ?? null;
  if (dados.coloniaMaeId) {
    const mae = buscarRelacionada(colonias, dados.coloniaMaeId, "mãe");
    if (!especieId && mae.especieId) especieId = mae.especieId;
    conferirOrigem(mae, "mãe", { especieId, dataEntrada: dados.dataEntrada });
  }
  if (dados.coloniaDoadoraCampeirasId) {
    const doadora = buscarRelacionada(colonias, dados.coloniaDoadoraCampeirasId, "doadora de campeiras");
    conferirOrigem(doadora, "doadora de campeiras", { especieId, dataEntrada: dados.dataEntrada });
  }
  return especieId;
}

// Update: só valida o que o PATCH mexe (um registro antigo já inconsistente
// continua editável nos outros campos). Mesma ordem do servidor a partir da
// checagem de mãe de si mesma (as regras de status, que ele confere antes, ficam
// com o formulário).
export function validarEdicaoColonia(existente: ColoniaServidor, dados: Partial<ColoniaInput>, colonias: readonly ColoniaServidor[]): void {
  const id = existente.id;
  if (dados.coloniaMaeId === id) throw conflito("Uma colônia não pode ser mãe de si mesma");

  const trocaEspecie = dados.especieId !== undefined && dados.especieId !== existente.especieId;
  if (trocaEspecie && existente.especieId) {
    throw conflito(
      "A espécie de uma colônia não pode ser alterada depois de definida. " +
        "Se a identificação estava errada, registre uma nova colônia e marque esta como inativa."
    );
  }

  const final = {
    especieId: dados.especieId !== undefined ? dados.especieId : existente.especieId,
    dataEntrada: dados.dataEntrada ?? existente.dataEntrada,
    origem: dados.origem ?? existente.origem,
    maeId: dados.coloniaMaeId !== undefined ? dados.coloniaMaeId : existente.coloniaMaeId,
    doadoraId: dados.coloniaDoadoraCampeirasId !== undefined ? dados.coloniaDoadoraCampeirasId : existente.coloniaDoadoraCampeirasId,
  };

  const mexeNaOrigem =
    trocaEspecie ||
    dados.dataEntrada !== undefined ||
    dados.origem !== undefined ||
    dados.coloniaMaeId !== undefined ||
    dados.coloniaDoadoraCampeirasId !== undefined;
  if (mexeNaOrigem) {
    conferirVinculos(id, final);
    if (final.maeId) {
      conferirOrigem(buscarRelacionada(colonias, final.maeId, "mãe"), "mãe", final);
      if (dados.coloniaMaeId) conferirCiclo(colonias, id, final.maeId);
    }
    if (final.doadoraId) {
      conferirOrigem(buscarRelacionada(colonias, final.doadoraId, "doadora de campeiras"), "doadora de campeiras", final);
    }
  }
  if (trocaEspecie || dados.dataEntrada !== undefined) conferirDerivadas(colonias, id, final);
}

export const mensagemColoniaComAvaliacoes = (qtd: number) =>
  `Não é possível excluir: colônia possui ${qtd} avaliação(ões). ` +
  `Use status "morta" para registrar o encerramento preservando o histórico.`;

// Preservação de dados: colônia com avaliações não é excluída.
export function validarExclusaoColonia(qtdAvaliacoes: number): void {
  if (qtdAvaliacoes > 0) throw conflito(mensagemColoniaComAvaliacoes(qtdAvaliacoes));
}

// Mesma conta do servidor (`dentroDoLimiteEdicao`): até 7 dias exatos depois do
// registro, inclusive (a tela, com `podeEditar`, esconde a edição no limite).
export function validarJanelaEdicao(createdAt: string, agora: Date = new Date()): void {
  if (agora.getTime() - new Date(createdAt).getTime() > LIMITE_EDICAO_DIAS * 24 * 60 * 60 * 1000) {
    throw conflito(`Avaliações só podem ser editadas nos primeiros ${LIMITE_EDICAO_DIAS} dias após o registro.`);
  }
}

// Parâmetros avaliados: do usuário e ativos, ou já presentes na avaliação
// editada (desativados depois continuam aceitos). Ids repetidos também são
// recusados, como no servidor (que compara as contagens).
export function validarParametros(
  parametroIds: readonly string[],
  parametros: readonly Pick<ParametroServidor, "id" | "ativo">[],
  jaAvaliados: readonly string[] = []
): void {
  const aceitos = new Set(parametros.filter((p) => p.ativo || jaAvaliados.includes(p.id)).map((p) => p.id));
  const encontrados = new Set(parametroIds.filter((id) => aceitos.has(id)));
  if (encontrados.size !== parametroIds.length) {
    throw conflito("Um ou mais parâmetros não foram encontrados, não pertencem ao usuário ou estão inativos.");
  }
}

export function validarNovaAvaliacao(
  coloniaId: string,
  dados: AvaliacaoInput,
  colonias: readonly Pick<ColoniaServidor, "id">[],
  parametros: readonly Pick<ParametroServidor, "id" | "ativo">[]
): void {
  if (!colonias.some((c) => c.id === coloniaId)) throw naoEncontrado("Colônia não encontrada");
  validarParametros(dados.parametros.map((p) => p.parametroId), parametros);
}

export function validarEdicaoAvaliacao(
  linha: AvaliacaoServidor,
  dados: Partial<AvaliacaoInput>,
  parametros: readonly Pick<ParametroServidor, "id" | "ativo">[],
  agora: Date = new Date()
): void {
  validarJanelaEdicao(linha.createdAt, agora);
  if (dados.parametros) {
    validarParametros(
      dados.parametros.map((p) => p.parametroId),
      parametros,
      linha.parametros.map((p) => p.parametroId)
    );
  }
}
