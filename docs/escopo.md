# Escopo Completo - Projeto Corbicula

## 📋 Informações do Projeto

**Nome:** Corbicula  
**Tipo:** Aplicação Web Open-Source (PWA)  
**Objetivo:** Coleta e análise científica de dados de colônias de abelhas sem ferrão — voltado a academia/pesquisa, portfólio e uso público  
**Licença:** Apache 2.0  
**Tecnologia:** Node.js + Python + React + PostgreSQL  
**Ambiente:** Docker (desenvolvimento local)

---

## 🚫 Fora do Escopo (MVP)

Para manter o foco e evitar inchaço, os itens abaixo estão **explicitamente fora** do MVP:

- **Cadastro/edição de espécies pelo usuário.** A tabela `especies` é um catálogo fixo, populado por seed com as ~19 espécies do RS. O usuário apenas seleciona de uma lista; não cria nem edita espécies. Só há leitura exposta na API.
- **Cadastro de espécie por ADM.** Possibilidade em aberto para o futuro, ainda não decidida (dúvida sobre custo/benefício e risco). Não construir agora.
- **Expansão para outras regiões além do RS.** Backlog futuro.
- **Multiusuário / compartilhamento de meliponário.** Pós-MVP.
- **App mobile nativo, IoT/sensores, marketplace.** Roadmap distante (ver seção futura).

Esses itens podem ser reconsiderados em versões futuras, mas não devem influenciar decisões de arquitetura ou interface do MVP.

---

## 🎯 Visão Geral

O Projeto Corbicula é uma aplicação web gratuita e open-source (licença Apache 2.0) para coleta e análise científica de dados de abelhas sem ferrão (Meliponini), com foco no Rio Grande do Sul. Seu propósito primário é **acadêmico e de pesquisa**, servindo também como portfólio técnico do autor e como ferramenta de auxílio ao público geral (meliponicultores, conservacionistas). O sistema permite:

1. **Gestão completa de meliponários** (cadastro e monitoramento de colônias)
2. **Avaliações personalizáveis** (cada usuário define seus próprios critérios)
3. **Funcionamento offline** (PWA com sincronização automática)
4. **Análises científicas avançadas** (estatísticas, correlações, predições)
5. **Controle genealógico** (rastreamento de linhagens e divisões)
6. **Análise comportamental** (padrões de atividade, produtividade)

---

## 👥 Público-Alvo

### Primário
- **Meliponicultores iniciantes e intermediários** (5-50 colônias)
- **Pesquisadores acadêmicos** (coleta de dados científicos)
- **Técnicos extensionistas** (EMATER, EMBRAPA)

### Secundário
- **Meliponicultores comerciais** (50+ colônias)
- **Projetos de conservação** (espécies ameaçadas)
- **Educadores** (escolas, projetos ambientais)

---

## 🎨 Personas

### Persona 1: João - Meliponicultor Iniciante
- **Idade:** 35 anos
- **Perfil:** Tem 8 colônias de jataí no quintal
- **Necessidade:** Aprender a avaliar suas colônias corretamente
- **Uso:** Avaliações mensais, consulta de histórico, alertas

### Persona 2: Dra. Ana - Pesquisadora
- **Idade:** 42 anos
- **Perfil:** Professora universitária, estuda mandaçaias
- **Necessidade:** Coletar dados padronizados para pesquisa
- **Uso:** Análises estatísticas, exportação de dados, correlações

### Persona 3: Carlos - Criador Comercial
- **Idade:** 50 anos
- **Perfil:** 120 colônias de várias espécies
- **Necessidade:** Identificar melhores matrizes, otimizar produção
- **Uso:** Controle genealógico, ranking de produtividade, divisões

---

## 🔧 Funcionalidades Detalhadas

### **MÓDULO 1: Gestão de Colônias**

#### 1.1 Cadastro de Colônias
**Descrição:** Registro completo de cada colônia no meliponário

**Campos obrigatórios:**
- Código/identificação única (ex: TETRANGU-001) — **gerado automaticamente pelo sistema** a partir do código Kew da espécie; o usuário nunca digita
- Espécie (selecionada de lista — catálogo fixo)
- Data de entrada no meliponário

**Campos opcionais:**
- Origem (captura, compra, divisão)
- Colônia-mãe (se veio de divisão)
- Tipo de caixa (INPA, PNN, Schenck, tronco, outro)
- Dimensões da caixa
- Localização no meliponário
- Coordenadas GPS
- Fotos da colônia
- Observações gerais

**Ações:**
- Criar nova colônia
- Editar informações
- Marcar como inativa/morta
- Ver histórico completo
- Duplicar (para criar colônia-filha)

**Validações:**
- Código único por usuário
- Datas coerentes
- Campos obrigatórios preenchidos

#### 1.2 Visualização de Colônias
**Layouts:**
- Lista (tabela com filtros e ordenação)
- Cards (visual com foto principal)
- Mapa (localização geográfica)
- Árvore genealógica (relacionamentos)

**Filtros:**
- Por espécie
- Por status (ativa, inativa, morta)
- Por origem
- Por localização
- Por score de saúde
- Por data de entrada

**Ordenação:**
- Alfabética
- Data de entrada (mais recente/antiga)
- Score de saúde (melhor/pior)
- Última avaliação

---

### **MÓDULO 2: Parâmetros Personalizáveis**

#### 2.1 Configuração de Parâmetros
**Descrição:** Sistema flexível onde usuário define seus próprios critérios de avaliação

**Estrutura de um parâmetro:**
```
Nome: "População e Atividade"
Tipo: Seleção (Bom/Médio/Ruim)

Critério BOM: "20+ abelhas/minuto na entrada"
Critério MÉDIO: "10-20 abelhas/minuto"
Critério RUIM: "Menos de 10 abelhas/minuto"

Ordem de exibição: 1
Permite observações: Sim
Permite foto: Sim
```

**Parâmetros pré-configurados (sugeridos):**
1. População e Atividade Externa
2. Potes de Mel
3. Discos de Cria
4. Condição da Rainha
5. Potes de Pólen
6. Sanidade (pragas e doenças)
7. Estrutura do Ninho
8. Reservas Alimentares

**Ações:**
- Criar novo parâmetro
- Editar parâmetro existente
- Reordenar parâmetros
- Ativar/desativar parâmetro
- Importar conjunto de parâmetros (templates)
- Exportar seus parâmetros

**Validações:**
- Nome único
- Pelo menos 1 parâmetro ativo
- Critérios preenchidos

---

### **MÓDULO 3: Avaliações de Colônias**

#### 3.1 Registro de Avaliação
**Descrição:** Interface rápida para avaliar colônias durante inspeção

**Fluxo:**
1. Seleciona colônia
2. Inicia avaliação (registra data/hora automaticamente)
3. Para cada parâmetro:
   - Marca Bom/Médio/Ruim (botões visuais)
   - Adiciona observação (opcional)
   - Anexa foto (opcional)
4. Adiciona observações gerais
5. Registra ações tomadas (checkboxes)
6. Salva (calcula score automaticamente)

**Dados registrados:**
- Data e hora da avaliação
- Duração da inspeção
- Temperatura ambiente (manual ou automático)
- Umidade ambiente (manual ou automático)
- Condições climáticas (ensolarado, nublado, chuvoso)
- Classificação de cada parâmetro
- Observações por parâmetro
- Fotos por parâmetro
- Observações gerais
- Ações realizadas
- Score geral calculado
- Status geral (Excelente/Boa/Atenção/Crítica)

**Ações possíveis (checkboxes):**
- Alimentação artificial fornecida
- Limpeza realizada
- Divisão executada
- Tratamento aplicado
- Troca de caixa
- Nenhuma intervenção

**Cálculo do Score:**
```
Score = (Parâmetros BOM × 100 + Parâmetros MÉDIO × 50 + Parâmetros RUIM × 0) / Total de Parâmetros

Classificação:
- 80-100%: Excelente
- 60-79%: Boa
- 40-59%: Atenção
- 0-39%: Crítica
```

**Validações:**
- Data não pode ser futura
- Pelo menos 1 parâmetro avaliado
- Fotos em formato válido (JPG, PNG)
- Tamanho máximo de foto: 5MB

#### 3.2 Histórico de Avaliações
**Visualizações:**
- Linha do tempo (cronológica)
- Gráfico de evolução (score ao longo do tempo)
- Tabela comparativa
- Cards resumidos

**Filtros:**
- Por período (última semana, mês, ano, customizado)
- Por avaliador (se multiusuário)
- Por status
- Por parâmetros específicos

#### 3.3 Edição e Exclusão de Avaliações
**Regras:**
- Pode editar avaliações dos últimos 7 dias (após 7 dias → 409 Conflict)
- Pode excluir avaliações (sem restrição de prazo — permite corrigir cadastros errados)
- Se parâmetros forem enviados na edição, substituem todos os anteriores e o score é recalculado

---

### **MÓDULO 4: Análises Básicas (Node.js)**

#### 4.1 Dashboard Geral
**Widgets:**
- Total de colônias (ativas/inativas)
- Distribuição por espécie (gráfico pizza)
- Status geral do meliponário (gráfico barras)
- Colônias que precisam atenção (lista)
- Últimas avaliações (lista)
- Próximas inspeções sugeridas (calendário)

#### 4.2 Estatísticas de Colônia
**Para cada colônia:**
- Score atual
- Tendência (subindo/estável/descendo)
- Média dos últimos 30 dias
- Média dos últimos 12 meses
- Melhor e pior avaliação
- Total de avaliações
- Dias desde última avaliação
- Gráfico de evolução temporal

#### 4.3 Comparação Entre Colônias
**Funcionalidade:**
- Seleciona 2-10 colônias
- Compara scores
- Compara parâmetros específicos
- Gráficos lado a lado
- Identifica diferenças

---

### **MÓDULO 5: Análises Avançadas (Python)**

#### 5.1 Análises Estatísticas
**Correlações:**
- Entre parâmetros (ex: mel vs cria)
- Matriz de correlação
- Teste de significância estatística
- Interpretação textual

**Análise de Séries Temporais:**
- Tendências de longo prazo
- Sazonalidade
- Médias móveis
- Detecção de anomalias

**Comparações:**
- Entre espécies
- Entre origens (captura vs compra vs divisão)
- Entre tipos de caixa
- Entre localizações

#### 5.2 Controle Genealógico
**Árvore Genealógica:**
- Visualização interativa
- Mostra colônia-mãe e filhas
- Indica sucesso/fracasso de divisões
- Calcula taxa de sucesso por matriz

**Análise de Linhagens:**
- Performance média de descendentes
- Identificação de melhores matrizes
- Diversidade genética (baseada em origens)
- Sugestão de divisões

#### 5.3 Análise Comportamental
**Padrões de Atividade:**
- Horários de pico (se registrado)
- Dias da semana mais ativos
- Correlação com clima
- Variação sazonal

**Velocidade de Postura:**
- Cálculo baseado em discos de cria
- Estimativa de idade da rainha
- Predição de declínio produtivo

#### 5.4 Machine Learning (Futuro)
**Predições:**
- Probabilidade de enxameação
- Detecção precoce de problemas
- Melhor momento para divisão
- Produtividade esperada

**Modelos:**
- Random Forest (classificação)
- Regressão linear (tendências)
- K-means (agrupamento)

---

### **MÓDULO 6: Produção e Colheitas**

#### 6.1 Registro de Colheitas
**Dados:**
- Data da colheita
- Colônia
- Volume de mel (ml ou litros)
- Tipo de produto (mel, pólen, própolis)
- Características (cor, aroma, sabor)
- Fotos do mel
- Observações

#### 6.2 Controle de Produção
**Relatórios:**
- Produção total por colônia
- Produção por espécie
- Produção ao longo do tempo
- Média de produção
- Melhor e pior produtora

---

### **MÓDULO 7: Calendário e Alertas**

#### 7.1 Calendário de Inspeções
**Funcionalidades:**
- Visualização mensal
- Inspeções realizadas
- Próximas inspeções sugeridas
- Lembretes personalizáveis

#### 7.2 Sistema de Alertas
**Tipos de alerta:**
- Colônia não inspecionada há X dias
- Colônia em status crítico
- Declínio rápido de score
- Infestação detectada
- Reservas baixas
- Rainha ausente

**Notificações:**
- In-app (badge, lista)
- E-mail (opcional)
- Push notification (PWA)

---

### **MÓDULO 8: Relatórios e Exportação**

#### 8.1 Relatórios Predefinidos
**Tipos:**
- Relatório geral do meliponário
- Relatório individual de colônia
- Relatório de produção
- Relatório científico (para pesquisa)

**Formatos:**
- PDF (para impressão)
- Excel/CSV (para análise externa)
- JSON (para desenvolvedores)

#### 8.2 Exportação de Dados
**Opções:**
- Exportar todas as colônias
- Exportar avaliações (período específico)
- Exportar fotos (zip)
- Exportar backup completo

---

### **MÓDULO 9: Funcionalidade Offline (PWA)**

#### 9.1 Armazenamento Local
**IndexedDB:**
- Cópia local de colônias
- Cópia de avaliações recentes
- Parâmetros do usuário
- Fila de sincronização

**Capacidade:**
- Mínimo 100MB
- Otimizado até 500MB

#### 9.2 Sincronização
**Estratégias:**
- Manual (botão "Sincronizar")
- Automática (quando detecta internet)
- Background Sync (quando app está fechado)

**Conflitos:**
- Detecção de edições simultâneas
- Interface para resolver conflitos
- Last-write-wins para casos simples

#### 9.3 Indicadores
**Interface:**
- Ícone de status (online/offline/sincronizando)
- Lista de pendências
- Barra de progresso na sincronização
- Últimas mudanças não sincronizadas

---

### **MÓDULO 10: Configurações e Perfil**

#### 10.1 Perfil do Usuário
**Dados:**
- Nome
- E-mail
- Localização (cidade, estado)
- Tipo de meliponicultor (hobby, comercial, pesquisador)
- Foto de perfil
- Bio

#### 10.2 Configurações Gerais
**Opções:**
- Idioma (PT-BR, EN, ES)
- Tema (claro, escuro, automático)
- Unidades (ml/litros, °C/°F)
- Formato de data
- Frequência de inspeção sugerida
- Notificações (ativar/desativar por tipo)

#### 10.3 Dados do Meliponário
**Informações:**
- Nome do meliponário
- Endereço completo
- Coordenadas GPS
- Bioma (Mata Atlântica, Pampa, etc)
- Área total
- Registro em órgãos (opcional)

---

## 🗂️ Estrutura do Banco de Dados

### **Tabelas Principais (10):**

1. **users** - Usuários do sistema (id UUID)
2. **meliponarios** - Dados do meliponário (1:1 com user)
3. **especies** - Catálogo fixo de espécies (seed-only, somente leitura)
4. **colonias** - Colônias de abelhas (referencia especie por FK)
5. **parametros** - Parâmetros personalizáveis por usuário
6. **avaliacoes** - Registros de avaliações
7. **avaliacoes_parametros** - Valores de parâmetros por avaliação (N:N)
8. **fotos** - Fotos anexadas (opcionais)
9. **producoes** - Colheitas e produção
10. **sync_queue** - Fila de sincronização offline

Todos os IDs são **UUID** (`@default(uuid())`) — escolha adequada para sincronização offline, evitando colisão de IDs entre dispositivos. Detalhes do schema em `docs/prisma-setup.md`.

### **Relacionamentos:**
```
users (1) → (1) meliponarios
users (1) → (N) colonias
users (1) → (N) parametros
especies (1) → (N) colonias        (catálogo fixo)
colonias (1) → (N) colonias        (genealogia mãe/filha, recursivo)
colonias (1) → (N) avaliacoes
avaliacoes (1) → (N) avaliacoes_parametros
parametros (1) → (N) avaliacoes_parametros
colonias (1) → (N) fotos
avaliacoes (1) → (N) fotos
avaliacoes_parametros (1) → (N) fotos
colonias (1) → (N) producoes
```

---

## 🎨 Design e UX

### **Princípios de Design:**
1. **Mobile-first** - Interface otimizada para celular
2. **Simplicidade** - Fluxos intuitivos, sem complexidade desnecessária
3. **Acessibilidade** - Contraste adequado, textos legíveis, navegação por teclado
4. **Responsividade** - Adapta a desktop, tablet, celular
5. **Feedback visual** - Loading states, confirmações, erros claros

### **Paleta de Cores (Sugestão):**
```
Primária: Verde (#4CAF50) - Natureza, abelhas
Secundária: Amarelo (#FFC107) - Mel, energia
Sucesso: Verde claro (#81C784)
Atenção: Laranja (#FF9800)
Erro: Vermelho (#F44336)
Neutros: Cinza (#757575, #BDBDBD, #E0E0E0)
```

### **Tipografia:**
- Títulos: Inter Bold
- Corpo: Inter Regular
- Código: Fira Code

### **Componentes Principais:**
- Cards de colônia
- Botões de ação rápida (Bom/Médio/Ruim)
- Gráficos de linha/barra/pizza
- Tabelas responsivas
- Modais para formulários
- Drawer lateral (menu)
- Bottom navigation (mobile)

---

## 🔐 Segurança e Privacidade

### **Autenticação:**
- JWT (JSON Web Tokens)
- Senha com hash bcrypt
- Refresh tokens
- Sessões com timeout

### **Autorização:**
- Usuário só vê seus próprios dados
- Multiusuário futuro (compartilhamento)

### **Privacidade:**
- Dados armazenados localmente quando offline
- Fotos comprimidas antes de upload
- Opção de exportar/deletar todos os dados (LGPD)

### **Validação:**
- Input sanitization
- SQL injection prevention (Prisma ORM)
- XSS prevention (React)
- CSRF tokens

---

## 📊 Métricas de Sucesso

### **Métricas Técnicas:**
- Tempo de resposta API < 500ms
- Score Lighthouse > 90
- Cobertura de testes > 70%
- Uptime > 99% (futuro em produção)

### **Métricas de Uso:**
- Usuários ativos mensais
- Número de colônias cadastradas
- Número de avaliações registradas
- Taxa de retenção (usuários que voltam)

### **Métricas de Qualidade:**
- Issues abertas vs fechadas (GitHub)
- Tempo médio de resolução de bugs
- Contribuidores ativos
- Stars no GitHub

---

## 🚀 Fases de Desenvolvimento

### **Fase 1: MVP**
**Objetivo:** Versão funcional básica

**Entregas:**
- ✅ Cadastro de colônias
- ✅ Parâmetros personalizáveis
- ✅ Registro de avaliações
- ✅ Histórico e gráficos básicos
- ✅ Autenticação
- ✅ Offline básico (PWA)
- ✅ Docker setup completo

**Tecnologias:**
- Frontend: React + TypeScript + Vite + PWA
- Backend: Node.js + Fastify + Prisma (em `app/backend`)
- Database: PostgreSQL (IDs em UUID)
- Deploy: Docker local

### **Fase 2: Análises**
**Objetivo:** Adicionar inteligência ao sistema

**Entregas:**
- ✅ Microsserviço Python
- ✅ Análises estatísticas (correlações, tendências)
- ✅ Controle genealógico (árvore)
- ✅ Análise comportamental
- ✅ Relatórios em PDF

**Tecnologias:**
- Analytics: Python + FastAPI (em `app/analytics`)
- Análise: Pandas, NumPy, Scipy
- Visualização: Matplotlib, Seaborn

### **Fase 3: Produção e Recursos Avançados**
**Entregas:**
- ✅ Registro de colheitas
- ✅ Calendário de inspeções
- ✅ Sistema de alertas
- ✅ Exportação de dados
- ✅ Melhorias de UX

### **Fase 4: Machine Learning**
**Entregas:**
- ✅ Predição de enxameação
- ✅ Detecção de anomalias
- ✅ Recomendações automáticas
- ✅ Jupyter Notebooks

**Tecnologias:**
- ML: Scikit-learn, TensorFlow (opcional)

### **Fase 5: Polimento e Comunidade**
**Entregas:**
- ✅ Documentação completa
- ✅ Tutoriais em vídeo
- ✅ Templates de parâmetros
- ✅ Multiidioma
- ✅ Melhorias baseadas em feedback

---

## 🧪 Testes

### **Testes Unitários:**
- Backend Node.js: Jest
- Backend Python: pytest
- Frontend: Vitest + React Testing Library

**Cobertura mínima:** 70%

### **Testes de Integração:**
- API endpoints
- Comunicação Node ↔ Python
- Sincronização offline

### **Testes E2E:**
- Playwright ou Cypress
- Fluxos críticos (cadastro, avaliação, sincronização)

### **Testes de Performance:**
- Load testing (k6)
- Stress testing
- Análise de bundle size

---

## 📚 Documentação

### **Documentação Técnica:**
- README.md principal
- Setup e instalação
- Arquitetura do sistema
- API Reference (Swagger/OpenAPI)
- Guia de contribuição

### **Documentação de Usuário:**
- Manual do usuário (wiki)
- Vídeos tutoriais
- FAQ
- Glossário de termos (meliponicultura)

### **Documentação Científica:**
- Metodologia de cálculos
- Referências bibliográficas
- Protocolos de avaliação
- Validação científica

---

## 🤝 Colaboração e Open Source

### **Repositório:**
- GitHub (público)
- Issues para bugs e features
- Discussions para dúvidas
- Wiki para documentação

### **Como Contribuir:**
- Code of Conduct
- Contributing guidelines
- Pull request template
- Issue templates

### **Comunidade:**
- Discord ou Telegram (futuro)
- Reuniões mensais (online)
- Apresentações em eventos

---

## ⚖️ Licença

**Apache License 2.0**

**Permite:**
- ✅ Uso comercial
- ✅ Modificação
- ✅ Distribuição
- ✅ Uso privado
- ✅ Uso de patentes (cláusula expressa)

**Requer:**
- Inclusão da licença e do aviso de copyright
- Documentação de alterações significativas (NOTICE)

Escolhida por ser permissiva e incluir proteção de patentes — adequada a um projeto acadêmico que pode ser citado e estendido por terceiros.

---

## 🎯 Critérios de Aceitação

### **MVP é considerado completo quando:**- [ ] Usuário pode cadastrar 10+ colônias
- [ ] Usuário pode definir parâmetros personalizados
- [ ] Usuário pode avaliar colônias offline
- [ ] Dados sincronizam ao voltar online
- [ ] Histórico de avaliações é exibido graficamente
- [ ] Sistema funciona em celular e desktop
- [ ] Score de saúde é calculado automaticamente
- [ ] Alertas básicos funcionam
- [ ] Código está no GitHub
- [ ] Documentação básica existe

### **Fase 2 completa quando:**
- [ ] Análises estatísticas funcionam
- [ ] Correlações são calculadas corretamente
- [ ] Árvore genealógica é exibida
- [ ] Relatórios PDF são gerados
- [ ] Python microsserviço está integrado

---

## 🔮 Roadmap Futuro (Pós-MVP)

### **Recursos Avançados:**
- Multiusuário (compartilhamento de meliponário)
- App mobile nativo (React Native)
- Integração com sensores IoT
- Reconhecimento de imagem (identificar espécies)
- Marketplace de produtos (mel, rainhas)
- Fórum/comunidade integrada
- Gamificação (badges, conquistas)

### **Integrações:**
- Estações meteorológicas (API)
- Google Maps (rotas de flora)
- iNaturalist (dados de biodiversidade)
- SISGEN (registro genético)

---

## ✅ Resumo Executivo

**O que é:** Sistema web de gestão e análise científica de meliponários

**Para quem:** Meliponicultores, pesquisadores, conservacionistas

**Diferencial:** 
- Gratuito e open-source (Apache 2.0)
- Foco científico: exportação de dados, metodologia reprodutível
- Funciona offline (PWA), compatível web + mobile
- Parâmetros 100% personalizáveis
- Análises científicas avançadas (Python)
- Controle genealógico
- Catálogo de espécies do RS com códigos padrão Kew

**Tecnologia:** Node.js + Python + React + PostgreSQL (UUID) + Docker

**Status:** Em desenvolvimento (backend scaffolded)  
**Licença:** Apache 2.0

---