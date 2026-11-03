import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? "" }),
});

function gerarCodigoKew(
  genero: string,
  especie: string,
  subespecie?: string
): string {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase();
  let codigo = norm(genero).slice(0, 4) + norm(especie).slice(0, 4);
  if (subespecie) codigo += "_" + norm(subespecie).slice(0, 4);
  return codigo;
}

const ESPECIES = [
  // Tetragonisca
  {
    genero: "Tetragonisca",
    especie: "angustula",
    nomePopular: "Jataí",
    nomeCientifico: "Tetragonisca angustula",
    nomesAlternativos: JSON.stringify(["Jataí-do-sul", "Tubiba", "Mandaí"]),
    caracteristicas: JSON.stringify({
      tamanho: "3.5–4 mm",
      cor: "Preta com listras amarelo-claras no abdômen",
      comportamento: "Muito mansa e dócil; ideal para iniciantes e ambiente urbano",
      tipoEntrada: "Tubular de cera branca amarelada, verticalmente orientada",
      populacaoMedia: "7.000–10.000 indivíduos",
      mel: "Líquido, levemente ácido, alto valor medicinal; produção: 0,5–2 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Pampa", "Mata Ciliar"]),
    statusConservacao: "LC",
  },
  {
    genero: "Tetragonisca",
    especie: "fiebrigi",
    nomePopular: "Jataí-da-terra",
    nomeCientifico: "Tetragonisca fiebrigi",
    nomesAlternativos: JSON.stringify(["Jataí-chão"]),
    caracteristicas: JSON.stringify({
      tamanho: "3.5–4 mm",
      cor: "Preta com marcas amarelas, muito semelhante à T. angustula",
      comportamento: "Mansa; nidifica preferencialmente em cavidades no solo ou cupinzeiros",
      tipoEntrada: "Tubular de cera, ao nível do solo ou rente a ele",
      populacaoMedia: "5.000–8.000 indivíduos",
      mel: "Similar ao da Jataí, levemente ácido",
    }),
    ocorrenciaBiomas: JSON.stringify(["Pampa", "Mata Ciliar"]),
    statusConservacao: "LC",
  },

  // Melipona
  {
    genero: "Melipona",
    especie: "quadrifasciata",
    nomePopular: "Mandaçaia",
    nomeCientifico: "Melipona quadrifasciata",
    nomesAlternativos: JSON.stringify(["Mandaçaia-do-sul", "Boca-de-renda", "MQQ"]),
    caracteristicas: JSON.stringify({
      tamanho: "11–13 mm",
      cor: "Preta com quatro faixas amarelas nítidas no abdômen",
      comportamento: "Dócil; abelha-bandeira da meliponicultura gaúcha",
      tipoEntrada: "Orifício circular com batume de cerume escuro",
      populacaoMedia: "300–600 indivíduos",
      mel: "Mel cremoso de sabor pronunciado; produção: 1–3 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Floresta com Araucária"]),
    statusConservacao: "VU",
  },
  {
    genero: "Melipona",
    especie: "bicolor",
    subespecie: "schencki",
    nomePopular: "Guaraipo",
    nomeCientifico: "Melipona bicolor schencki",
    nomesAlternativos: JSON.stringify(["Guaraipo Negra", "Mombuca"]),
    caracteristicas: JSON.stringify({
      tamanho: "10–12 mm",
      cor: "Preta com manchas amarelas irregulares; dimorfismo marcante entre castas",
      comportamento: "Relativamente dócil; ativa em temperaturas mais baixas que outras Melipona",
      tipoEntrada: "Orifício com betume escuro, frequentemente em troncos altos",
      populacaoMedia: "200–500 indivíduos",
      mel: "Líquido e delicado, teor de água elevado; produção: 0,5–1,5 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Floresta com Araucária"]),
    statusConservacao: "VU",
  },
  {
    genero: "Melipona",
    especie: "obscurior",
    nomePopular: "Manduri",
    nomeCientifico: "Melipona obscurior",
    nomesAlternativos: JSON.stringify(["Manduri-preto"]),
    caracteristicas: JSON.stringify({
      tamanho: "9–10 mm",
      cor: "Predominantemente preta, com poucas marcas amarelas",
      comportamento: "Discreta; colônias menores que outras Melipona",
      tipoEntrada: "Orifício pequeno com betume escuro",
      populacaoMedia: "200–400 indivíduos",
      mel: "Ácido e aromático; produção: 0,3–1 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Floresta com Araucária"]),
    statusConservacao: "EN",
  },
  {
    genero: "Melipona",
    especie: "marginata",
    nomePopular: "Manduri-rajada",
    nomeCientifico: "Melipona marginata",
    nomesAlternativos: JSON.stringify(["Manduri", "Rajada"]),
    caracteristicas: JSON.stringify({
      tamanho: "8–9 mm",
      cor: "Preta com margem posterior dos tergitos amarelo-pálida",
      comportamento: "Mansa; prefere floresta densa",
      tipoEntrada: "Orifício com cerume, frequentemente em galhos",
      populacaoMedia: "250–450 indivíduos",
      mel: "Levemente ácido; produção: 0,3–0,8 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica"]),
    statusConservacao: "VU",
  },

  // Plebeia
  {
    genero: "Plebeia",
    especie: "droryana",
    nomePopular: "Mirim-droryana",
    nomeCientifico: "Plebeia droryana",
    nomesAlternativos: JSON.stringify(["Mirim", "Abelha-mirim"]),
    caracteristicas: JSON.stringify({
      tamanho: "3–3.5 mm",
      cor: "Preta brilhante, abdômen levemente ferrugíneo",
      comportamento: "Defensiva quando perturbada; pode picar",
      tipoEntrada: "Orifício irregular com batume resinoso",
      populacaoMedia: "3.000–8.000 indivíduos",
      mel: "Muito ácido; produção baixa",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Mata Ciliar"]),
    statusConservacao: "LC",
  },
  {
    genero: "Plebeia",
    especie: "emerina",
    nomePopular: "Mirim-emerina",
    nomeCientifico: "Plebeia emerina",
    nomesAlternativos: JSON.stringify(["Abelha-mirim-emerina"]),
    caracteristicas: JSON.stringify({
      tamanho: "3–3.5 mm",
      cor: "Preta com tégulas e pernas ferruginosas",
      comportamento: "Relativamente mansa; comum em áreas urbanas e rurais",
      tipoEntrada: "Orifício com resina endurecida",
      populacaoMedia: "4.000–9.000 indivíduos",
      mel: "Ácido, aquoso; produção: 0,1–0,5 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Pampa", "Mata Ciliar"]),
    statusConservacao: "LC",
  },
  {
    genero: "Plebeia",
    especie: "nigriceps",
    nomePopular: "Mirim-nigriceps",
    nomeCientifico: "Plebeia nigriceps",
    nomesAlternativos: JSON.stringify([]),
    caracteristicas: JSON.stringify({
      tamanho: "3–3.5 mm",
      cor: "Preta com cabeça completamente escura",
      comportamento: "Pouco estudada em cativeiro",
      tipoEntrada: "Orifício com batume resinoso",
      populacaoMedia: "2.000–6.000 indivíduos",
      mel: "Ácido; produção muito baixa",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica"]),
    statusConservacao: "LC",
  },
  {
    genero: "Plebeia",
    especie: "remota",
    nomePopular: "Mirim-remota",
    nomeCientifico: "Plebeia remota",
    nomesAlternativos: JSON.stringify([]),
    caracteristicas: JSON.stringify({
      tamanho: "3–3.5 mm",
      cor: "Preta, indistinguível externamente de outras Plebeia sem chave taxonômica",
      comportamento: "Rara em cativeiro; sensível a distúrbios",
      tipoEntrada: "Orifício pequeno com betume",
      populacaoMedia: "2.000–5.000 indivíduos",
      mel: "Muito ácido; produção baixa",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Floresta com Araucária"]),
    statusConservacao: "VU",
  },
  {
    genero: "Plebeia",
    especie: "catamarcensis",
    nomePopular: "Mirim-catamarcense",
    nomeCientifico: "Plebeia catamarcensis",
    nomesAlternativos: JSON.stringify([]),
    caracteristicas: JSON.stringify({
      tamanho: "3–3.5 mm",
      cor: "Preta com pequenas marcas amarelas",
      comportamento: "Pouco estudada no RS",
      tipoEntrada: "Orifício com betume escuro",
      populacaoMedia: "2.000–5.000 indivíduos",
      mel: "Ácido; produção baixa",
    }),
    ocorrenciaBiomas: JSON.stringify(["Pampa"]),
    statusConservacao: "LC",
  },
  {
    genero: "Plebeia",
    especie: "meridionalis",
    nomePopular: "Mirim-meridional",
    nomeCientifico: "Plebeia meridionalis",
    nomesAlternativos: JSON.stringify([]),
    caracteristicas: JSON.stringify({
      tamanho: "3–3.5 mm",
      cor: "Preta",
      comportamento: "Adaptada a regiões de altitude e temperaturas mais baixas",
      tipoEntrada: "Orifício com betume",
      populacaoMedia: "2.000–6.000 indivíduos",
      mel: "Ácido; produção baixa",
    }),
    ocorrenciaBiomas: JSON.stringify(["Floresta com Araucária", "Mata Atlântica"]),
    statusConservacao: "LC",
  },
  {
    genero: "Plebeia",
    especie: "wittmanni",
    nomePopular: "Mirim-wittmanni",
    nomeCientifico: "Plebeia wittmanni",
    nomesAlternativos: JSON.stringify([]),
    caracteristicas: JSON.stringify({
      tamanho: "3–3.5 mm",
      cor: "Preta com reflexos ferruginosos",
      comportamento: "Endêmica do RS; espécie de interesse conservacionista",
      tipoEntrada: "Orifício com betume resinoso",
      populacaoMedia: "2.000–5.000 indivíduos",
      mel: "Ácido; produção baixa",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Floresta com Araucária"]),
    statusConservacao: "VU",
  },

  // Scaptotrigona
  {
    genero: "Scaptotrigona",
    especie: "bipunctata",
    nomePopular: "Tubuna",
    nomeCientifico: "Scaptotrigona bipunctata",
    nomesAlternativos: JSON.stringify(["Tubiba-canudo"]),
    caracteristicas: JSON.stringify({
      tamanho: "6–7 mm",
      cor: "Preta com dois pontos amarelos no mesossoma",
      comportamento: "Defensiva; pode morder fortemente quando perturbada",
      tipoEntrada: "Tubular de cera com batume resinoso",
      populacaoMedia: "5.000–15.000 indivíduos",
      mel: "Ácido e perfumado; produção: 1–3 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Floresta com Araucária"]),
    statusConservacao: "LC",
  },
  {
    genero: "Scaptotrigona",
    especie: "postica",
    nomePopular: "Mandaguari-preta",
    nomeCientifico: "Scaptotrigona postica",
    nomesAlternativos: JSON.stringify(["Mandaguari", "Tubuna-preta"]),
    caracteristicas: JSON.stringify({
      tamanho: "6–7 mm",
      cor: "Completamente preta",
      comportamento: "Muito defensiva; colônias grandes e ruidosas",
      tipoEntrada: "Tubular de cera bem desenvolvida",
      populacaoMedia: "8.000–20.000 indivíduos",
      mel: "Ácido, de sabor marcante; produção: 2–5 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica"]),
    statusConservacao: "LC",
  },
  {
    genero: "Scaptotrigona",
    especie: "Depilis",
    nomePopular: "Canudo",
    nomeCientifico: "Scaptotrigona depilis",
    nomesAlternativos: JSON.stringify([]),
    caracteristicas: JSON.stringify({
      tamanho: "6–7 mm",
      cor: "Preta com pelos amarelados no tórax",
      comportamento: "Defensiva; nidifica em ocos de árvore",
      tipoEntrada: "Tubular com batume de cerume e resina",
      populacaoMedia: "5.000–12.000 indivíduos",
      mel: "Ácido; produção: 1–2 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica"]),
    statusConservacao: "LC",
  },

  // Outros gêneros
  {
    genero: "Nannotrigona",
    especie: "testaceicornis",
    nomePopular: "Iraí",
    nomeCientifico: "Nannotrigona testaceicornis",
    nomesAlternativos: JSON.stringify(["Iraí-amarela", "Abelha-do-barro"]),
    caracteristicas: JSON.stringify({
      tamanho: "4–5 mm",
      cor: "Preta com antenas e pernas ferruginosas",
      comportamento: "Muito mansa; usa barro na construção do ninho",
      tipoEntrada: "Tubular misto de cera e barro",
      populacaoMedia: "5.000–12.000 indivíduos",
      mel: "Suave e levemente ácido; produção: 0,5–1,5 L/ano",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Pampa", "Mata Ciliar"]),
    statusConservacao: "LC",
  },
  {
    genero: "Trigona",
    especie: "spinipes",
    nomePopular: "Irapuá",
    nomeCientifico: "Trigona spinipes",
    nomesAlternativos: JSON.stringify(["Arapuá", "Abelha-cachorro", "Irapuca"]),
    caracteristicas: JSON.stringify({
      tamanho: "6–7 mm",
      cor: "Preta; pernas traseiras longas com espinhos",
      comportamento: "Muito defensiva e agressiva; considerada praga de plantas e outros ninhos; coleta propólis e resinas",
      tipoEntrada: "Invólucro globular de barro e resina pendurado em galhos",
      populacaoMedia: "10.000–30.000 indivíduos",
      mel: "Produção inexpressiva; não recomendada para criação",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Pampa", "Mata Ciliar", "Área urbana"]),
    statusConservacao: "LC",
  },
  {
    genero: "Lestrimelitta",
    especie: "limao",
    nomePopular: "Iratim",
    nomeCientifico: "Lestrimelitta limao",
    nomesAlternativos: JSON.stringify(["Abelha-limão", "Iratim-limão", "Limão"]),
    caracteristicas: JSON.stringify({
      tamanho: "6–7 mm",
      cor: "Preta, abdômen com leve brilho azulado",
      comportamento: "Cleptobiótica obrigatória: invade e pilha colônias de outras abelhas; emite odor cítrico de citral como alarme",
      tipoEntrada: "Não constrói; ocupa ninhos de outras espécies",
      populacaoMedia: "500–2.000 indivíduos",
      mel: "Não produz mel; não adequada para meliponicultura",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica"]),
    statusConservacao: "LC",
  },
  {
    genero: "Lestrimelitta",
    especie: "sulina",
    nomePopular: "Iratim-do-sul",
    nomeCientifico: "Lestrimelitta sulina",
    nomesAlternativos: JSON.stringify(["Abelha-limão-do-sul"]),
    caracteristicas: JSON.stringify({
      tamanho: "6–7 mm",
      cor: "Preta",
      comportamento: "Cleptobiótica como L. limao; endêmica do sul do Brasil; menos estudada",
      tipoEntrada: "Não constrói; ocupa ninhos de outras espécies",
      populacaoMedia: "500–1.500 indivíduos",
      mel: "Não produz mel",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica", "Floresta com Araucária"]),
    statusConservacao: "LC",
  },
  {
    genero: "Mourella",
    especie: "caerulea",
    nomePopular: "Mirim-do-chão",
    nomeCientifico: "Mourella caerulea",
    nomesAlternativos: JSON.stringify(["Abelha-azul", "Mirim-azul"]),
    caracteristicas: JSON.stringify({
      tamanho: "3–4 mm",
      cor: "Preta com reflexo azul-esverdeado metálico no abdômen",
      comportamento: "Mansa; nidifica exclusivamente no solo, em ninhos de formiga ou termita",
      tipoEntrada: "Ao nível do solo, tubo de cera muito pequeno",
      populacaoMedia: "2.000–5.000 indivíduos",
      mel: "Ácido; produção muito baixa",
    }),
    ocorrenciaBiomas: JSON.stringify(["Pampa", "Mata Ciliar"]),
    statusConservacao: "LC",
  },
  {
    genero: "Paratrigona",
    especie: "subnuda",
    nomePopular: "Mirim-sem-brilho",
    nomeCientifico: "Paratrigona subnuda",
    nomesAlternativos: JSON.stringify([]),
    caracteristicas: JSON.stringify({
      tamanho: "3.5–4 mm",
      cor: "Preta fosca, sem brilho; corpo coberto de pelos finos claros",
      comportamento: "Mansa; pouco estudada em meliponicultura",
      tipoEntrada: "Orifício com betume resinoso escuro",
      populacaoMedia: "2.000–6.000 indivíduos",
      mel: "Ácido; produção baixa",
    }),
    ocorrenciaBiomas: JSON.stringify(["Mata Atlântica"]),
    statusConservacao: "LC",
  },
];

// Parâmetros padrão de avaliação
const PARAMETROS_PADRAO = [
  {
    nome: "Fluxo de entrada",
    ordem: 1,
    criterioBom: "20 ou mais abelhas por minuto entrando na colônia",
    criterioMedio: "10 a 19 abelhas por minuto",
    criterioRuim: "Menos de 10 abelhas por minuto ou ausência de voo",
  },
  {
    nome: "Potes de mel",
    ordem: 2,
    criterioBom: "15 ou mais potes cheios ou em construção",
    criterioMedio: "5 a 14 potes",
    criterioRuim: "Menos de 5 potes ou ausência",
  },
  {
    nome: "Discos de cria",
    ordem: 3,
    criterioBom: "5 ou mais discos com cria operculada",
    criterioMedio: "2 a 4 discos",
    criterioRuim: "0 a 1 disco ou cria irregular",
  },
  {
    nome: "Condição da rainha",
    ordem: 4,
    criterioBom: "Rainha presente, ativa e com postura regular",
    criterioMedio: "Rainha presente, postura irregular ou intermitente",
    criterioRuim: "Rainha ausente, zanganeira ou colônia em colapso",
  },
  {
    nome: "Sanidade",
    ordem: 5,
    criterioBom: "Ausência de pragas, fungos ou forídeos",
    criterioMedio: "Presença leve de forídeos ou outros inimigos controlada",
    criterioRuim: "Infestação grave de forídeos, fungos ou outros patógenos",
  },
];

// Seed principal
async function main() {
  console.log("Iniciando seed...");

  // 1. Espécies
  console.log(`Populando ${ESPECIES.length} espécies...`);
  for (const dados of ESPECIES) {
    const codigo = gerarCodigoKew(dados.genero, dados.especie, dados.subespecie);
    await prisma.especie.upsert({
      where: { codigo },
      update: {
        nomePopular: dados.nomePopular,
        nomesAlternativos: dados.nomesAlternativos,
        caracteristicas: dados.caracteristicas,
        ocorrenciaBiomas: dados.ocorrenciaBiomas,
        statusConservacao: dados.statusConservacao,
      },
      create: {
        codigo,
        nomePopular: dados.nomePopular,
        nomeCientifico: dados.nomeCientifico,
        genero: dados.genero,
        especie: dados.especie,
        subespecie: dados.subespecie ?? null,
        nomesAlternativos: dados.nomesAlternativos,
        caracteristicas: dados.caracteristicas,
        ocorrenciaBiomas: dados.ocorrenciaBiomas,
        statusConservacao: dados.statusConservacao,
      },
    });
    console.log(`  [OK] ${codigo} — ${dados.nomeCientifico}`);
  }

  // 2. Usuário de teste
  console.log("Criando usuário de teste...");
  const senhaHash = await bcrypt.hash("senha123", 10);
  const usuario = await prisma.user.upsert({
    where: { email: "teste@corbicula.app" },
    update: {},
    create: {
      email: "teste@corbicula.app",
      password: senhaHash,
      name: "Usuário Teste",
      meliponario: {
        create: {
          nome: "Meliponário Demonstração",
          cidade: "Porto Alegre",
          estado: "RS",
          latitude: -30.0346,
          longitude: -51.2177,
          bioma: "Mata Atlântica",
        },
      },
    },
  });
  console.log(`  [OK] ${usuario.email}`);

  // 3. Parâmetros padrão
  console.log("Criando parâmetros padrão...");
  for (const param of PARAMETROS_PADRAO) {
    await prisma.parametro.upsert({
      where: { userId_nome: { userId: usuario.id, nome: param.nome } },
      update: {},
      create: { ...param, userId: usuario.id },
    });
    console.log(`  [OK] ${param.nome}`);
  }

  // 4. Colônia de exemplo (Jataí)
  console.log("Criando colônia de exemplo...");
  const jatai = await prisma.especie.findUnique({
    where: { codigo: "TETRANGU" },
  });

  // Código segue o padrão do service (gerarCodigoColonia): [KEW]-[NNN]
  await prisma.colonia.upsert({
    where: { userId_codigo: { userId: usuario.id, codigo: "TETRANGU-001" } },
    update: {},
    create: {
      codigo: "TETRANGU-001",
      dataEntrada: new Date("2024-03-15"),
      origem: "compra",
      tipoCaixa: "INPA",
      localizacao: "Setor A, posição 1",
      status: "ativa",
      userId: usuario.id,
      especieId: jatai?.id ?? null,
    },
  });
  console.log("  [OK] TETRANGU-001 (Jataí)");

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
