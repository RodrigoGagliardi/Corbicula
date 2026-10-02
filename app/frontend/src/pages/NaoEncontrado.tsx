import { SearchX } from "lucide-react";
import { LinkBotao } from "../components/ui/Botao";
import { EstadoVazio } from "../components/ui/Estados";

export function NaoEncontrado() {
  return (
    <EstadoVazio
      icone={<SearchX className="size-10" />}
      titulo="Página não encontrada"
      descricao="O endereço pode estar errado ou a página ainda não existe nesta versão."
      acao={<LinkBotao to="/dashboard">Ir para o início</LinkBotao>}
    />
  );
}
