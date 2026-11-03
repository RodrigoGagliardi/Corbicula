import { ClipboardCheck, CloudSun, Download, GitBranch, Hexagon, Smartphone, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { LinkBotao } from "../components/ui/Botao";
import { useAuth } from "../store/auth";

const RECURSOS: { icone: LucideIcon; titulo: string; texto: string }[] = [
  {
    icone: ClipboardCheck,
    titulo: "Avaliação em segundos",
    texto: "Classifique cada parâmetro como Bom, Médio ou Ruim. O score da colônia é calculado na hora.",
  },
  {
    icone: CloudSun,
    titulo: "Clima automático",
    texto: "Temperatura, umidade e condição do tempo vêm da Open-Meteo pela localização — nada para digitar.",
  },
  {
    icone: GitBranch,
    titulo: "Genealogia das colônias",
    texto: "Rastreie divisões, linhagens mãe → filha e doadoras de campeiras.",
  },
  {
    icone: Hexagon,
    titulo: "19 espécies do RS",
    texto: "Catálogo de meliponíneos com códigos padronizados derivados do nome científico (padrão Kew).",
  },
  {
    icone: Download,
    titulo: "Dados para pesquisa",
    texto: "Exportação em CSV e JSON com metodologia documentada, pronta para R, Python ou planilhas.",
  },
  {
    icone: Smartphone,
    titulo: "Funciona no campo",
    texto: "Aplicativo instalável no celular e no computador, pensado para o meliponário.",
  },
];

export function Landing() {
  const logado = Boolean(useAuth((s) => s.token));
  return (
    <>
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-sidebar-accent px-3 py-1 text-xs font-semibold text-sidebar-primary">
              Abelhas sem ferrão · Rio Grande do Sul
            </p>
            <h1 className="text-4xl leading-tight font-extrabold tracking-tight md:text-5xl">
              Gestão científica de meliponários, <span className="text-sidebar-primary">do campo ao dataset.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg opacity-85">
              Registre inspeções, acompanhe a saúde e a produção das colônias e leve dados limpos para a sua pesquisa. Gratuito e de
              código aberto.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {logado ? (
                <LinkBotao to="/app" variante="destaque" tamanho="lg">
                  Abrir o app
                </LinkBotao>
              ) : (
                <>
                  <LinkBotao to="/cadastro" variante="destaque" tamanho="lg">
                    Começar grátis
                  </LinkBotao>
                  <Link
                    to="/login"
                    className="inline-flex h-14 items-center rounded-xl border border-sidebar-border px-6 font-medium hover:bg-sidebar-accent"
                  >
                    Entrar
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hidden justify-center md:flex">
            <img src="/icons/favicon.svg" alt="" className="size-64 drop-shadow-xl" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
        <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">Tudo o que a colônia precisa, em um só lugar</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
          Funcionalidades pensadas para quem maneja no campo e para quem analisa os dados depois.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
            <li key={titulo} className="rounded-2xl border border-border bg-card p-5">
              <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted text-primary">
                <Icone className="size-6" aria-hidden />
              </span>
              <h3 className="font-semibold">{titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border bg-muted/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Ciência aberta, dados reprodutíveis</h2>
          <p className="max-w-2xl text-muted-foreground">
            Cálculo de score documentado, estimativas sempre rotuladas como aproximações e exportação completa dos seus dados.
          </p>
          <LinkBotao to="/sobre" variante="secundario">
            Saber mais sobre o projeto
          </LinkBotao>
        </div>
      </section>
    </>
  );
}
