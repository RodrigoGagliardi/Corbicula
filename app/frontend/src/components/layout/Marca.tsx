// Logo do favo (amarelo com contorno preto) + nome em font-display.
// `claro`: texto claro, para fundos escuros (sidebar verde, cabeçalho mobile).
export function Marca({ compacta = false, claro = false, grande = false }: { compacta?: boolean; claro?: boolean; grande?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <img src="/icons/favicon.svg" alt="" className={grande ? "size-12" : "size-8"} />
      <span
        className={`font-display font-bold tracking-tight ${grande ? "text-2xl" : "text-lg"} ${claro ? "text-sidebar-foreground" : "text-foreground"} ${
          compacta ? "sr-only" : ""
        }`}
      >
        Corbicula
      </span>
    </span>
  );
}
