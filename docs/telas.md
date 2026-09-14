# Lista Completa de Telas - Projeto Corbicula

## 📱 Estrutura de Navegação

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

### **6. Dashboard Principal** `/dashboard`

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

### **7. Lista de Colônias** `/colonias`

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

### **8. Detalhes da Colônia** `/colonias/:id`

**Objetivo:** Ver informações completas de uma colônia

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
- Velocidade de postura estimada
- Idade estimada da rainha
- [Ver Análise Completa] → Análise Individual

---

### **9. Criar Colônia** `/colonias/nova`

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

### **10. Editar Colônia** `/colonias/:id/editar`

**Objetivo:** Atualizar informações da colônia

**Similar ao "Criar", mas:**
- Campos pré-preenchidos
- Pode alterar status (Ativa → Inativa → Morta)
- Se marcar como Morta:
  - Data da morte
  - Causa (opcional)
- Histórico de alterações (quem, quando)

---

### **11. Mapa de Colônias** `/colonias/mapa`

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

---

## 📋 AVALIAÇÕES

### **12. Nova Avaliação (Quick)** `/avaliacoes/nova`

**Objetivo:** Avaliar colônia rapidamente (mobile-first)

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

### **13. Histórico de Avaliações** `/avaliacoes`

**Objetivo:** Ver todas as avaliações

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

### **14. Detalhes da Avaliação** `/avaliacoes/:id`

**Objetivo:** Ver avaliação completa

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

### **15. Editar Avaliação** `/avaliacoes/:id/editar`

**Objetivo:** Corrigir avaliação

**Regras:**
- Só pode editar avaliações dos últimos 7 dias
- Mantém histórico de edições
- Similar ao "Nova Avaliação" mas pré-preenchido

---

## ⚙️ PARÂMETROS

### **16. Gerenciar Parâmetros** `/parametros`

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

### **17. Criar/Editar Parâmetro** `/parametros/novo` ou `/parametros/:id/editar`

**Objetivo:** Definir critério personalizado

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

### **18. Templates de Parâmetros** `/parametros/templates`

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

---

## 📊 ANÁLISES

### **19. Dashboard de Análises** `/analises`

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
   - Padrões de atividade
   - [Analisar]

6. **Predições (ML)**
   - Machine Learning
   - [Ver Predições]

**Análises Recentes:**
- Últimas análises executadas
- [Ver Novamente]

---

### **20. Análise Individual (Colônia)** `/analises/colonia/:id`

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
- Velocidade de postura estimada
  - Baseada em discos de cria
- Idade estimada da rainha
  - Baseada em declínio de produtividade
- Projeções

**6. Comparações**
- Vs média do meliponário
- Vs média da espécie
- Ranking (posição entre todas)

**Exportar:**
- [📄 PDF] [📊 Excel] [📋 JSON]

---

### **21. Análise Comparativa** `/analises/comparativa`

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
- "MAND-001 poderia ser boa matriz para divisão"

---

### **22. Correlações** `/analises/correlacoes`

**Objetivo:** Encontrar relações entre parâmetros

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

### **23. Genealogia (Árvore)** `/analises/genealogia`

**Objetivo:** Visualizar linhagens

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
- Taxa de sucesso de divisões (%)
- Melhor matriz (mais filhas bem-sucedidas)
- Média de score por linhagem

**Recomendações:**
- "MAND-001 é excelente matriz: 5 filhas, todas ativas, score médio 88%"
- "Evitar dividir TUB-003: 3 tentativas, nenhuma bem-sucedida"

---

### **24. Análise Comportamental** `/analises/comportamental`

**Objetivo:** Padrões de atividade

**Análises:**

**1. Horários de Atividade**
- Se usuário registrou horário nas avaliações
- Gráfico: Atividade por hora do dia
- Picos e vales
- Por espécie

**2. Dias da Semana**
- Qual dia há mais atividade
- Útil para planejar inspeções

**3. Influência Climática**
- Correlação entre clima e score
- "Em dias ensolarados, score médio é 12% maior"
- Gráfico: Score por condição climática

**4. Sazonalidade**
- Meses de maior/menor atividade
- Períodos de diapausa
- Melhor época para divisões

**5. Temperatura e Umidade**
- Correlação com performance
- Faixa ideal identificada
- Alertas se fora da faixa

---

### **25. Predições (ML)** `/analises/predicoes`

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

### **26. Registrar Colheita** `/producao/nova`

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

### **27. Histórico de Produção** `/producao`

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

### **28. Relatório de Produção** `/producao/relatorio`

**Objetivo:** Consolidar dados de produção para análise ou exportação

**Conteúdo:**
- Produção por período (mês, safra, ano)
- Comparação entre colônias e espécies
- Ranking de produtividade
- Gráficos consolidados

**Exportar:** PDF, Excel/CSV

---

## 📅 CALENDÁRIO & ALERTAS

### **29. Calendário de Inspeções** `/calendario`

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

### **30. Central de Alertas** `/alertas`

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

---

## ⚙️ CONFIGURAÇÕES

### **31. Perfil do Usuário** `/configuracoes/perfil`

**Campos:**
- Nome, e-mail
- Foto de perfil
- Tipo de meliponicultor (hobby / comercial / pesquisador)
- Bio
- Alterar senha

---

### **32. Dados do Meliponário** `/configuracoes/meliponario`

**Campos:**
- Nome do meliponário
- Endereço completo
- Coordenadas GPS (usadas como fallback para clima automático)
- Bioma (Mata Atlântica, Pampa, etc.)
- Área total

**Nota:** as coordenadas aqui servem de fallback quando a colônia não tem lat/long própria — importante para o preenchimento automático de clima.

---

### **33. Preferências** `/configuracoes/preferencias`

**Opções:**
- Idioma (PT-BR / EN / ES)
- Tema (claro / escuro / automático)
- Unidades (ml/litros, °C/°F)
- Formato de data
- Frequência de inspeção sugerida
- Notificações (ativar/desativar por tipo)

---

### **34. Exportar/Importar Dados** `/configuracoes/dados`

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

### **35. Sincronização Offline** `/configuracoes/sync`

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
- A ordem de construção segue o roadmap: dashboard, colônias, avaliações e parâmetros primeiro (MVP); análises, produção, calendário e configurações avançadas depois.
- Qualquer tela pode ser repensada — este documento é um guia, não um contrato.