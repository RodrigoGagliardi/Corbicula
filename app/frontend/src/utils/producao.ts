import type { TipoProduto, Unidade } from "../types/api";

export const TIPOS_PRODUTO: TipoProduto[] = ["mel", "polen", "propolis", "cera"];

export const ROTULO_PRODUTO: Record<TipoProduto, string> = {
  mel: "Mel",
  polen: "Pólen",
  propolis: "Própolis",
  cera: "Cera",
};

// Unidade sugerida ao escolher o produto (o usuário pode trocar).
export const UNIDADE_PADRAO: Record<TipoProduto, Unidade> = {
  mel: "ml",
  polen: "g",
  propolis: "g",
  cera: "g",
};

export const COR_PRODUTO: Record<TipoProduto, string> = {
  mel: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  polen: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-300",
  propolis: "bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-300",
  cera: "bg-secondary text-secondary-foreground",
};

export function formatarQuantidade(quantidade: number, unidade: Unidade): string {
  return `${quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unidade}`;
}
