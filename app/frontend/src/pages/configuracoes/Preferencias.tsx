import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Campo, Entrada } from "../../components/ui/Campo";
import { CabecalhoPagina, Cartao } from "../../components/ui/Cartao";
import { usePreferencias, type Tema } from "../../store/preferencias";
import { DIAS_INSPECAO_ATRASADA } from "../../utils/colonias";
import { VoltarConfiguracoes } from "./Configuracoes";

const TEMAS: { valor: Tema; rotulo: string; icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Claro", icone: Sun },
  { valor: "escuro", rotulo: "Escuro", icone: Moon },
  { valor: "sistema", rotulo: "Do sistema", icone: Monitor },
];

const SUGESTOES_DIAS = [7, 15, 30, 45, 60];

export function Preferencias() {
  const { tema, definirTema, diasInspecaoAtrasada, definirDiasInspecaoAtrasada } = usePreferencias();
  // Texto do campo separado do valor salvo: dá para apagar e redigitar; só números válidos são gravados.
  const [textoDias, setTextoDias] = useState(String(diasInspecaoAtrasada));

  return (
    <>
      <CabecalhoPagina
        voltar={<VoltarConfiguracoes />}
        titulo="Preferências"
        subtitulo="Ficam salvas neste aparelho e valem só para este navegador."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Cartao className="space-y-3">
          <h2 className="font-semibold text-foreground">Tema</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tema">
            {TEMAS.map(({ valor, rotulo, icone: Icone }) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={tema === valor}
                onClick={() => definirTema(valor)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  tema === valor ? "border-sidebar bg-sidebar text-sidebar-primary" : "border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icone className="size-4" aria-hidden /> {rotulo}
              </button>
            ))}
          </div>
        </Cartao>

        <Cartao className="space-y-3">
          <h2 className="font-semibold text-foreground">Frequência de inspeção</h2>
          <Campo
            rotulo="Avisar quando uma colônia ativa ficar sem inspeção por mais de"
            ajuda={`O dashboard destaca essas colônias. É uma sugestão de manejo, não uma regra científica (padrão: ${DIAS_INSPECAO_ATRASADA} dias).`}
          >
            {(id) => (
              <div className="flex items-center gap-2">
                <Entrada
                  id={id}
                  type="number"
                  min={1}
                  max={365}
                  inputMode="numeric"
                  className="w-24"
                  value={textoDias}
                  onChange={(e) => {
                    setTextoDias(e.target.value);
                    const dias = Number(e.target.value);
                    if (Number.isInteger(dias) && dias >= 1 && dias <= 365) definirDiasInspecaoAtrasada(dias);
                  }}
                  onBlur={() => setTextoDias(String(diasInspecaoAtrasada))}
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
            )}
          </Campo>
          <div className="flex flex-wrap gap-2" aria-label="Sugestões">
            {SUGESTOES_DIAS.map((dias) => (
              <button
                key={dias}
                type="button"
                aria-pressed={diasInspecaoAtrasada === dias}
                onClick={() => {
                  definirDiasInspecaoAtrasada(dias);
                  setTextoDias(String(dias));
                }}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  diasInspecaoAtrasada === dias
                    ? "border-sidebar bg-sidebar text-sidebar-primary"
                    : "border-input text-muted-foreground hover:bg-muted"
                }`}
              >
                {dias} dias
              </button>
            ))}
          </div>
        </Cartao>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Idioma, unidades, formato de data e notificações ainda não são configuráveis.
      </p>
    </>
  );
}
