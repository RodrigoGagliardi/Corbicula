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
| `GET /exportacao/avaliacoes` | `formato`, `coloniaId`, `desde`, `ate` | Uma linha por **avaliação × parâmetro** (formato longo) |
| `GET /exportacao/producoes` | `formato`, `coloniaId`, `tipoProduto`, `desde`, `ate` | Uma linha por colheita |
| `GET /exportacao/backup` | — | JSON estruturado com todos os dados do usuário |

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
| especie_codigo | texto | Código Kew da espécie (vazio se não identificada) |
| especie_nome_cientifico / especie_nome_popular | texto | Da tabela de espécies |
| data_entrada | data-hora | Entrada da colônia no meliponário |
| origem | texto | `captura`, `compra`, `divisao`, `resgate` |
| tipo_caixa | texto | `INPA`, `PNN`, `Schenck`, `tronco`, `outro` |
| caixa_altura / caixa_largura / caixa_profundidade | número | Dimensões informadas pelo usuário (unidade não padronizada no app) |
| localizacao | texto | Descrição livre da posição |
| latitude / longitude | número | Graus decimais (WGS84) |
| colonia_mae_id / colonia_mae_codigo | UUID / texto | Genealogia (divisão) |
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
| duracao_minutos | inteiro | Opcional |
| temperatura_c | número | °C, 1 casa decimal |
| umidade_pct | número | Umidade relativa, % |
| condicao_climatica | texto | `ensolarado`, `nublado`, `chuvoso` |
| score_geral | inteiro | 0–100 (ver metodologia) |
| status_geral | texto | `excelente`, `boa`, `atencao`, `critica` |
| n_parametros | inteiro | Nº de parâmetros na avaliação (denominador do score) |
| parametro_id / parametro_nome | UUID / texto | Parâmetro avaliado (definido pelo usuário) |
| classificacao | texto | `bom`, `medio`, `ruim` |
| classificacao_pontos | inteiro | 100 / 50 / 0 |
| valor_numerico | inteiro | Opcional, se o usuário registrou uma contagem |
| observacoes_parametro | texto | Livre |
| observacoes_gerais | texto | Livre |
| acoes_tomadas | texto | Lista separada por ` \| ` |
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

### backup (JSON)

`metadados`, `usuario` (sem senha, com meliponário), `parametros` (com critérios
por espécie), `colonias`, `avaliacoes` (com parâmetros), `producoes`, `fotos`
(metadados + `url`). Os campos que o banco guarda como JSON em texto já saem
convertidos em objeto. Os arquivos de imagem **não** entram no JSON (a
exportação em zip ainda está pendente).

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
`parametro_nome` + `classificacao`.

**Clima.** Quando o usuário não informa, `temperatura_c`, `umidade_pct` e
`condicao_climatica` vêm da [Open-Meteo](https://open-meteo.com) para a hora UTC
da avaliação, na coordenada da colônia (fallback: meliponário). Avaliações até 5
dias atrás usam a Forecast API; as mais antigas usam a Archive API (reanálise
ERA5). `condicao_climatica` é derivada do código WMO 4677 (0–1 ensolarado;
2–3, neblina e neve nublado; garoa, chuva, pancadas e trovoadas chuvoso). Dados
climáticos: Open-Meteo.com, licença CC BY 4.0.
*Limitação atual:* o export ainda não indica se o valor veio da API ou foi
digitado.

**Produção.** Quantidades em unidades diferentes (ml × g) nunca são somadas:
converter volume em massa exige a densidade medida. O resumo
(`GET /producoes/resumo`) agrupa por (tipo_produto, unidade) e usa médias
aritméticas simples.

**Espécies.** `especie_codigo` segue o padrão Kew: 4 letras do gênero + 4 do
epíteto específico (+ `_` + 4 da subespécie). Ver `docs/especies.md`.
