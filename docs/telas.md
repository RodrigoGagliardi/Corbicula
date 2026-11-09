# Lista Completa de Telas - Projeto Corbicula

## 📱 Estrutura de Navegação

> Rotas públicas ficam na raiz (`/`, `/login`...). As privadas ficam sob `/app` (ex.: `/app/colonias`); o dashboard é `/app`. Telas ainda não implementadas já têm rota e mostram uma página "em construção" (`pages/telasPlanejadas.ts`). Configurações usam `/app/configuracoes/dados` e `/app/configuracoes/sync`.

### Situação de implementação (03/11/2026)

Legenda: ✅ pronta · ◐ parcial · 🚧 rota com página "em construção"

| # | Tela | Situação |
|---|------|----------|
| 1 | Landing Page | ✅ |
| 2 | Login | ✅ |
| 3 | Cadastro | ✅ |
| 4 | Recuperar Senha | ◐ só explica que o envio por e-mail ainda não existe (o backend não tem esse endpoint) |
| 5 | Sobre o Projeto | ✅ inclui a atribuição da Open-Meteo |
| 6 | Dashboard Principal | ✅ |
| 7–10 | Colônias: lista, detalhes, criar, editar | ✅ |
| 11 | Mapa de Colônias | ✅ |
| 12 | Nova Avaliação (Quick) | ✅ |
| 13 | Histórico de Avaliações | ✅ (pendências na seção da tela) |
| 14 | Detalhes da Avaliação | ✅ |
| 15 | Editar Avaliação | ✅ |
| 16–17 | Parâmetros: gerenciar, criar/editar | ✅ |
| 18 | Templates de Parâmetros | ✅ |
| 19–23 | Análises: dashboard, individual, comparativa, correlações, genealogia | 🚧 Fase 2 |
| 24–25 | Análise Comportamental, Predições (ML) | 🚧 Fase 2 / Fase 4 |
| 26–28 | Produção: registrar, histórico, relatório | ✅ |
| 29–30 | Calendário, Central de Alertas | ✅ (sem agendamentos nem avisos por e-mail/push) |
| — | Central de Configurações (`/app/configuracoes`) | ✅ |
| 31 | Perfil do Usuário | ◐ nome, e-mail, senha e exclusão da conta; sem foto, tipo de meliponicultor nem bio (o schema não tem esses campos) |
| 32 | Dados do Meliponário | ✅ |
| 33 | Preferências | ◐ tema e frequência de inspeção; sem idioma, unidades, formato de data e notificações |
| 34 | Exportar/Importar Dados | ◐ exportação CSV/JSON e backup completo; sem importar, fotos em zip, Excel e PDF |
| 35 | Sincronização Offline | 🚧 |

```
┌─────────────────────────────────────────────────────────┐
│                    PÚBLICAS (Sem Login)                  │
├─────────────────────────────────────────────────────────┤
│  1. Landing Page                                         │
│  2. Login                                                │
│  3. Cadastro                                             │
│  4. Recuperar Senha                                      │
│  5. Sobre o Projeto                                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              PRIVADAS (Requer Autenticação)              │
├─────────────────────────────────────────────────────────┤
│  DASHBOARD                                               │
│  6. Dashboard Principal                                  │
│                                                          │
│  COLÔNIAS                                                │
│  7. Lista de Colônias                                    │
│  8. Detalhes da Colônia                                  │
│  9. Criar Colônia                                        │
│  10. Editar Colônia                                      │
│  11. Mapa de Colônias                                    │
│                                                          │
│  AVALIAÇÕES                                              │
│  12. Nova Avaliação (Quick)                              │
│  13. Histórico de Avaliações                             │
│  14. Detalhes da Avaliação                               │
│  15. Editar Avaliação                                    │
│                                                          │
│  PARÂMETROS                                              │
│  16. Gerenciar Parâmetros                                │
│  17. Criar/Editar Parâmetro                              │
│  18. Templates de Parâmetros                             │
│                                                          │
│  ANÁLISES                                                │
│  19. Dashboard de Análises                               │
│  20. Análise Individual (Colônia)                        │
│  21. Análise Comparativa                                 │
│  22. Correlações                                         │
│  23. Genealogia (Árvore)                                 │
│  24. Análise Comportamental                              │
│  25. Predições (ML)                                      │
│                                                          │
│  PRODUÇÃO                                                │
│  26. Registrar Colheita                                  │
│  27. Histórico de Produção                               │
│  28. Relatório de Produção                               │
│                                                          │
│  CALENDÁRIO & ALERTAS                                    │
│  29. Calendário de Inspeções                             │
│  30. Central de Alertas                                  │
│                                                          │
│  CONFIGURAÇÕES                                           │
│  31. Perfil do Usuário                                   │
│  32. Dados do Meliponário                                │
│  33. Preferências                                        │
│  34. Exportar/Importar Dados                             │
│  35. Sincronização Offline                               │
└─────────────────────────────────────────────────────────┘
```

---

## 🔓 TELAS PÚBLICAS

### **1. Landing Page** `/`

**Objetivo:** Apresentar o projeto e captar novos usuários

**Seções:**
- Hero section com call-to-action
- Principais funcionalidades (cards visuais)
- Demonstração em vídeo
- Depoimentos de usuários
- FAQ
- Footer com links úteis

**Ações:**
- [Começar Grátis] → Cadastro
- [Entrar] → Login
- [Saber Mais] → Sobre

**Componentes:**
- Header com navegação
- Feature cards
- CTA buttons
- Footer

---

### **2. Login** `/login`

**Objetivo:** Autenticar usuário

**Campos:**
- Email
- Senha
- [x] Lembrar-me

**Ações:**
- [Entrar]
- [Esqueci minha senha] → Recuperar Senha
- [Criar conta] → Cadastro

**Features:**
- Validação em tempo real
- Mensagens de erro claras
- Loading state

---

### **3. Cadastro** `/cadastro`

**Objetivo:** Criar nova conta

**Campos:**
- Nome completo
- Email
- Senha
- Confirmar senha
- [x] Aceito os termos de uso

**Ações:**
- [Criar conta]
- [Já tenho conta] → Login

**Validações:**
- Email único
- Senha forte (mín 8 caracteres)
- Senhas coincidem

---

### **4. Recuperar Senha** `/recuperar-senha`

**Objetivo:** Resetar senha esquecida

**Fluxo:**
1. Tela 1: Inserir email → Enviar link
2. Tela 2: Confirmar envio
3. Tela 3 (por email): Nova senha + Confirmar

---

### **5. Sobre o Projeto** `/sobre`

**Objetivo:** Informações sobre o Corbicula

**Conteúdo:**
- O que é o Corbicula
- Para quem é
- Tecnologias utilizadas
- Equipe/Contribuidores
- Licença open-source
- Como contribuir

---

## 🔒 TELAS PRIVADAS

## 📊 DASHBOARD

### **6. Dashboard Principal** `/app`

**Objetivo:** Visão geral do meliponário

**Widgets:**

**Header:**
- Nome do meliponário
- Botão [Nova Avaliação Rápida]
- Indicador offline/online

**Cards de Resumo (4):**
1. **Total de Colônias**
   - Número total
   - Ativas / Inativas
   - Tendência (↑↓)

2. **Status Geral**
   - % Excelentes
   - % Boas
   - % Atenção
   - % Críticas

3. **Avaliações Recentes**
   - Total este mês
   - Média de score
   - Última avaliação

4. **Alertas Pendentes**
   - Número de alertas
   - Tipos principais
   - Ação rápida

**Gráficos:**
- **Evolução do Meliponário** (Linha)
  - Score médio últimos 6 meses
  - Por espécie

- **Distribuição por Espécie** (Pizza)
  - Quantas colônias de cada

**Listas:**
- **Colônias que Precisam Atenção** (Top 5)
  - Nome, score, dias sem inspeção
  - Ação rápida: [Avaliar]

- **Próximas Inspeções** (Calendário compacto)
  - Colônias a inspecionar esta semana

**Ações Rápidas (FAB - Floating Action Button):**
- [+] Nova Avaliação
- [+] Nova Colônia
- [+] Registrar Colheita

---

## 🐝 COLÔNIAS

### **7. Lista de Colônias** `/app/colonias`

**Objetivo:** Visualizar todas as colônias

**Toolbar:**
- Campo de busca (nome, código, espécie)
- Filtros:
  - Status (Ativa/Inativa/Morta)
  - Espécie (dropdown multi-select)
  - Score (Excelente/Boa/Atenção/Crítica)
  - Origem (Captura/Compra/Divisão)
- Ordenar por:
  - Nome (A-Z)
  - Score (Maior/Menor)
  - Última avaliação (Recente/Antiga)
  - Data de entrada
- Visualização:
  - [Cards] (padrão)
  - [Lista]
  - [Mapa]
- [+ Nova Colônia]

**Card de Colônia:**
```
┌──────────────────────────────────────┐
│ 📷 Foto    JAT-001                   │
│            Jataí                     │
│            Tetragonisca angustula    │
├──────────────────────────────────────┤
│ Score: ████████░░ 85% (Excelente)    │
│ Última avaliação: há 5 dias          │
│ Próxima sugerida: em 2 dias          │
├──────────────────────────────────────┤
│ [👁️ Ver] [✏️ Editar] [📊 Avaliar]   │
└──────────────────────────────────────┘
```

**Paginação:**
- 12/24/48 por página
- Anterior | 1 2 3 ... 10 | Próxima

**States:**
- Loading (skeleton)
- Empty state (sem colônias)
- Error state

---

### **8. Detalhes da Colônia** `/app/colonias/:id`

**Objetivo:** Ver informações completas de uma colônia

> **Status, desde quando e por quê (09/11/2026).** No cartão "Informações", abaixo do selo do status,
> aparece "desde \<data\> · \<motivo\>" (a data é a que o usuário informou como "data em que percebi";
> `outro` mostra o texto digitado). Registros anteriores a 06/11/2026 não têm esses dados e mostram só
> o selo. Logo abaixo, o **histórico de status** (pela data percebida, mais recente primeiro; empate
> pela ordem de registro): status anterior → novo, data
> percebida, motivo e "corrigido em \<data\>" quando a entrada foi corrigida depois. O histórico vem só
> da API (`GET /colonias/:id`); lida da cópia offline, a colônia mostra o "desde · motivo" e o histórico
> simplesmente não aparece.

**Layout:**

**Header:**
- Foto principal (editável)
- Código + Nome da espécie
- Badges: Status, Origem
- Ações: [✏️ Editar] [🗑️ Deletar] [📊 Avaliar Agora]

**Tabs:**

**1. Visão Geral**
- **Informações Básicas:**
  - Espécie (popular + científica)
  - Código
  - Data de entrada
  - Origem
  - Tipo de caixa
  - Localização no meliponário
  - Observações

- **Status Atual:**
  - Score atual (gauge visual)
  - Última avaliação (data + resumo)
  - Tendência (gráfico pequeno 30 dias)
  - Alertas ativos

- **Genealogia:**
  - Colônia-mãe (se houver)
  - Colônias-filhas (lista)
  - Diagrama simples

**2. Histórico de Avaliações**
- Timeline de avaliações
- Filtros: Período, Parâmetro específico
- Gráfico de evolução do score
- Lista de avaliações (cards expansíveis)

**3. Produção**
- Total produzido (lifetime)
- Média por ano/mês
- Gráfico de produção ao longo do tempo
- Últimas colheitas (lista)

**4. Fotos**
- Galeria de fotos
- Por data
- Upload de novas fotos
- Delete/Edit

**5. Análises**
- Estatísticas da colônia
- Comparação com média do meliponário
- Velocidade de postura e idade mínima da rainha, só se houver contagem de discos de cria e eventos de rainha (campos ainda não existem)
- [Ver Análise Completa] → Análise Individual

---

### **9. Criar Colônia** `/app/colonias/nova`

**Objetivo:** Cadastrar nova colônia

**Formulário (Steps):**

**Step 1: Informações Básicas**
- Código da colônia* (ex: JAT-001)
- Espécie* (autocomplete)
  - Mostra: Nome popular, científico, código
- Data de entrada*
- Status (Ativa/Inativa)

**Step 2: Origem**
- Tipo de origem* (radio)
  - [ ] Captura
  - [ ] Compra
  - [ ] Divisão
- Se Divisão:
  - Colônia-mãe (select)
  - Data da divisão
  - Método usado

**Step 3: Caixa e Localização**
- Tipo de caixa
  - [ ] INPA
  - [ ] PNN
  - [ ] Schenck
  - [ ] Tronco
  - [ ] Outro: ___
- Dimensões (opcional)
  - Altura, Largura, Profundidade
- Localização no meliponário
- Coordenadas GPS (opcional)
  - [📍 Usar localização atual]

**Step 4: Fotos e Observações**
- Upload de fotos (drag & drop)
- Observações gerais (textarea)

**Footer:**
- [← Voltar] [Cancelar] [Avançar →]
- Último step: [Salvar Colônia]

**Validações:**
- Código único por usuário
- Espécie obrigatória
- Data não pode ser futura

---

### **10. Editar Colônia** `/app/colonias/:id/editar`

**Objetivo:** Atualizar informações da colônia

**Similar ao "Criar", mas:**
- Campos pré-preenchidos
- Pode alterar status (Ativa → Inativa → Morta)
- Se marcar como Morta:
  - Data da morte
  - Causa (opcional)
- Histórico de alterações (quem, quando)

> **Implementado (09/11/2026) — mudança de status com data e motivo** (`FormColonia.tsx`, regras em
> `utils/vocabularios.ts`). Na criação (tela 9) só se escolhe o status; nada muda ali.
> - Ao trocar o status no formulário de edição aparecem, logo abaixo, **"Data em que percebi"**
>   (padrão hoje, sem data futura nem anterior à entrada da colônia ou à data do status atual, para o
>   histórico não sair de ordem) e os **chips de motivo** do status novo:
>   só os compatíveis (morta: fome, frio, pragas, intoxicação suspeita, orfandade, divisão não
>   vingou, desconhecida; inativa: abandono, roubo/perda, venda/doação, união; ativa: voltou a ser
>   ativa, correção de registro) e `outro`, que abre um campo de texto. Nada é obrigatório: um toque
>   marca, outro desmarca; sem tocar, vai a data de hoje e o motivo vazio.
> - O PATCH leva `status`, `statusDesde` e, se escolhidos, `motivoStatus`/`motivoStatusDetalhe`.
>   Com o status igual ao salvo e sem abrir a correção, nenhum desses campos vai.
> - Com o status igual, "Corrigir data ou motivo" abre os mesmos campos com os valores salvos; vai só
>   o que mudou (a data vai se o usuário mexeu no campo, mesmo deixando o valor sugerido), e o servidor corrige a última entrada do histórico em vez de criar outra (um status
>   marcado por engano se desfaz voltando o status, que gera nova entrada). O link não aparece numa
>   colônia ativa que nunca mudou de status.
> - A data vai como meio-dia local; para hoje, o menor entre agora e o meio-dia (o servidor recusa data
>   futura, e à noite "agora" já seria o dia seguinte em UTC). A comparação usa a colônia como estava
>   ao abrir o formulário: uma atualização em segundo plano não desfaz uma mudança feita em outro
>   aparelho. Erro do servidor aparece no formulário.

---

### **11. Mapa de Colônias** `/app/colonias/mapa`

**Objetivo:** Visualizar colônias geograficamente

**Features:**
- Mapa interativo (Leaflet/Google Maps)
- Pins coloridos por score
  - Verde: Excelente
  - Amarelo: Boa
  - Laranja: Atenção
  - Vermelho: Crítica
- Cluster de pins (se muitos)
- Popup ao clicar:
  - Nome da colônia
  - Espécie
  - Score atual
  - [Ver Detalhes]
- Filtros na sidebar (mesmos da lista)
- [Modo Satélite / Mapa]

**Implementado (03/11/2026)** — `pages/colonias/MapaColonias.tsx` + `components/features/MapaLeaflet.tsx`, lógica em `utils/mapa.ts` (com testes):
- Leaflet com mapa base OpenStreetMap e satélite Esri World Imagery (gratuitos, sem chave; atribuição no mapa e na tela Sobre). O Leaflet é carregado sob demanda, fora do pacote principal.
- Marcadores com as cores de status do score (verde/lima/âmbar/vermelho, tokens de `index.css`) e cinza para "sem avaliação". Grupos (Leaflet.markercluster) assumem a cor do **pior** status que contêm; colônias no mesmo ponto se abrem em leque no zoom máximo.
- Meliponário como hexágono amarelo, maior que os marcadores (aparece como moldura quando colônias estão no mesmo ponto).
- Clique abre um painel lateral (abaixo do mapa no mobile) em vez de popup: código, espécie, score, última inspeção, [Ver detalhes] e [Avaliar].
- Filtros na URL: status da colônia (padrão ativas), espécie, score da última avaliação; busca de texto como na lista. `?colonia=<id>` abre o mapa com a colônia selecionada (link "Ver no mapa" no detalhe).
- Colônias sem coordenadas **não** são posicionadas no meliponário (seria um dado espacial inventado): aparecem em "Fora do mapa" com link para adicionar as coordenadas.
- Offline: os blocos do mapa não são guardados (política de uso do OSM); sem conexão, os pontos aparecem sobre fundo vazio com um aviso.

---

## 📋 AVALIAÇÕES

### **12. Nova Avaliação (Quick)** `/app/avaliacoes/nova`

**Objetivo:** Avaliar colônia rapidamente (mobile-first)

> **Contexto opcional (09/11/2026).** O fluxo rápido não muda: classificar e salvar continua com o
> mesmo número de toques, e sem tocar nos campos abaixo o payload é o de antes (sem as chaves novas).
> No cartão "Finalizar":
> - **Motivo da inspeção** em chips de um toque: Rotina, Algo chamou atenção, Retorno após uma ação e
>   Outro (abre um campo de texto). Tocar de novo desmarca.
> - Em cada **ação tomada** marcada aparecem dois chips: Preventiva (calendário, estação, rotina) ou
>   Resposta a um problema observado. Vai `motivosAcoes` só com as ações marcadas que receberam
>   motivo; desmarcar a ação descarta o motivo dela.
> Os códigos e rótulos vêm de `utils/vocabularios.ts` (os mesmos do backend e de `docs/exportacao.md`).
> Motivos nunca entram no score.

**Fluxo:**

**Step 1: Selecionar Colônia**
- Lista de colônias
- Busca rápida
- Mostra: última avaliação, dias desde

**Step 2: Dados da Inspeção**
- Data/hora (auto-preenchido, editável)
- Temperatura (°C)
- Umidade (%)
- Clima (radio):
  - [ ] ☀️ Ensolarado
  - [ ] ⛅ Parcialmente nublado
  - [ ] ☁️ Nublado
  - [ ] 🌧️ Chuvoso

**Step 3: Avaliação dos Parâmetros**

Para cada parâmetro configurado:

```
┌──────────────────────────────────────┐
│ População e Atividade Externa        │
├──────────────────────────────────────┤
│ [  BOM  ] [ MÉDIO ] [ RUIM ]         │
│                                      │
│ Critério:                            │
│ • Bom: 20+ abelhas/minuto            │
│ • Médio: 10-20 abelhas/minuto        │
│ • Ruim: Menos de 10 abelhas/minuto   │
├──────────────────────────────────────┤
│ 📝 Observações (opcional)            │
│ [                                  ] │
│                                      │
│ 📷 Foto (opcional)                   │
│ [Adicionar foto]                     │
└──────────────────────────────────────┘
```

**Step 4: Observações Gerais**
- Campo de texto grande
- Sugestões rápidas (chips):
  - "Colônia forte"
  - "Muitas forídeos"
  - "Rainha ativa"
  - "Precisa limpeza"

**Step 5: Ações Tomadas**
- Checkboxes:
  - [ ] Alimentação artificial
  - [ ] Limpeza realizada
  - [ ] Divisão executada
  - [ ] Tratamento aplicado
  - [ ] Troca de caixa
  - [ ] Nenhuma intervenção

**Step 6: Resumo**
- Score calculado (grande, visual)
- Status: Excelente/Boa/Atenção/Crítica
- Revisão rápida
- [Salvar Avaliação]

**Features:**
- Progresso visual (barra)
- Salvar como rascunho
- Modo offline (salva local, sincroniza depois)
- Swipe para próximo parâmetro (mobile)

---

### **13. Histórico de Avaliações** `/app/avaliacoes`

**Objetivo:** Ver todas as avaliações

> **Implementada (15/10/2026).** Usa `GET /avaliacoes`. Filtros na URL: período (mesmos atalhos da
> produção), status, colônia (uma por vez) e parâmetro + classificação recebida ("Fluxo de entrada
> avaliado como Ruim"). Resumo do filtro (nº de inspeções, score médio simples, distribuição por
> status), linha do tempo por mês e exportação CSV/JSON (colônia, status e período; o filtro por
> parâmetro vale só para a lista). O gráfico mostra a evolução de **uma** colônia escolhida no filtro,
> com todas as inspeções dela no período. Pendente: multi-seleção de colônias, período
> personalizado, miniatura da foto e linhas de várias colônias no gráfico (fica para a Análise
> Comparativa).

**Filtros:**
- Colônia (multi-select)
- Período (última semana, mês, 3 meses, custom)
- Status (Excelente/Boa/Atenção/Crítica)
- Parâmetro específico

**Visualizações:**

**Timeline (padrão):**
```
Dezembro 2024
├─ 15/12 - JAT-001 (Jataí) - Score: 85% ✅
├─ 14/12 - MAND-003 (Mandaçaia) - Score: 62% ⚠️
└─ 12/12 - JAT-001 (Jataí) - Score: 88% ✅

Novembro 2024
├─ 30/11 - TUB-002 (Tubuna) - Score: 45% ⚠️
...
```

**Card de Avaliação:**
- Data/hora
- Colônia (nome + foto pequena)
- Score (badge colorido)
- Clima, temperatura
- [Ver Detalhes]
- [Editar] (se < 7 dias)

**Gráfico:**
- Evolução do score ao longo do tempo
- Linhas por colônia (filtráveis)

---

### **14. Detalhes da Avaliação** `/app/colonias/:coloniaId/avaliacoes/:id`

**Objetivo:** Ver avaliação completa

> **Contexto (09/11/2026).** O cartão de observações mostra o **motivo da inspeção** (com o texto de
> `outro`) e, ao lado de cada ação tomada, o motivo dela, quando registrados. O cartão do clima mostra
> a **procedência**: "API (previsão)", "API (histórico ERA5)" ou "Digitado" (algum campo foi informado ou
> alterado pelo usuário; os outros podem ter vindo da API). Avaliações anteriores a 06/11/2026 não têm
> procedência e não mostram a linha. O crédito à Open-Meteo aparece sempre que houver algum valor de
> clima (temperatura, umidade ou condição); códigos desconhecidos aparecem como vieram. O protocolo vigente (`protocoloId`) não aparece nesta tela; vai na exportação.

**Seções:**

**Header:**
- Data/hora
- Colônia
- Score grande (visual)
- Status
- [✏️ Editar] [🗑️ Deletar]

**Dados da Inspeção:**
- Duração
- Temperatura, umidade, clima
- Quem avaliou (futuro: multiusuário)

**Parâmetros Avaliados:**
- Tabela/Cards:
  - Nome do parâmetro
  - Classificação (Bom/Médio/Ruim)
  - Observações
  - Fotos

**Observações Gerais:**
- Texto completo

**Ações Tomadas:**
- Lista de checkboxes marcados

**Comparação:**
- Score desta vs avaliação anterior
- Diferença (↑↓)
- Parâmetros que melhoraram/pioraram

**Fotos:**
- Galeria completa

---

### **15. Editar Avaliação** `/app/colonias/:coloniaId/avaliacoes/:id/editar`

**Objetivo:** Corrigir avaliação

> **Implementada (15/10/2026)** reaproveitando o formulário da Nova Avaliação, pré-preenchido. O
> prazo de 7 dias conta a partir do registro (`createdAt`), igual ao servidor. Parâmetros
> desativados depois da inspeção continuam editáveis nela. O score é recalculado; o clima registrado
> é mantido; fotos são geridas no detalhe. Ainda **não** há histórico de edições.
> Desde 09/11/2026 os chips de motivo da inspeção e de cada ação vêm pré-preenchidos com o que foi
> salvo; um motivo desmarcado vai como `null` (apagado). O protocolo da avaliação só muda se o
> conjunto de parâmetros avaliados mudar (regra do servidor).

**Regras:**
- Só pode editar avaliações dos últimos 7 dias
- Mantém histórico de edições
- Similar ao "Nova Avaliação" mas pré-preenchido

---

## ⚙️ PARÂMETROS

### **16. Gerenciar Parâmetros** `/app/parametros`

**Objetivo:** Configurar critérios de avaliação

**Lista de Parâmetros:**

```
┌────────────────────────────────────────┐
│ 1. População e Atividade Externa       │
│    ✓ Ativo   [↑] [↓] [✏️] [🗑️]          │
│    Bom: 20+ abelhas/minuto             │
│    Médio: 10-20 abelhas/minuto         │
│    Ruim: Menos de 10 abelhas/minuto    │
├────────────────────────────────────────┤
│ 2. Potes de Mel                        │
│    ✓ Ativo   [↑] [↓] [✏️] [🗑️]          │
│    ...                                 │
└────────────────────────────────────────┘
```

**Ações:**
- [+ Novo Parâmetro]
- [📥 Importar Template]
- [📤 Exportar Meus Parâmetros]
- Reordenar (drag & drop ou setas)
- Ativar/Desativar
- Editar
- Deletar (só se nunca usado)

**Validações:**
- Mínimo 1 parâmetro ativo
- Nome único

---

### **17. Criar/Editar Parâmetro** `/app/parametros/novo` ou `/app/parametros/:id/editar`

**Objetivo:** Definir critério personalizado

> **Protocolo (09/11/2026).** Cada avaliação guarda, no servidor, o protocolo vigente (parâmetros e
> texto dos critérios aplicados). Editar um critério aqui (ou na tela 16) **não** muda o protocolo das
> avaliações já registradas; a próxima avaliação recebe outro. As telas não pedem nada a mais por
> isso: o protocolo aparece na exportação (`docs/exportacao.md`).

**Formulário:**

**Informações Básicas:**
- Nome do parâmetro*
  - Ex: "População e Atividade Externa"
- Ordem de exibição
  - Número (1, 2, 3...)

**Critérios:**
- **Critério BOM*** (textarea)
  - Descrição clara do que é considerado bom
  - Ex: "20+ abelhas/minuto na entrada"

- **Critério MÉDIO*** (textarea)
  - Ex: "10-20 abelhas/minuto"

- **Critério RUIM*** (textarea)
  - Ex: "Menos de 10 abelhas/minuto"

**Opções:**
- [ ] Ativo
- [ ] Permite observações
- [ ] Permite fotos
- [ ] Permite valor numérico

**Preview:**
- Mostra como vai aparecer na avaliação

**Ações:**
- [Cancelar] [Salvar]

---

### **18. Templates de Parâmetros** `/app/parametros/templates`

**Objetivo:** Usar conjuntos pré-definidos

**Templates Disponíveis:**

1. **Iniciante (5 parâmetros)**
   - População, Mel, Cria, Rainha, Sanidade
   - [Usar Este Template]

2. **Intermediário (8 parâmetros)**
   - + Pólen, Estrutura, Reservas
   - [Usar Este Template]

3. **Avançado (12 parâmetros)**
   - + Comportamento defensivo, Produção de machos, etc
   - [Usar Este Template]

4. **Científico (15 parâmetros)**
   - Todos os anteriores + métricas detalhadas
   - [Usar Este Template]

**Importar Template:**
- Substitui parâmetros atuais ou mescla
- Confirmação antes de aplicar

**Implementado (03/11/2026)** — `pages/parametros/TemplatesParametros.tsx`; templates em `app/backend/src/modules/parametros/parametros.templates.ts` (fonte única, também usada pelo seed); regras em `parametros.conjuntos.ts`.
- Templates cumulativos e versionados (`versao`): Iniciante (5), Intermediário (8: + potes de pólen, estrutura do ninho, reservas pelo peso da caixa), Avançado (12: + comportamento defensivo, presença de machos, coleta de resina, higiene), Científico (15: + postura recente, ocupação da caixa, condições internas). Critérios de referência gerais, qualitativos sempre que possível — a tela avisa para ajustar à espécie.
- Aplicar abre uma confirmação com o modo (**mesclar** / **substituir**) e a prévia do que será criado, reativado, desativado e mantido. Tudo acontece numa transação no servidor.
- Regras de integridade: parâmetro que já existe (mesmo nome, sem diferenciar maiúsculas/acentos) **nunca tem os critérios sobrescritos** — eles podem estar em avaliações antigas; a prévia avisa quando os critérios diferem. "Substituir" **desativa** (não exclui) os que ficam de fora. Sempre sobra pelo menos 1 ativo.
- Exportar meus parâmetros (JSON versionado `corbicula-parametros` v1, com critérios por espécie pelo código Kew) e importar de arquivo com as mesmas regras — para padronizar a coleta entre pesquisadores. Atalhos também na tela 16 (Gerenciar Parâmetros), cujo estado vazio aplica o template Iniciante.

---

## 📊 ANÁLISES

### **19. Dashboard de Análises** `/app/analises`

**Objetivo:** Hub de análises científicas

**Cards de Acesso Rápido:**

1. **Análise Individual**
   - Selecionar colônia
   - [Analisar]

2. **Análise Comparativa**
   - Selecionar 2-10 colônias
   - [Comparar]

3. **Correlações**
   - Entre parâmetros
   - [Calcular]

4. **Genealogia**
   - Árvore completa
   - [Ver Árvore]

5. **Comportamental**
   - Padrões de inspeção e sazonalidade
   - [Analisar]

6. **Predições (ML)**
   - Machine Learning
   - [Ver Predições]

**Análises Recentes:**
- Últimas análises executadas
- [Ver Novamente]

---

### **20. Análise Individual (Colônia)** `/app/analises/colonia/:id`

**Objetivo:** Análise profunda de uma colônia

**Seções:**

**1. Resumo Estatístico**
- Score médio (30d, 90d, 1 ano, lifetime)
- Desvio padrão (variabilidade)
- Tendência (↑ crescente, → estável, ↓ decrescente)
- Melhor e pior score registrado

**2. Evolução Temporal**
- Gráfico de linha (score ao longo do tempo)
- Médias móveis (7d, 30d)
- Eventos marcados (divisões, tratamentos)

**3. Análise de Parâmetros**
- Tabela com estatísticas por parâmetro:
  - Quantas vezes foi Bom/Médio/Ruim
  - % de cada classificação
  - Tendência

**4. Sazonalidade**
- Padrões mensais/sazonais
- Melhor e pior época do ano
- Gráfico por mês

**5. Produtividade**
- Colheitas da colônia por estação (ml e g separados)
- Velocidade de postura estimada e idade **mínima** conhecida da rainha, só quando houver contagem de discos de cria e eventos de rainha (campos ainda não existem). Sempre como aproximação
- Projeções: exploratórias, com o n visível

**6. Comparações**
- Vs média do meliponário
- Vs média da espécie
- Ranking (posição entre todas)

**Exportar:**
- [📄 PDF] [📊 Excel] [📋 JSON]

---

### **21. Análise Comparativa** `/app/analises/comparativa`

**Objetivo:** Comparar múltiplas colônias

**Seleção:**
- Selecionar 2-10 colônias
- Filtro por espécie, status
- [Comparar]

**Resultados:**

**1. Gráfico Lado a Lado**
- Score ao longo do tempo
- Linhas coloridas por colônia

**2. Tabela Comparativa**
```
| Colônia  | Score Médio | Tendência | Melhor Parâmetro | Pior Parâmetro |
|----------|-------------|-----------|------------------|----------------|
| JAT-001  | 85%         | ↑         | População        | Pólen          |
| JAT-002  | 78%         | →         | Mel              | Sanidade       |
| MAND-001 | 92%         | ↑         | Cria             | -              |
```

**3. Radar Chart**
- Comparação visual de parâmetros
- Uma linha por colônia

**4. Estatísticas**
- Melhor colônia geral
- Mais consistente (menor variação)
- Maior evolução (maior crescimento)

**5. Recomendações**
- "JAT-001 está melhorando, continue assim"
- "MAND-001 poderia ser boa matriz para divisão" (indicação com incerteza: mostrar quantas inspeções e filhas a sustentam)

---

### **22. Correlações** `/app/analises/correlacoes`

**Objetivo:** Encontrar relações entre parâmetros

> Parâmetros são ordinais (Bom/Médio/Ruim): usar correlação de postos (Spearman) e tratar inspeções da mesma colônia como dependentes. Parâmetro × score não entra (é circular). O n fica sempre visível. Ver as regras de análise no módulo 5 de `escopo.md`.

**Configuração:**
- Selecionar colônias (ou todas)
- Selecionar parâmetros (mín 2, máx 10)
- Período (últimos 3 meses, 6 meses, 1 ano, todos)
- [Calcular]

**Resultados:**

**1. Matriz de Correlação**
```
            Mel    Cria   População   Pólen
Mel         1.00   0.85   0.72       0.65
Cria        0.85   1.00   0.78       0.71
População   0.72   0.78   1.00       0.55
Pólen       0.65   0.71   0.55       1.00
```

- Cores: Verde (forte positiva), Amarelo (moderada), Vermelho (negativa)

**2. Gráficos de Dispersão**
- Para correlações significativas
- Linha de tendência
- R² (coeficiente de determinação)

**3. Interpretações**
- "Forte correlação positiva entre Mel e Cria (r=0.85, p<0.05)"
- "Quando Mel está BOM, Cria tende a estar BOM em 87% dos casos"

**4. Significância Estatística**
- Testes estatísticos (p-value)
- Intervalo de confiança

---

### **23. Genealogia (Árvore)** `/app/analises/genealogia`

**Objetivo:** Visualizar a linhagem materna das colônias (o pai é desconhecido; não é genética)

**Visualização:**

```
        MAND-001 (Matriz)
            │
    ┌───────┼───────┐
    │       │       │
MAND-002 MAND-003 MAND-004
(Filha 1)(Filha 2)(Filha 3)
    │
MAND-005
(Neta)
```

**Interatividade:**
- Clique em nó: Mostra detalhes
- Expandir/Colapsar ramos
- Cores por score:
  - Verde: Excelente
  - Amarelo: Boa
  - Laranja: Atenção
  - Vermelho: Crítica
  - Cinza: Inativa
  - Preto: Morta

**Filtros:**
- Espécie
- Geração (mães, filhas, netas...)
- Status

**Estatísticas:**
- Taxa de sucesso de divisões (%): exige a data e o motivo da mudança de status da colônia, que ainda não existem
- Melhor matriz (mais filhas bem-sucedidas)
- Média de score por linhagem

**Recomendações:**
- "MAND-001 é excelente matriz: 5 filhas, todas ativas, score médio 88%"
- "Evitar dividir TUB-003: 3 tentativas, nenhuma bem-sucedida"

---

### **24. Análise Comportamental** `/app/analises/comportamental`

**Objetivo:** Padrões de inspeção e sazonalidade

> O horário registrado é o da inspeção, não o da atividade das abelhas. Inspeções se concentram em manhãs amenas, então qualquer gráfico por hora mede o meliponicultor. Atividade real por horário exige contagem de campeiras em horários fixos (campo ainda não existe).

**Análises:**

**1. Quando você inspeciona**
- Gráfico: inspeções por hora do dia e por dia da semana
- Rótulo explícito: "horário das inspeções"
- Útil para ver lacunas (estações ou horários nunca observados)

**2. Aderência à frequência**
- Intervalo entre inspeções × frequência sugerida da colônia

**3. Influência Climática**
- Clima dos dias **antes** da inspeção × score, sempre ajustado pela estação. Sem o ajuste, o inverno aparece como efeito do clima
- Num meliponário só, o efeito costuma ser pequeno demais para detectar: mostrar o n e tratar como exploratório
- Relato de evento extremo (geada, onda de calor) com as colônias afetadas

**4. Sazonalidade**
- Meses de maior/menor atividade
- Períodos de diapausa
- Melhor época para divisões

**5. Temperatura e Umidade**
- Relação com o score, ajustada pela estação e com o n visível
- "Faixa ideal" só com vários meliponários ou muitos anos de dados

---

### **25. Predições (ML)** `/app/analises/predicoes`

**Objetivo:** Machine Learning para previsões

> ⚠️ Fase 4. Depende de base histórica grande e limpa — entregar como estimativa, não número exato.

**Modelos Disponíveis:**

**1. Predição de Enxameação**
- Probabilidade de enxamear nos próximos 30 dias
- Baseada em população, discos de cria e histórico
- Indicador de confiança da predição

**2. Detecção de Anomalias**
- Identifica quedas súbitas ou padrões atípicos
- Alerta precoce de possíveis problemas
- Compara com o comportamento histórico da colônia

**3. Melhor Momento para Divisão**
- Sugere janela ideal com base em força e sazonalidade
- Considera taxa de sucesso histórica de divisões da matriz

**Interface:**
- Seleção de colônia e modelo
- Resultado com nível de confiança visível
- Aviso claro de que é estimativa, melhora com mais dados

---

> A partir daqui as telas estão em versão **provisória** — detalhamento inicial, sujeito a revisão conforme o projeto evolui.

## 🍯 PRODUÇÃO

### **26. Registrar Colheita** `/app/producao/nova`

**Objetivo:** Registrar uma colheita de mel, pólen ou própolis

**Campos:**
- Colônia* (select)
- Data da colheita* (auto-preenchida, editável)
- Tipo de produto* (mel / pólen / própolis)
- Volume (ml) ou peso (g)*
- Características (opcional): cor, aroma, sabor
- Observações (opcional)
- Foto (opcional)

**Comportamento:**
- Momento de alto engajamento — o usuário quer registrar o resultado
- Baixo atrito, evento pontual
- Ao salvar, atualiza a produção acumulada da colônia

---

### **27. Histórico de Produção** `/app/producao`

**Objetivo:** Ver todas as colheitas registradas

**Filtros:** colônia, tipo de produto, período

**Visualizações:**
- Lista cronológica de colheitas
- Gráfico de produção ao longo do tempo
- Totais por colônia e por espécie

**Cards de resumo:**
- Produção total (lifetime)
- Média por colônia
- Melhor produtora

---

### **28. Relatório de Produção** `/app/producao/relatorio`

**Objetivo:** Consolidar dados de produção para análise ou exportação

**Conteúdo:**
- Produção por período (mês, safra, ano)
- Comparação entre colônias e espécies
- Ranking de produtividade
- Gráficos consolidados

**Exportar:** PDF, Excel/CSV

---

## 📅 CALENDÁRIO & ALERTAS

### **29. Calendário de Inspeções** `/app/calendario`

**Objetivo:** Planejar e acompanhar inspeções

**Visualização:**
- Calendário mensal
- Inspeções realizadas (marcadas)
- Próximas inspeções sugeridas
- Colheitas e divisões registradas

**Interações:**
- Clicar num dia → ver/agendar atividades
- Lembretes personalizáveis por colônia
- Frequência de inspeção configurável (quinzenal/mensal)

---

### **30. Central de Alertas** `/app/alertas`

**Objetivo:** Reunir avisos que exigem atenção

**Tipos de alerta:**
- Colônia não inspecionada há X dias
- Colônia em status crítico
- Queda súbita de score
- Infestação detectada em avaliação
- Reservas alimentares baixas
- Rainha ausente

**Interações:**
- Marcar como resolvido
- Ir direto para a colônia/ação relacionada
- Configurar quais alertas receber e como (in-app, e-mail, push)

**Nota:** funcionalidade de alta efetividade — traz o usuário de volta em vez de exigir input.

**Implementado (04/11/2026)** — Calendário: `pages/Calendario.tsx` + `utils/calendario.ts` (com testes). Alertas: `pages/Alertas.tsx` + módulo `app/backend/src/modules/alertas/`.
- **Calendário:** grade mensal (domingo a sábado) com inspeções (cor do score), colheitas, divisões e inspeções sugeridas; clicar num dia abre o painel com links (inspeção, colheita, colônia, "Avaliar"). Mês e dia na URL. Sugestão = última inspeção (ou a entrada, se nunca avaliada) + frequência da colônia (`frequenciaInspecaoDias`, campo opcional no cadastro) ou a preferência geral; vencidas aparecem hoje como atrasadas. Datas agrupadas pelo dia local. O detalhe da colônia mostra a próxima inspeção sugerida. **Não implementado:** agendar atividades num dia e lembretes (exigem input manual — decisão do autor, 04/11/2026).
- **Alertas** (`GET /alertas`, calculados das inspeções — nada é digitado): `nunca_avaliada` (1ª inspeção atrasada desde a entrada), `sem_inspecao` (alta se passar do dobro da frequência), `score_baixo` (Crítica = alta, Atenção = média, lista os parâmetros Ruim), `queda_score` (≥ 20 pontos em relação à inspeção anterior) e `parametro_ruim` (parâmetro Ruim num score Boa/Excelente — cobre "rainha ausente", "infestação" e "reservas baixas" sem depender do nome do parâmetro). Só a última inspeção de cada colônia ativa conta.
- Marcar como resolvido / reabrir (`POST`/`DELETE /alertas/resolvidos`, tabela `alertas_resolvidos`, vale em todos os aparelhos). A chave identifica a ocorrência (ex.: `score_baixo:<avaliacaoId>`): o mesmo problema numa inspeção nova gera alerta novo. Filtro por tipo e "mostrar resolvidos" na URL; contador de abertos na sidebar e no "Mais" do mobile. A tela mostra os critérios usados.
- **Não implementado:** escolher quais alertas receber e avisos por e-mail/push (dependem do PWA offline e de um serviço de e-mail).

---

## ⚙️ CONFIGURAÇÕES

### **31. Perfil do Usuário** `/app/configuracoes/perfil`

**Campos:**
- Nome, e-mail
- Foto de perfil
- Tipo de meliponicultor (hobby / comercial / pesquisador)
- Bio
- Alterar senha

---

### **32. Dados do Meliponário** `/app/configuracoes/meliponario`

**Campos:**
- Nome do meliponário
- Endereço completo
- Coordenadas GPS (usadas como fallback para clima automático)
- Bioma (Mata Atlântica, Pampa, etc.)
- Área total

**Nota:** as coordenadas aqui servem de fallback quando a colônia não tem lat/long própria — importante para o preenchimento automático de clima.

---

### **33. Preferências** `/app/configuracoes/preferencias`

**Opções:**
- Idioma (PT-BR / EN / ES)
- Tema (claro / escuro / automático)
- Unidades (ml/litros, °C/°F)
- Formato de data
- Frequência de inspeção sugerida
- Notificações (ativar/desativar por tipo)

---

### **34. Exportar/Importar Dados** `/app/configuracoes/dados`

**Objetivo:** Portabilidade e backup (relevante para LGPD e uso científico)

**Exportar:**
- Todas as colônias
- Avaliações (período específico)
- Fotos (zip)
- Backup completo (JSON)
- Formatos: CSV, Excel, JSON, PDF

**Importar:**
- Restaurar backup
- Importar parâmetros (templates)

**Excluir:**
- Opção de apagar todos os dados (direito do usuário)

---

### **35. Sincronização Offline** `/app/configuracoes/sync`

**Objetivo:** Controlar e monitorar a sincronização

**Conteúdo:**
- Status atual (online / offline / sincronizando)
- Fila de pendências (o que ainda não subiu)
- Botão "Sincronizar agora"
- Última sincronização bem-sucedida
- Espaço usado no armazenamento local
- Resolver conflitos (quando houver edições concorrentes)

---

## 📝 Notas finais

- Telas 1–24 estão detalhadas em nível de implementação.
- Telas 25–35 estão em nível **provisório** — a intenção, os campos principais e as rotas estão definidos, mas o detalhamento fino (validações, edge cases, microinterações) será refinado quando cada uma entrar em desenvolvimento.
- A ordem de construção segue o roadmap: dashboard, colônias, avaliações e parâmetros primeiro (MVP); análises, produção, calendário e configurações avançadas depois. A produção acabou entrando antes, porque o backend já estava pronto. A situação atual de cada tela está na tabela do início deste documento.
- Qualquer tela pode ser repensada — este documento é um guia, não um contrato.