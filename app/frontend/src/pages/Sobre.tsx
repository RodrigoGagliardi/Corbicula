import { CabecalhoPagina, Cartao } from "../components/ui/Cartao";

export function Sobre() {
  return (
    <>
      <CabecalhoPagina titulo="Sobre o Corbicula" subtitulo="Software livre para meliponicultura e pesquisa." />
      <div className="space-y-4">
        <Cartao className="space-y-3 text-stone-700">
          <p>
            O <b>Corbicula</b> é uma aplicação de código aberto e gratuita para coleta e análise de dados de colônias de
            abelhas sem ferrão (Meliponini) do Rio Grande do Sul — para pesquisa acadêmica e para o manejo de
            meliponários de pequeno e médio porte.
          </p>
          <p>
            O nome vem da <i>corbícula</i>, a estrutura nas pernas traseiras das abelhas usada para transportar pólen e
            resina.
          </p>
        </Cartao>

        <Cartao className="space-y-2 text-stone-700">
          <h2 className="font-semibold text-stone-900">Metodologia</h2>
          <p>
            Cada avaliação classifica os parâmetros definidos pelo usuário como Bom (100 pontos), Médio (50) ou Ruim (0).
            O score da avaliação é a média desses pontos, arredondada:
          </p>
          <p className="rounded-xl bg-stone-50 px-3 py-2 font-mono text-sm">
            score = (n_bom × 100 + n_médio × 50 + n_ruim × 0) / n_parâmetros
          </p>
          <p>Faixas: Excelente (80–100) · Boa (60–79) · Atenção (40–59) · Crítica (0–39).</p>
          <p>
            Os códigos das espécies seguem o padrão Kew (4 letras do gênero + 4 do epíteto específico, ex.: TETRANGU
            para <i>Tetragonisca angustula</i>).
          </p>
        </Cartao>

        <Cartao className="space-y-2 text-stone-700">
          <h2 className="font-semibold text-stone-900">Dados meteorológicos</h2>
          <p>
            Temperatura, umidade e condição do tempo de cada inspeção são obtidas automaticamente da{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="text-mel-800 underline">
              Open-Meteo
            </a>
            .
          </p>
          <p className="text-sm">
            Weather data by{" "}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">
              Open-Meteo.com
            </a>
            , licenciados sob{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">
              CC BY 4.0
            </a>
            .
          </p>
        </Cartao>

        <Cartao className="space-y-2 text-stone-700">
          <h2 className="font-semibold text-stone-900">Código aberto</h2>
          <p>
            Licenciado sob a{" "}
            <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer" className="text-mel-800 underline">
              Apache License 2.0
            </a>
            . Código-fonte, documentação e contribuições em{" "}
            <a href="https://github.com/RodrigoGagliardi/Corbicula" target="_blank" rel="noreferrer" className="text-mel-800 underline">
              github.com/RodrigoGagliardi/Corbicula
            </a>
            .
          </p>
          <p className="text-sm text-stone-500">Desenvolvido por Rodrigo Gagliardi (Shirruny).</p>
        </Cartao>
      </div>
    </>
  );
}
