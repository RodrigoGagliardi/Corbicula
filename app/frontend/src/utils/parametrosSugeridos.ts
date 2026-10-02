import type { ParametroInput } from "../types/api";

// Conjunto inicial sugerido para quem está começando — o mesmo do seed do
// backend (app/backend/prisma/seed.ts, PARAMETROS_PADRAO). O usuário pode
// editar, desativar ou criar os seus depois.
export const PARAMETROS_SUGERIDOS: ParametroInput[] = [
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
