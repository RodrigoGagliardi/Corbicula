// Serialização CSV conforme RFC 4180: separador vírgula, CRLF, aspas duplas
// quando necessário (vírgula, aspas, quebra de linha), aspas internas duplicadas.
// Convenções para análise em R/pandas/planilhas:
//   - datas em ISO 8601 UTC; decimal com ponto; ausência de valor = campo vazio
//   - UTF-8 sem BOM (read.csv/readr/pandas leem direto; no Excel use "Dados > De Texto/CSV")

export type LinhaCsv = Record<string, string | number | boolean | Date | null | undefined>;

function formatarCampo(valor: LinhaCsv[string]): string {
  if (valor === null || valor === undefined) return "";
  const texto = valor instanceof Date ? valor.toISOString() : String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function gerarCsv(colunas: readonly string[], linhas: LinhaCsv[]): string {
  const cabecalho = colunas.join(",");
  const corpo = linhas.map((linha) => colunas.map((c) => formatarCampo(linha[c])).join(","));
  return [cabecalho, ...corpo].join("\r\n") + "\r\n";
}
