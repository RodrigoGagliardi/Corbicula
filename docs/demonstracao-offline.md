# Demonstração do PWA offline

Roteiro para reproduzir, do zero, o sinal de sucesso do modo offline: **no campo, sem sinal, inspecionar várias colônias (uma com foto) e registrar uma colheita; ao reconectar, sem tocar em nada, tudo aparece no servidor com score, clima e foto, a fila zera e nada é duplicado.**

O funcionamento está descrito em [`estrutura-pastas.md`](estrutura-pastas.md) (nota de `services/offline/`) e a tela de acompanhamento em [`telas.md`](telas.md) (tela 35).

> **Situação (12/11/2026):** o roteiro ainda não foi executado de ponta a ponta. A lógica está coberta por testes automatizados (361 testes do frontend, incluindo o ciclo de sincronização com a API simulada), mas a comprovação no navegador real fica pendente. Ao executar, registre a data e o resultado no fim deste documento.

## Antes de começar

- **Use o build de produção.** No `npm run dev` o Service Worker fica desligado, então o app não reabre sem rede nem usa Background Sync.
- **Navegador:** Chrome ou Edge (Chromium) para o roteiro completo. No Firefox e no Safari tudo funciona igual, exceto o envio com o app fechado (passo 6), que não existe nesses navegadores.
- **Clima:** o backend busca o clima na Open-Meteo ao receber as avaliações, então a máquina do backend precisa de internet na hora de reconectar. Sem ela, as avaliações chegam sem clima e nada falha.

## 1. Preparar o ambiente

```bash
cp .env.example .env        # só no primeiro uso (na máquina do autor, POSTGRES_PORT=5433)
make up                     # postgres, backend (porta 3000) e frontend dev
make seed                   # só num banco vazio: espécies, usuário de teste e a colônia TETRANGU-001
cd app/frontend
npm install                 # só no primeiro uso: o build roda no Node da máquina, fora do container
npm run build
npm run preview -- --strictPort   # app de produção em http://localhost:4173 (falha se a porta estiver ocupada, em vez de trocar)
```

Usuário de teste do seed: `teste@corbicula.app` / `senha123`. Para mais colônias, cadastre duas ou três pelo app, online, antes do passo 2.

## 2. Carregar o app com conexão

1. Abra `http://localhost:4173`, entre com o usuário de teste e espere o dashboard.
2. Abra **Configurações → Sincronização** (`/app/configuracoes/sync`). Confira:
   - o status "Online";
   - a fila vazia;
   - a última sincronização preenchida, o que mostra que a cópia local foi carregada;
   - o armazenamento: persistente ou não. Quem decide é o navegador, por critérios próprios (app instalado, uso do site). Se aparecer "não persistente", instale o app (item 3) e confira de novo. Não é falha do app.
3. Opcional: instale o app (ícone de instalar na barra de endereço) e siga o roteiro pela janela instalada.

## 3. Ficar sem conexão

1. DevTools (F12) → aba **Network** → seletor de throttling → **Offline**. Essa simulação vale só para a aba; ela basta para os passos 3 a 5, mas não para o passo 6.
2. Recarregue a página. O app abre normalmente, com o indicador "Offline" na sidebar (desktop) ou na barra superior (mobile).

## 4. Trabalhar offline

1. **Nova avaliação** em duas ou três colônias, no fluxo rápido: Bom/Médio/Ruim, observações e ações. O score aparece como prévia.
2. Em uma delas, anexe a **foto-resumo**. O app avisa que a foto será enviada depois.
3. **Produção → Registrar colheita** de uma das colônias.
4. Confira:
   - o contador de "não enviados" no indicador de conexão;
   - as marcas "Não enviado" na lista de colônias, no histórico de avaliações e no histórico de produção;
   - em **Sincronização**: as operações na fila e a foto aguardando.
5. Opcional: feche e reabra o app (ainda offline). As pendências continuam lá.

## 5. Reconectar sem tocar em nada

1. DevTools → Network → **No throttling**.
2. Não clique em nada. O indicador mostra "Sincronizando" com o progresso, e depois o contador some.
3. Em **Sincronização**: a fila e as fotos aguardando ficam vazias, e a última sincronização é atualizada.

## 6. Background Sync (só Chromium)

O Background Sync segue a rede real do computador, não a simulação do DevTools. Este passo precisa de uma desconexão de verdade. Também precisa que o banco fique acessível sem abrir o app: abrir o app é justamente o que o teste não pode fazer.

1. Com o app aberto e online, **desligue a rede do computador** (Wi-Fi ou cabo). O backend local continua respondendo em `localhost`, mas o navegador passa a se considerar offline.
2. Salve uma avaliação. O indicador mostra "Offline" e o contador de não enviados sobe.
3. **Feche todas as janelas e abas do app**, inclusive a janela instalada.
4. **Ligue a rede de novo.** O Chrome dispara o evento `corbicula-sincronizar`, e o Service Worker envia a avaliação. Para acompanhar sem abrir o app, deixe aberto antes do passo 1, numa aba `about:blank`, o endereço `chrome://serviceworker-internals` (log do Service Worker de `localhost:4173`) ou o DevTools → Application → **Background services → Background sync**, com a gravação ligada.
5. Confira no banco (passo 7, pelo `psql`), **sem abrir o app**, que a avaliação chegou.

**Se o indicador continuar "Online" no passo 2** (no Windows, os adaptadores virtuais do Docker/WSL podem manter o navegador online mesmo sem Wi-Fi), a avaliação vai direto ao backend local e o teste não vale. Nesse caso, simule o servidor fora do ar:

1. Com o app aberto, rode `docker compose stop backend`.
2. Salve uma avaliação. Ela cai na fila e o indicador mostra "Servidor inacessível". A tentativa que falhou pede o Background Sync, mas o Chrome dispara o evento com a janela ainda aberta, e o Service Worker o devolve para depois.
3. Feche todas as janelas do app e rode `docker compose start backend`.
4. Espere a nova tentativa do Chrome (alguns minutos) e confira pelo `psql`.

Se o evento for disparado com uma janela do app ainda aberta, o Service Worker não sincroniza e devolve o evento ao navegador. O Chrome tenta de novo só depois de alguns minutos e desiste após três tentativas falhas; nesse caso o envio acontece na próxima vez que o app abrir. Se nada aparecer no passo 4, confira se todas as janelas foram mesmo fechadas e espere alguns minutos antes de concluir que falhou.

## 7. Conferir no servidor

Use o banco direto, com `make shell-db` (o `psql` dentro do container). Fora do passo 6, também serve o app online em outra janela ou a exportação CSV em **Configurações → Exportar dados**.

```sql
-- avaliações mais recentes: score do servidor, clima e procedência do clima
SELECT "dataAvaliacao", "scoreGeral", "statusGeral", temperatura, umidade, "condicaoClimatica", "climaFonte"
FROM avaliacoes ORDER BY "createdAt" DESC LIMIT 10;

-- fotos ligadas a avaliações
SELECT "avaliacaoId", url, "createdAt" FROM fotos ORDER BY "createdAt" DESC LIMIT 5;

-- colheitas mais recentes
SELECT * FROM producoes ORDER BY "createdAt" DESC LIMIT 5;

-- operações recebidas pelo /sync (cada uma uma vez só, pelo id gerado no aparelho)
SELECT tipo, operacao, resultado, "criadoNoCliente" FROM sync_queue ORDER BY "createdAt" DESC LIMIT 20;
```

- **Score:** cada avaliação feita offline tem o score calculado pelo servidor, igual à prévia.
- **Clima:** temperatura, umidade e condição preenchidas, com `climaFonte` `api_previsao` ou `api_historico`. Esse preenchimento é assíncrono e pode levar alguns segundos.
- **Foto:** aparece ligada à avaliação certa.
- **Colheita:** está na tabela de produções.
- **Nada duplicado:** o número de avaliações e colheitas é o de registros criados, mesmo que a conexão tenha caído no meio. Os envios usam o id gerado no aparelho, e um reenvio volta como `duplicado`.
- **Fila zerada:** a tela de Sincronização não mostra pendências (fora do passo 6, abra o app para conferir).

## No celular

Service Worker e Background Sync exigem contexto seguro (HTTPS ou `localhost`). Um endereço de rede local como `http://192.168.x.x:4173` não serve. Para testar no celular Android com Chrome:

1. Ligue a depuração USB no celular e conecte-o ao computador.
2. No Chrome do computador, abra `chrome://inspect/#devices` → **Port forwarding**.
3. Encaminhe a porta `4173` → `localhost:4173` e a porta `3000` → `localhost:3000`.
4. No celular, abra `http://localhost:4173` e siga o roteiro, usando o modo avião no lugar do DevTools. O encaminhamento usa o cabo USB, então o modo avião corta a rede do celular sem cortar o acesso ao computador.

## Limites conhecidos

- Exigem conexão: alertas, resumo e relatório de produção, templates de parâmetros, exportação e as fotos que já estão no servidor. Offline, essas telas mostram o último resultado ou um aviso.
- O navegador decide se o armazenamento é persistente. Sem o app instalado, o Safari/iOS pode apagar os dados locais depois de dias sem uso.
- Se a mesma colônia for editada aqui e em outro aparelho no mesmo campo, a mudança vira uma decisão na tela de Sincronização. Em campos diferentes, as duas mudanças são juntadas sozinhas.

## Registro das execuções

| Data | Navegador / aparelho | Resultado | Observações |
|------|---------------------|-----------|-------------|
| — | — | pendente | — |
