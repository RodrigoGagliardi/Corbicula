# Fluxos Detalhados: Fotos Opcionais + Clima Automático

## Parte A — API Climática (Open-Meteo)

### Por que Open-Meteo para o Corbicula

- Sem chave de API, sem cadastro, sem cartão — zero fricção para projeto pessoal
- Gratuito para uso não comercial até 10.000 chamadas/dia (você nunca chegará perto)
- Arquivo histórico desde 1940 (ERA5) — permite preencher clima de avaliações passadas
- Resolução de até 1 km — precisão suficiente para um meliponário
- Usa latitude/longitude diretamente (você já tem esses campos em `colonias` e `meliponarios`)
- Licença CC BY 4.0 → **atribuição obrigatória** (creditar na tela "Sobre")

### Dois endpoints que o projeto usa

**1. Forecast API (clima atual / últimos 5 dias)**
```
https://api.open-meteo.com/v1/forecast
  ?latitude=-30.03&longitude=-51.23
  &hourly=temperature_2m,relative_humidity_2m,weather_code
  &timezone=UTC
  &past_days=5
  &forecast_days=1
```
Usar para avaliações dos **últimos 5 dias ou hoje**. O parâmetro `past_days=5`
permite recuperar dados recentes sem precisar da Archive API. `timezone=UTC`
simplifica o matching de hora (sem conversão de fuso).

**2. Archive API (histórico ERA5 — dados > 5 dias atrás)**
```
https://archive-api.open-meteo.com/v1/archive
  ?latitude=-30.03&longitude=-51.23
  &start_date=2026-03-15&end_date=2026-03-15
  &hourly=temperature_2m,relative_humidity_2m,weather_code
  &timezone=UTC
```
Usar para avaliações **mais antigas que 5 dias** (dados ERA5 desde 1940).
Também usado para preencher retrospectivamente avaliações offline sincronizadas.

### Variáveis relevantes para meliponicultura

| Variável Open-Meteo | Uso no Corbicula |
|---------------------|------------------|
| `temperature_2m` | Temperatura da inspeção → campo `temperatura` em `Avaliacao` |
| `relative_humidity_2m` | Umidade relativa → campo `umidade` em `Avaliacao` |
| `weather_code` | Mapeado para `condicaoClimatica` (ensolarado/nublado/chuvoso) |
| `wind_speed_10m` | Não implementado no MVP — possível futuro para análise comportamental |

### Mapeamento de weather_code → condicao_climatica

O código WMO do Open-Meteo é numérico. Mapear para os valores que o
sistema já usa:
- 0 → ensolarado (céu limpo)
- 1, 2, 3 → parcialmente nublado / nublado
- 45, 48 → neblina
- 51–67, 80–82 → chuvoso
- 71–77, 85, 86 → neve (raro no RS, mas cobre)
- 95–99 → tempestade

### Estratégia de captura (o ponto-chave da efetividade)

O objetivo é **atrito zero**: o usuário nunca digita clima manualmente.

```
POST /colonias/:id/avaliacoes
      │
      ▼ Avaliação salva → resposta 201 retornada imediatamente
      │
      ▼ (void — assíncrono, não bloqueia)
      enriquecerComClima(avaliacaoId, coloniaId, dataAvaliacao)
      │
      ├─ Busca lat/lon da colônia
      │  └─ Fallback: lat/lon do meliponário do usuário
      │  └─ Sem coordenadas → encerra silenciosamente
      │
      ├─ dataAvaliacao ≤ 5 dias atrás → Forecast API (hourly + past_days)
      │  dataAvaliacao > 5 dias atrás → Archive API (ERA5)
      │
      └─ UPDATE avaliacao SET temperatura, umidade, condicaoClimatica
         (só executado se clima ainda não foi preenchido manualmente)
```

**Regra de ouro:** clima é sempre *enriquecimento automático*, nunca
requisito. Se a API falhar ou não houver coordenada, a avaliação já está
salva e os campos ficam nulos (editáveis como fallback). Nenhum erro
é propagado ao cliente.

### Onde fica no backend (Node.js)

Implementado em `src/services/weather.service.ts`:

```
src/services/weather.service.ts
  - buscarClima(lat, lon, dataHora)         → entry point público; roteia para Forecast ou Archive
  - buscarPrevisao(lat, lon, dataHora)      → Forecast API (≤ 5 dias)
  - buscarArquivo(lat, lon, dataHora)       → Archive API (> 5 dias)
  - mapearWMO(code)                         → "ensolarado" | "nublado" | "chuvoso"
  - enriquecerComClima(avaliacaoId, coloniaId, dataAvaliacao) → orquestra tudo + UPDATE no banco
```

Fluxo de integração: `avaliacoes.service.ts` salva a avaliação → dispara
`void enriquecerComClima(...)` de forma assíncrona → `weather.service.ts`
busca coordenadas, chama a API e atualiza o registro. Sem controller no meio —
o projeto usa arquitetura modular sem camada de controller separada.

### Cache para economizar chamadas

Clima do mesmo ponto + mesma hora não muda. Cachear por
(lat arredondada, lon arredondada, hora) evita chamadas repetidas quando
várias colônias do mesmo meliponário são avaliadas na mesma manhã.
Uma tabela simples ou cache em memória resolve. Reduz drasticamente o
volume de chamadas (uma manhã inteira de inspeções = 1 chamada, não 20).

### Atribuição obrigatória

Adicionar na tela "Sobre" ou rodapé:
"Dados meteorológicos por Open-Meteo.com (CC BY 4.0)"

---

## Parte B — Fotos como Opcional

### Princípio de design

Foto é a funcionalidade de **maior atrito** do sistema. Decisão:
mantê-la existente mas **nunca no caminho crítico**. O usuário que quer
documentar consegue; o usuário apressado nunca é bloqueado por ela.

### Mudança de conceito: "por parâmetro" → "por inspeção"

O modelo original permitia foto em cada parâmetro (3–8 fotos por
inspeção = irreal). Novo padrão:

- **1 foto-resumo opcional por inspeção** (o caso comum, baixo atrito)
- Foto por parâmetro **continua possível no schema**, mas escondida atrás
  de um "＋ adicionar foto" discreto (para o power user documentar uma
  praga específica, por exemplo)

O schema atual (tabela `fotos` com 3 FKs opcionais) **já suporta ambos**
sem alteração. É só uma decisão de interface, não de banco.

### Onde a foto aparece no fluxo de avaliação

```
Step 1: Selecionar colônia
Step 2: Dados da inspeção (clima já vem automático)
Step 3: Avaliar parâmetros (Bom/Médio/Ruim)  ← núcleo, rápido
        └─ cada parâmetro tem "＋ foto" discreto (opcional, recolhido)
Step 4: Observações gerais
        └─ "📷 Adicionar foto da inspeção" (1 toque, opcional)
Step 5: Ações tomadas
Step 6: Salvar  ← nunca exige foto
```

A foto **nunca** tem asterisco de obrigatório. O botão de salvar nunca
fica desabilitado por falta de foto.

### Tratamento técnico para reduzir atrito

**1. Compressão no cliente antes do upload**
Foto de celular tem 3–8 MB. Comprimir para ~200–500 KB no navegador
(antes de enviar) torna o upload rápido mesmo em 3G/4G fraco no campo.
Bibliotecas: `browser-image-compression` ou canvas nativo.

**2. Upload em background / offline-friendly**
No modo offline (PWA), a foto vai para a fila de sincronização
(`sync_queue`) como blob no IndexedDB. Sobe quando houver conexão.
O usuário não espera o upload terminar para continuar.

**3. Câmera direto, sem sair do fluxo**
No mobile, `<input type="file" accept="image/*" capture="environment">`
abre a câmera traseira direto. Um toque para fotografar, sem trocar de app.

### Regra de integridade da tabela fotos

Como a foto pode referenciar colônia, avaliação OU parâmetro, garantir
na aplicação (não no banco) que:
- Toda foto tem **pelo menos uma** referência (não fica órfã)
- A referência é definida pelo contexto onde foi tirada
  (foto no step 4 → avaliacao_id; foto num parâmetro → avaliacao_parametro_id)

Isso é validação no `fotos.service.ts`, já que o design de 3 FKs
opcionais não impede órfãs por si só.

### Armazenamento local (custo zero)

Como o projeto roda em Docker local:
- Fotos vão para um volume Docker (`uploads/`)
- Caminho salvo no campo `fotos.url`
- Comprimidas, ocupam pouco espaço (200 KB × milhares = alguns GB)

Se um dia for para nuvem, trocar o `upload.service` por S3/Cloudinary
sem mexer no resto.

---

## Resumo das decisões

| Item | Decisão |
|------|---------|
| API de clima | Open-Meteo (sem chave, histórico desde 1940, 1km) |
| Captura de clima | Automática via lat/long; manual só como fallback |
| Clima offline | Preenchido pelo Archive API ao sincronizar |
| Cache de clima | Por (lat, lon, hora) — 1 manhã = 1 chamada |
| Fotos | Opcionais, nunca bloqueiam, 1 por inspeção como padrão |
| Foto por parâmetro | Mantida no schema, escondida atrás de botão discreto |
| Compressão | No cliente, antes do upload (~200–500 KB) |
| Foto offline | Blob no IndexedDB → sync_queue → sobe com conexão |
| Atribuição | "Dados por Open-Meteo.com (CC BY 4.0)" na tela Sobre |