// Templates de parâmetros (tela 18): conjuntos prontos e cumulativos —
// Iniciante (5) ⊂ Intermediário (8) ⊂ Avançado (12) ⊂ Científico (15).
//
// São critérios de REFERÊNCIA GERAIS, qualitativos sempre que possível: o que é
// "bom" varia muito entre espécies (uma Jataí e uma Mandaçaia não têm o mesmo
// fluxo de entrada nem o mesmo número de potes). Para pesquisa, ajuste os
// critérios genéricos ou defina critérios por espécie depois de aplicar.
//
// Rastreabilidade: cada template tem `versao`. Mudar o texto de um critério já
// publicado exige subir a versão (quem aplicou a versão anterior continua com o
// texto antigo — aplicar um template nunca altera parâmetros existentes).

export interface ParametroTemplate {
  nome: string;
  criterioBom: string;
  criterioMedio: string;
  criterioRuim: string;
}

export interface Template {
  id: "iniciante" | "intermediario" | "avancado" | "cientifico";
  nome: string;
  versao: number;
  descricao: string;
  parametros: ParametroTemplate[];
}

// Os 5 parâmetros padrão (também usados pelo seed do usuário de teste).
export const PARAMETROS_INICIANTE: ParametroTemplate[] = [
  {
    nome: "Fluxo de entrada",
    criterioBom: "20 ou mais abelhas por minuto entrando na colônia",
    criterioMedio: "10 a 19 abelhas por minuto",
    criterioRuim: "Menos de 10 abelhas por minuto ou ausência de voo",
  },
  {
    nome: "Potes de mel",
    criterioBom: "15 ou mais potes cheios ou em construção",
    criterioMedio: "5 a 14 potes",
    criterioRuim: "Menos de 5 potes ou ausência",
  },
  {
    nome: "Discos de cria",
    criterioBom: "5 ou mais discos com cria operculada",
    criterioMedio: "2 a 4 discos",
    criterioRuim: "0 a 1 disco ou cria irregular",
  },
  {
    nome: "Condição da rainha",
    criterioBom: "Rainha presente, ativa e com postura regular",
    criterioMedio: "Rainha presente, postura irregular ou intermitente",
    criterioRuim: "Rainha ausente, zanganeira ou colônia em colapso",
  },
  {
    nome: "Sanidade",
    criterioBom: "Ausência de pragas, fungos ou forídeos",
    criterioMedio: "Presença leve de forídeos ou outros inimigos controlada",
    criterioRuim: "Infestação grave de forídeos, fungos ou outros patógenos",
  },
];

const PARAMETROS_INTERMEDIARIO: ParametroTemplate[] = [
  {
    nome: "Potes de pólen",
    criterioBom: "Potes de pólen cheios ou em construção junto ao ninho",
    criterioMedio: "Poucos potes de pólen, parte deles vazios",
    criterioRuim: "Sem potes de pólen ou potes vazios e abandonados",
  },
  {
    nome: "Estrutura do ninho",
    criterioBom: "Invólucro íntegro, discos alinhados e caixa bem vedada (batume e frestas fechados)",
    criterioMedio: "Invólucro parcial ou frestas pequenas sendo vedadas pelas abelhas",
    criterioRuim: "Ninho exposto, invólucro desfeito ou caixa com frestas abertas, umidade ou danos",
  },
  {
    nome: "Reservas (peso da caixa)",
    criterioBom: "Caixa pesada para o tamanho; reservas estáveis ou crescendo desde a última inspeção",
    criterioMedio: "Peso semelhante ao da inspeção anterior, reservas sendo consumidas",
    criterioRuim: "Caixa leve, reservas esgotadas ou em queda acentuada",
  },
];

const PARAMETROS_AVANCADO: ParametroTemplate[] = [
  {
    nome: "Comportamento defensivo",
    criterioBom: "Guardas na entrada e reação ao manejo esperada para a espécie",
    criterioMedio: "Poucas guardas ou reação fraca ao manejo",
    criterioRuim: "Entrada sem guardas, sinais de saque ou reação anormal para a espécie",
  },
  {
    nome: "Presença de machos",
    criterioBom: "Machos ausentes ou em quantidade normal para a época",
    criterioMedio: "Agregação de machos na entrada ou aumento de cria de machos",
    criterioRuim: "Produção massiva de machos com rainha fraca ou ausente (possível orfandade ou rainha zanganeira)",
  },
  {
    nome: "Coleta de resina",
    criterioBom: "Abelhas chegando com resina; batume e própolis sendo renovados",
    criterioMedio: "Coleta de resina ocasional",
    criterioRuim: "Sem coleta de resina e vedação da caixa se deteriorando",
  },
  {
    nome: "Higiene da colônia",
    criterioBom: "Detritos e abelhas mortas descartados regularmente; interior limpo",
    criterioMedio: "Acúmulo leve de detritos no fundo da caixa",
    criterioRuim: "Lixo acumulado, odor forte ou cria morta sem remoção",
  },
];

const PARAMETROS_CIENTIFICO: ParametroTemplate[] = [
  {
    nome: "Postura recente",
    criterioBom: "Disco novo em construção com células recém-aprovisionadas desde a última inspeção",
    criterioMedio: "Construção lenta: poucas células novas desde a última inspeção",
    criterioRuim: "Nenhuma célula nova desde a última inspeção",
  },
  {
    nome: "Ocupação da caixa",
    criterioBom: "Ninho e potes ocupam a maior parte do volume da caixa (considerar divisão ou melgueira)",
    criterioMedio: "Ocupação intermediária do volume da caixa",
    criterioRuim: "Colônia ocupa uma fração pequena da caixa ou está encolhendo",
  },
  {
    nome: "Condições internas",
    criterioBom: "Interior seco, sem condensação nem mofo",
    criterioMedio: "Condensação leve ou pontos de umidade",
    criterioRuim: "Umidade excessiva, mofo ou água acumulada",
  },
];

export const TEMPLATES: Template[] = [
  {
    id: "iniciante",
    nome: "Iniciante",
    versao: 1,
    descricao: "O essencial de uma inspeção rápida: atividade, reservas de mel, cria, rainha e sanidade.",
    parametros: PARAMETROS_INICIANTE,
  },
  {
    id: "intermediario",
    nome: "Intermediário",
    versao: 1,
    descricao: "Iniciante + pólen, estrutura do ninho e reservas pelo peso da caixa.",
    parametros: [...PARAMETROS_INICIANTE, ...PARAMETROS_INTERMEDIARIO],
  },
  {
    id: "avancado",
    nome: "Avançado",
    versao: 1,
    descricao: "Intermediário + comportamento defensivo, machos, coleta de resina e higiene.",
    parametros: [...PARAMETROS_INICIANTE, ...PARAMETROS_INTERMEDIARIO, ...PARAMETROS_AVANCADO],
  },
  {
    id: "cientifico",
    nome: "Científico",
    versao: 1,
    descricao:
      "Avançado + postura recente, ocupação da caixa e condições internas — para séries históricas de pesquisa.",
    parametros: [...PARAMETROS_INICIANTE, ...PARAMETROS_INTERMEDIARIO, ...PARAMETROS_AVANCADO, ...PARAMETROS_CIENTIFICO],
  },
];
