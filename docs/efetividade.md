# Análise de Efetividade Real das Funcionalidades

> Premissa: uma funcionalidade só entrega valor se o usuário, no campo, com mãos ocupadas e abelhas voando, efetivamente registrar o dado que ela exige. Avaliação por **atrito de entrada × valor × dependência de disciplina**.
>
> Há um segundo eixo, independente do atrito: **o dado mede o que o gráfico diz que mede?** Ele está na seção [Validade](#-segundo-eixo-validade-do-dado).

---

## 🎯 Escala usada

- **Atrito de entrada:** quão difícil/demorado é gerar o dado durante a inspeção (Baixo = um toque; Alto = parar, manusear, digitar)
- **Valor:** quanto a funcionalidade entrega se alimentada
- **Efetividade real:** valor que SOBRA depois de descontar a probabilidade de o usuário não alimentar o dado de forma consistente

---

## 📊 Avaliação por Funcionalidade

### 1. Avaliação Bom/Médio/Ruim (núcleo)
- **Atrito:** Baixo — três botões grandes, um toque por parâmetro
- **Valor:** Alto — é a espinha dorsal do sistema
- **Efetividade real: ALTA** ✅
- Funciona porque a entrada foi desenhada para o campo. O usuário consegue fazer com uma mão. Esse é o acerto central do projeto.

### 2. Score e Status automáticos
- **Atrito:** Zero — calculado pelo sistema
- **Valor:** Alto
- **Efetividade real: MÁXIMA** ✅
- O melhor tipo de funcionalidade: nasce de dado já coletado, não pede nada novo. Todo recurso assim deveria ser priorizado.

### 3. Fotos por avaliação/parâmetro
- **Atrito:** ALTO — parar, abrir câmera, enquadrar, esperar upload, às vezes com luva/fumaça por perto
- **Valor:** Médio-Alto (documentação visual, evolução, identificação de pragas)
- **Efetividade real: BAIXA a MÉDIA** ⚠️
- **Aqui está seu instinto certo.** Na prática, o usuário vai fotografar nas primeiras semanas e depois abandonar. Foto por *parâmetro* (3-8 fotos por inspeção) é irreal. Foto por *colônia* ocasional é viável.
- **Mitigação:** tornar 100% opcional, nunca bloquear o fluxo, talvez 1 foto-resumo por inspeção em vez de por parâmetro.

### 4. Temperatura e Umidade
- **Atrito:** Médio-Alto — exige termo-higrômetro em mãos e digitação
- **Valor:** Alto SE preenchido (correlações climáticas dependem disso)
- **Efetividade real: BAIXA** ⚠️
- Poucos usuários terão o aparelho ou o hábito. E como a análise comportamental depende desse dado, ela herda a baixa efetividade.
- **Mitigação:** puxar de API de clima por geolocalização automaticamente. Transforma atrito Alto em Zero. **Essa é a melhor alavanca do projeto.**

### 5. Horário da inspeção
- **Atrito:** Zero se auto-capturado; Alto se manual
- **Valor:** Alto para padrões de manejo. **Não** mede horário de atividade das abelhas: é a hora em que a caixa foi aberta (ver Validade)
- **Efetividade real: depende 100% da implementação**
- Se o sistema gravar o timestamp sozinho → MÁXIMA. Se pedir pro usuário informar "horário de pico de atividade" → quase ninguém preenche.

### 6. Genealogia (mãe/filha)
- **Atrito:** Baixo-Médio — só preenchido no momento da divisão (evento raro)
- **Valor:** Alto (linhagem materna, seleção de matrizes). Não é controle genético: o pai é desconhecido
- **Efetividade real: ALTA** ✅
- Funciona porque é registrado uma vez, num momento que o usuário já está prestando atenção (divisão é evento importante). Baixa frequência = baixa fadiga.

### 7. Velocidade de postura / Idade da rainha
- **Atrito:** Médio — depende de contar discos de cria com precisão a cada inspeção
- **Valor:** Alto (objetivo declarado do projeto)
- **Efetividade real: MÉDIA** ⚠️
- O cálculo é bom, mas a precisão depende de o usuário contar discos consistentemente. Estimativa de idade da rainha precisa de série histórica longa e regular — meses de dados disciplinados.
- **Realidade:** só usuários avançados/pesquisadores vão extrair isso. Para o hobbyista, será impreciso.

### 8. Correlações entre parâmetros
- **Atrito:** Zero adicional — usa dados já coletados nas avaliações
- **Valor:** Alto
- **Efetividade real: ALTA** ✅ (condicionada a volume)
- Não pede nada novo do usuário, só precisa de histórico acumulado. Efetividade cresce com o tempo de uso. Só não funciona nos primeiros meses (poucos dados).
- Parâmetro × score é circular (o score vem dos parâmetros) e não conta. Clima × score precisa de ajuste sazonal (ver Validade).

### 9. Produção/Colheitas
- **Atrito:** Baixo — evento pontual, poucas vezes ao ano, usuário motivado (é o "resultado")
- **Valor:** Alto
- **Efetividade real: ALTA** ✅
- Colher mel é o momento de maior engajamento. O usuário QUER registrar quanto produziu. Baixa frequência + alta motivação = ótima adesão.

### 10. Alertas e Calendário
- **Atrito:** Zero — gerado pelo sistema a partir de datas
- **Valor:** Médio-Alto (combate o esquecimento, principal causa de abandono)
- **Efetividade real: ALTA** ✅
- Funcionalidade que *traz o usuário de volta* em vez de exigir trabalho dele. Tipo de recurso que sustenta retenção.

### 11. Predições ML (enxameação, anomalias)
- **Atrito:** Zero adicional, MAS exige base histórica grande e limpa
- **Valor:** Alto (se confiável)
- **Efetividade real: BAIXA no início, potencial ALTA tardia** ⚠️
- ML precisa de muitos dados consistentes de muitas colônias. Nos primeiros 1-2 anos de um app pessoal, não haverá base. Risco de gerar predições ruins que minam a confiança.
- **Recomendação:** deixar para o fim, como Fase 4 já prevê. Não prometer cedo.

---

## 🧮 Ranking de Efetividade Real

| # | Funcionalidade | Atrito | Efetividade Real |
|---|---------------|--------|------------------|
| 1 | Score/Status automático | Zero | ★★★★★ |
| 2 | Avaliação Bom/Médio/Ruim | Baixo | ★★★★★ |
| 3 | Alertas e Calendário | Zero | ★★★★☆ |
| 4 | Produção/Colheitas | Baixo | ★★★★☆ |
| 5 | Genealogia | Baixo* | ★★★★☆ |
| 6 | Correlações | Zero+ | ★★★★☆ |
| 7 | Velocidade postura/Idade rainha | Médio | ★★★☆☆ |
| 8 | Horário (se automático) | Zero | ★★★★☆ / ★☆☆☆☆ |
| 9 | Temperatura/Umidade | Alto | ★★☆☆☆ |
| 10 | Fotos | Alto | ★★☆☆☆ |
| 11 | Predições ML | Zero+ tardio | ★★☆☆☆ (cedo) |

\* baixa frequência   + precisa de histórico acumulado

---

---

## 🔬 Segundo eixo: validade do dado

O ranking acima mede se o dado **chega**. Este eixo mede se ele **diz o que o gráfico afirma**. Números de uma simulação de meliponário (06/11/2026): ~30 colônias por 3 anos, 4 espécies, 200 rodadas com efeitos conhecidos e 200 sem nenhum efeito, reproduzindo os vieses reais da coleta (inspeção em dia ameno, de manhã, no fim de semana; buracos no inverno; ruído de observador; morte notada tarde). Os efeitos simulados são hipóteses, não fatos biológicos: os números mostram **o tamanho** de cada problema.

| Análise | O que a simulação mostrou | Como apresentar |
|---|---|---|
| Clima na hora da inspeção × score | Correlação ~0,40 **com ou sem** efeito de clima; "significativa" em 100% das rodadas do mundo nulo. É a estação | Só com ajuste sazonal, e com o clima dos dias **antes** da inspeção |
| Frio nos 14 dias antes × score | Com ajuste sazonal, poder de **8%** num meliponário só | Exploratório; relato de evento extremo, não índice |
| "Alimentei e o score subiu" | Ganho de +18 pontos com efeito real e de **+14 sem efeito nenhum**: regressão à média | Nunca antes/depois como eficácia. Exige o motivo da ação e comparação com não tratadas |
| Colônias ativas / perdas | Mortalidade anual verdadeira ~22%; o app mostra ~39% das colônias como mortas no período | Contagem, nunca taxa. Taxa exige data da perda |
| Alerta de queda de 20 pontos | ~60% de precisão: 4 em 10 alertas são ruído de observação | "Confira esta colônia", não diagnóstico |
| Score 0–100 | Com 5 parâmetros, só 11 valores possíveis; trata Ruim→Médio igual a Médio→Bom | Bom para manejo. Para pesquisa, cada parâmetro como ordinal |
| Horários de atividade | 75% das inspeções entre 8h e 12h, nenhuma entre 13h e 16h | Rotular como horário das inspeções |
| Espécie A × espécie B | Poder de 48% | Exploratório, com n |
| Força da matriz passa às filhas | Poder de 28% | Ordenar com aviso de incerteza |
| Score antes da colheita × quantidade | Poder de 60% | O melhor dos três; ainda exploratório |

**Dados que mais aumentam a validade**, em ordem de valor por esforço no campo:
1. **Data e motivo da mudança de status da colônia** (morte, perda, abandono). Destrava sobrevivência, sucesso de divisão e a validação do score.
2. **Motivo da inspeção e da ação** (rotina ou problema; por que alimentou). Corrige a regressão à média.
3. **Versão do protocolo** em cada avaliação (critérios e parâmetros vigentes). Pré-requisito para comparar meliponários.
4. **Clima antes da inspeção, com procedência** (API ou digitado), calculado da coordenada sem trabalho do usuário.

O limite que nenhum campo resolve: para perguntas ambientais, genéticas ou de manejo, o n que importa é o **número de meliponários**, não o de colônias.

## 💡 Conclusões Estratégicas

**1. O padrão que separa alta de baixa efetividade é claro:**
funcionalidades que **derivam de dado já coletado** ou **automatizam a captura** vencem. Funcionalidades que **pedem input manual extra no campo** perdem, por mais valiosas que sejam no papel.

**2. As três maiores alavancas do projeto:**
- **Puxar clima de API automática** → resgata temperatura/umidade E análise comportamental de uma vez só
- **Capturar timestamp automaticamente** → resgata análise de horários sem pedir nada
- **Manter o fluxo de avaliação ultrarrápido** → protege o núcleo que já funciona

**3. Sobre as fotos especificamente (sua pergunta):**
seu instinto está certo — é a funcionalidade de maior atrito do sistema. Recomendo:
- Nunca obrigatória, nunca no caminho crítico
- Repensar "foto por parâmetro" → virar "foto opcional por inspeção"
- Aceitar que será usada esporadicamente e desenhar para isso

**4. Cuidado com a promessa de precisão:**
idade da rainha e predições ML soam impressionantes, mas dependem de disciplina e volume que um usuário comum não terá. Melhor entregá-las como "estimativa aproximada, melhora com o tempo" do que como número exato — para não quebrar confiança.

**5. Atrito baixo não garante validade:**
o horário automático e o clima automático têm atrito zero, mas medem o instante da inspeção, não a colônia. Toda análise nova passa pelos dois eixos.

**6. O MVP está bem desenhado sob essa ótica:**
ele concentra justamente as funcionalidades de baixo atrito (avaliação, score, histórico). As de alto atrito (fotos, clima manual, ML) estão corretamente nas fases posteriores ou como opcionais.