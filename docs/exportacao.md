# Exportação de dados — endpoints, dicionário e metodologia

A exportação é funcionalidade de primeira classe: os dados coletados no Corbicula
precisam chegar limpos em R, Python (pandas), SPSS ou planilhas.

Implementação: `app/backend/src/modules/exportacao/`.

---

## Endpoints

Todos exigem autenticação (`Authorization: Bearer <token>`) e retornam apenas
os dados do usuário autenticado. Respostas vêm como anexo
(`Content-Disposition: attachment; filename="corbicula_<recurso>_<AAAA-MM-DD>.<ext>"`).

| Endpoint | Filtros (query) | Conteúdo |
|----------|-----------------|----------|
| `GET /exportacao/colonias` | `formato`, `status` | Uma linha por colônia |
| `GET /exportacao/avaliacoes` | `formato`, `coloniaId`, `status`, `desde`, `ate` | Uma linha por **avaliação × parâmetro** (formato longo) |
| `GET /exportacao/producoes` | `formato`, `coloniaId`, `tipoProduto`, `desde`, `ate` | Uma linha por colheita |
| `GET /exportacao/historico-status` | `formato`, `coloniaId`, `desde`, `ate` (pela data percebida) | Uma linha por mudança de status de colônia |
| `GET /exportacao/protocolos` | — (só JSON) | Os protocolos de avaliação: parâmetros e critérios aplicados, hash e template de origem |
| `GET /exportacao/backup` | — | JSON estruturado com todos os dados do usuário |
| `GET /parametros/exportar` | — | Os parâmetros de avaliação (critérios + critérios por espécie), reimportáveis — ver abaixo |

`formato` = `csv` (padrão) ou `json`. Datas dos filtros em ISO 8601 (`2026-01-01` ou `2026-01-01T00:00:00Z`).

### Convenções do CSV

- RFC 4180: separador vírgula, fim de linha CRLF, aspas duplas quando o campo
  contém vírgula, aspas ou quebra de linha.
- UTF-8 **sem BOM**. No Excel, abra por *Dados → De Texto/CSV* e escolha UTF-8.
- Datas em ISO 8601, **UTC** (`2026-09-24T14:30:00.000Z`).
- Decimal com ponto. Valor ausente = campo vazio (`NA` no R, `NaN` no pandas).
- Nomes de coluna em `snake_case`.

```r
# R
av <- readr::read_csv("corbicula_avaliacoes_2026-09-24.csv")
```
```python
# Python
av = pd.read_csv("corbicula_avaliacoes_2026-09-24.csv", parse_dates=["data_avaliacao"])
```

### JSON

`{ "metadados": {...}, "dados": [ ...mesmas linhas do CSV... ] }`.
Os `metadados` trazem fonte, versão da API, data da exportação, filtros aplicados,
total de registros e o bloco `metodologia` (abaixo). O dataset leva junto a
descrição de como foi calculado.

---

## Dicionário de dados

### colonias

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| colonia_id | UUID | Identificador da colônia |
| codigo | texto | Código `[KEW]-[NNN]` gerado automaticamente (ex.: `TETRANGU-001`) |
| status | texto | `ativa`, `inativa`, `morta` |
| status_desde | data-hora | Data em que o usuário percebeu a mudança para o status atual (padrão: o momento do registro; numa mudança feita offline, o momento da operação no aparelho). Nunca no futuro nem antes do dia de entrada. Vazio = não registrado (colônia nunca mudou de status nem teve o status corrigido desde 06/11/2026) |
| motivo_status | texto | Motivo da mudança para o status atual (vocabulário abaixo). Vazio = não registrado |
| motivo_status_detalhe | texto | Texto livre (acompanha `outro`) |
| classe_motivo_status | texto | `evento` ou `censura` (vocabulário abaixo); vazio sem motivo ou com motivo sem classe |
| especie_codigo | texto | Código Kew da espécie (vazio se não identificada) |
| especie_nome_cientifico / especie_nome_popular | texto | Da tabela de espécies |
| data_entrada | data-hora | Entrada da colônia no meliponário |
| origem | texto | `captura`, `compra`, `divisao`, `resgate` |
| tipo_caixa | texto | `INPA`, `PNN`, `Schenck`, `tronco`, `outro` |
| caixa_altura / caixa_largura / caixa_profundidade | número | Dimensões informadas pelo usuário (unidade não padronizada no app) |
| localizacao | texto | Descrição livre da posição |
| latitude / longitude | número | Graus decimais (WGS84) |
| colonia_mae_id / colonia_mae_codigo | UUID / texto | Genealogia (divisão) |
| colonia_doadora_campeiras_id / colonia_doadora_campeiras_codigo | UUID / texto | Divisão: outra colônia que doou campeiras (opcional) |
| frequencia_inspecao_dias | inteiro | Intervalo sugerido entre inspeções desta colônia (vazio = preferência geral do usuário). Sugestão de manejo |
| n_avaliacoes / n_producoes | inteiro | Contagens |
| observacoes | texto | Livre |
| registrado_em / atualizado_em | data-hora | Auditoria |

### avaliacoes (formato longo)

Cada avaliação gera **uma linha por parâmetro avaliado**. Os campos da avaliação
se repetem nessas linhas. É o formato *tidy* (pronto para `group_by`/pivot).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| avaliacao_id | UUID | Identificador da avaliação |
| colonia_id / colonia_codigo / especie_codigo | | Colônia avaliada |
| data_avaliacao | data-hora | Momento da inspeção (UTC) |
| motivo_inspecao | texto | Por que a inspeção aconteceu (vocabulário abaixo). Vazio = não registrado |
| motivo_inspecao_detalhe | texto | Texto livre (acompanha `outro`) |
| duracao_minutos | inteiro | Opcional |
| temperatura_c | número | °C, 1 casa decimal |
| umidade_pct | número | Umidade relativa, % |
| condicao_climatica | texto | `ensolarado`, `nublado`, `chuvoso` |
| clima_fonte | texto | Procedência do clima: `api_previsao`, `api_historico`, `digitado` (vocabulário abaixo). Vazio = sem clima ou avaliação anterior a 06/11/2026 (não registrado). *Limite:* editar `data_avaliacao` não busca o clima de novo, então um valor da API (e sua `clima_fonte`) se refere à data/hora original da avaliação |
| score_geral | inteiro | 0–100 (ver metodologia) |
| status_geral | texto | `excelente`, `boa`, `atencao`, `critica` |
| n_parametros | inteiro | Nº de parâmetros na avaliação (denominador do score) |
| protocolo_hash | texto | SHA-256 (hex) do protocolo vigente na avaliação (ver metodologia e `/exportacao/protocolos`). Vazio = avaliação anterior a 06/11/2026. *Limites:* (a) uma avaliação feita offline recebe o protocolo vigente quando é sincronizada, não o do momento da inspeção; (b) uma edição que muda o conjunto de parâmetros registra os critérios vigentes na hora da edição para **todos** os parâmetros da avaliação, inclusive os que já estavam nela |
| parametro_id / parametro_nome | UUID / texto | Parâmetro avaliado (definido pelo usuário) |
| classificacao | texto | `bom`, `medio`, `ruim` |
| classificacao_pontos | inteiro | 100 / 50 / 0 |
| valor_numerico | inteiro | Opcional, se o usuário registrou uma contagem |
| observacoes_parametro | texto | Livre |
| observacoes_gerais | texto | Livre |
| acoes_tomadas | texto | Lista separada por ` \| ` |
| motivos_acoes | texto (CSV) / objeto (JSON) | CSV: lista **paralela** a `acoes_tomadas` (mesma ordem, mesmo separador) com o motivo de cada ação (`preventiva` ou `resposta_problema`), item vazio na ação sem motivo; campo vazio = nenhum motivo registrado. JSON: o mapa `{ "<ação>": "<motivo>" }` (só as ações com motivo), ou `null` |
| registrado_em | data-hora | Quando o registro foi criado no sistema |

### producoes

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| producao_id | UUID | Identificador da colheita |
| colonia_id / colonia_codigo / especie_codigo | | Colônia de origem |
| data_colheita | data-hora | UTC |
| tipo_produto | texto | `mel`, `polen`, `propolis`, `cera` |
| quantidade | número | Na unidade da coluna seguinte |
| unidade | texto | `ml` (volume) ou `g` (massa) |
| cor / aroma / sabor | texto | Características sensoriais (opcionais) |
| n_fotos | inteiro | Fotos vinculadas |
| observacoes | texto | Livre |
| registrado_em | data-hora | Auditoria |

### historico-status

Uma linha por mudança efetiva de status de colônia, registrada a partir de
06/11/2026. Mudanças anteriores não foram registradas e **não são
reconstituídas**: para elas só existe o status atual em `colonias`.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| historico_id | UUID | Identificador da entrada |
| colonia_id / colonia_codigo / especie_codigo | | Colônia |
| status_anterior / status_novo | texto | `ativa`, `inativa`, `morta`. `status_anterior` vazio = desconhecido: a entrada nasceu de uma correção numa colônia que ainda não tinha histórico (criada já inativa/morta, ou que mudou de status antes de 06/11/2026); `status_novo` é o status que ela tinha na correção |
| data_percebida | data-hora | "Data em que percebi" a mudança (padrão: o dia do registro). É um limite superior da data real; o limite inferior vem da última inspeção com a colônia ativa |
| motivo | texto | Vocabulário abaixo. Vazio = não registrado |
| motivo_detalhe | texto | Texto livre |
| classe_motivo | texto | `evento` ou `censura`; vazio sem motivo ou com motivo sem classe |
| registrado_em | data-hora | Quando a mudança foi registrada no sistema |
| atualizado_em | data-hora | Última alteração da entrada; difere de `registrado_em` quando a entrada foi corrigida |

Uma correção (motivo ou data trocados sem mudar o status) altera a última
entrada, não cria outra; o valor anterior não é guardado (`atualizado_em` indica
que houve correção). Sem nenhuma entrada, a correção cria a primeira (com
`status_anterior` vazio); se ela não traz data, `data_percebida` é o
`status_desde` que a colônia já tinha ou, sem ele, o momento da correção.

*Limite para análise de sobrevivência:* uma entrada seguida de outra com motivo
`correcao_registro` foi um registro errado (a colônia não chegou a mudar de
status), e o par deve ser **anulado**: não conte a primeira como evento nem
como censura.

### protocolos (JSON)

`{ metadados, dados: [{ protocoloId, hash, templateCodigo, templateVersao, nAvaliacoes, criadoEm, conteudo }] }`.
`conteudo` é o objeto canônico `{ versao: 1, itens: [{ nome, criterioBom, criterioMedio, criterioRuim, especieCodigo }] }`
(ver metodologia). Junte com `avaliacoes` por `protocolo_hash` = `hash`.

### Vocabulários

Códigos estáveis em `snake_case` (fonte única: `app/backend/src/shared/vocabularios.ts`).
Código fora da lista é recusado pela API (400). Todos os campos são opcionais.

**Motivo da mudança de status** (`motivo_status`, `motivo`). Cada código só vale
para o status novo indicado; `outro` vale para qualquer um.

| Status novo | Código | Rótulo | Classe |
|---|---|---|---|
| morta | `fome_escassez` | Fome / falta de alimento | evento |
| morta | `frio` | Frio | evento |
| morta | `pragas_predadores` | Pragas ou predadores (forídeos, formigas...) | evento |
| morta | `intoxicacao_suspeita` | Intoxicação suspeita (agrotóxico) | evento |
| morta | `orfandade` | Sem rainha / orfandade | evento |
| morta | `falha_divisao` | Divisão não vingou | evento |
| morta | `desconhecida` | Causa desconhecida | evento |
| inativa | `abandono` | A colônia abandonou a caixa | evento |
| inativa | `roubo_perda` | Roubo ou perda da caixa | censura |
| inativa | `venda_doacao` | Venda ou doação | censura |
| inativa | `uniao` | Unida a outra colônia | censura |
| ativa | `recuperada` | Voltou a ser ativa | — |
| ativa | `correcao_registro` | Correção de registro | — |
| qualquer | `outro` | Outro (texto) | conforme o status: morta = evento, inativa = censura, ativa = — |

**Evento** é desfecho (morte, perda da colônia); **censura** é saída do manejo
(venda, doação, união, roubo): a análise de sobrevivência para de acompanhar a
colônia sem que ela tenha morrido. `outro` em `inativa` é classificado como
censura porque a única inativação que é evento (`abandono`) tem código próprio;
confira `motivo_detalhe` antes de usar essas linhas.

**Motivo da inspeção** (`motivo_inspecao`): `rotina` (Rotina),
`problema_observado` (Algo chamou atenção), `retorno_acao` (Retorno após uma
ação), `outro` (texto em `motivo_inspecao_detalhe`).

**Motivo da ação** (`motivos_acoes`): `preventiva` (calendário, estação, rotina)
ou `resposta_problema` (resposta a um problema observado).

**Procedência do clima** (`clima_fonte`), definida pelo sistema:
`api_previsao` (Open-Meteo Forecast), `api_historico` (Open-Meteo Archive/ERA5),
`digitado` (o usuário informou ou alterou algum dos três campos de clima; um valor
da API editado vira `digitado`; reenviar o mesmo valor não muda a procedência).
Vazio = sem clima, ou avaliação anterior a 06/11/2026.

### backup (JSON)

`metadados`, `usuario` (sem senha, com meliponário), `parametros` (com critérios
por espécie), `colonias`, `avaliacoes` (com parâmetros), `producoes`, `fotos`
(metadados + `url`), `historicoStatus` e `protocolos`. Os campos que o banco guarda como JSON em texto já saem
convertidos em objeto. Os arquivos de imagem **não** entram no JSON (a
exportação em zip ainda está pendente).

### parâmetros (JSON reimportável)

`GET /parametros/exportar` gera `corbicula-parametros-<AAAA-MM-DD>.json`, aceito
de volta por `POST /parametros/importar` (`{ "modo": "mesclar" | "substituir", "dados": <arquivo> }`).
Serve para documentar e compartilhar o **protocolo de coleta**: quem importa
avalia com os mesmos critérios.

```json
{
  "formato": "corbicula-parametros",
  "versao": 1,
  "exportadoEm": "2026-11-03T22:00:00.000Z",
  "metodologia": "…",
  "parametros": [
    {
      "nome": "Sanidade", "ativo": true,
      "criterioBom": "…", "criterioMedio": "…", "criterioRuim": "…",
      "criteriosEspecie": [{ "especie": "TETRANGU", "criterioBom": "…", "criterioMedio": "…", "criterioRuim": "…" }]
    }
  ]
}
```

- `especie` é o código Kew (estável entre instalações; o UUID não é). Códigos
  desconhecidos são ignorados e listados na resposta (`especiesIgnoradas`).
- Ao importar, parâmetro com o mesmo nome (sem diferenciar maiúsculas/acentos)
  **mantém os critérios do usuário** — o arquivo nunca altera o significado de
  avaliações já feitas. "substituir" desativa (não exclui) os que ficam de fora.
- Templates prontos: `GET /parametros/templates` (cada um com `versao`).

---

## Metodologia

**Score da avaliação**

```
score_geral = round((n_bom × 100 + n_medio × 50 + n_ruim × 0) / n_parametros)
80–100 excelente | 60–79 boa | 40–59 atencao | 0–39 critica
```

Os parâmetros e seus critérios Bom/Médio/Ruim são definidos por cada usuário,
então scores de usuários diferentes só são comparáveis se usarem o mesmo conjunto
de parâmetros. Para análises entre meliponários, prefira as colunas
`parametro_nome` + `classificacao`, e compare apenas avaliações com o mesmo
`protocolo_hash`.

**Protocolo da avaliação.** Ao criar a avaliação, o servidor registra o protocolo
vigente: os parâmetros avaliados e o texto dos critérios Bom/Médio/Ruim
aplicados, já com o critério específico da espécie da colônia quando existe. O
conteúdo canônico é `{ versao: 1, itens }`, com `itens` = esses parâmetros
ordenados pelo nome normalizado (minúsculas, sem acentos), cada item com
`{ nome, criterioBom, criterioMedio, criterioRuim, especieCodigo }`
(`especieCodigo` vazio quando vale o critério genérico). Cada texto entra em
Unicode NFC e sem espaços nas pontas, para que o mesmo texto visível (acento
composto ou decomposto, espaço sobrando) dê o mesmo hash. `hash` = SHA-256 do
`JSON.stringify` desse objeto. Não entram ids nem a ordem dos parâmetros, então
o mesmo hash indica os mesmos critérios em qualquer meliponário. `versao` muda
se a forma canônica mudar; hashes de versões diferentes não se comparam.
Avaliações com o mesmo conteúdo compartilham o protocolo.
- Editar um critério depois **não** altera o protocolo de avaliações já feitas;
  a próxima avaliação recebe outro protocolo. Um "Bom" de antes e um de depois da
  mudança têm hashes diferentes.
- Na edição de uma avaliação, o protocolo só é resolvido de novo quando muda o
  conjunto de parâmetros avaliados, com os critérios vigentes no momento da
  edição para todos os parâmetros (inclusive os que já estavam na avaliação).
- Uma avaliação feita offline recebe o protocolo vigente quando é sincronizada.
  Se os critérios mudaram entre a inspeção e a sincronização, o protocolo
  registrado é o novo.
- `templateCodigo`/`templateVersao` são preenchidos quando o conjunto avaliado tem
  exatamente os parâmetros de um template publicado (`GET /parametros/templates`),
  com os mesmos textos; vale a maior versão compatível. Avaliar só parte de um
  template não conta como o template.
- Avaliações anteriores a 06/11/2026 ficam sem protocolo: não se sabe quais
  critérios estavam vigentes.

**Motivos e mortalidade.** O motivo da inspeção e o motivo de cada ação existem
para separar o efeito de uma ação da regressão à média: uma colônia inspecionada
porque `problema_observado` tende a melhorar na inspeção seguinte mesmo sem ação.
Compare antes/depois só dentro do mesmo motivo. Para mortalidade, use
`historico-status` (data percebida + classe), não a contagem de colônias com
status `morta`, e anule as entradas desfeitas por uma seguinte com
`correcao_registro`. Motivos nunca entram no score. Ver o segundo eixo de
`docs/efetividade.md`.

**Clima.** Quando o usuário não informa, `temperatura_c`, `umidade_pct` e
`condicao_climatica` vêm da [Open-Meteo](https://open-meteo.com) para a hora UTC
da avaliação, na coordenada da colônia (fallback: meliponário). Avaliações até 5
dias atrás usam a Forecast API; as mais antigas usam a Archive API (reanálise
ERA5). `condicao_climatica` é derivada do código WMO 4677 (0–1 ensolarado;
2–3, neblina e neve nublado; garoa, chuva, pancadas e trovoadas chuvoso). Dados
climáticos: Open-Meteo.com, licença CC BY 4.0.
A coluna `clima_fonte` indica a procedência de cada avaliação (desde
06/11/2026). Quando o usuário informa o clima, a API não sobrescreve. Editar a
data de uma avaliação não busca o clima de novo.

**Produção.** Quantidades em unidades diferentes (ml × g) nunca são somadas:
converter volume em massa exige a densidade medida. O resumo
(`GET /producoes/resumo`) agrupa por (tipo_produto, unidade) e usa médias
aritméticas simples.

**Espécies.** `especie_codigo` segue o padrão Kew: 4 letras do gênero + 4 do
epíteto específico (+ `_` + 4 da subespécie). Ver `docs/especies.md`.
