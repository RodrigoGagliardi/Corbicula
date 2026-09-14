# docs/especies.md — Sistema de Códigos de Espécies

## Padrão de codificação (Kew)

**Formato:** 4 primeiras letras do **gênero** + 4 primeiras letras do **epíteto específico**, em maiúsculas. Para subespécie, acrescenta-se as 3–4 primeiras letras do epíteto infraespecífico.

Esse é o padrão de códigos de herbário/Index Kewensis, derivado diretamente do nome científico — reproduzível e sem arbitrariedade.

**Exemplos:**
- *Tetragonisca angustula* → `TETRANGU`
- *Melipona quadrifasciata* → `MELIQUAD`
- *Melipona bicolor schencki* → `MELIBICO_SCHE`
- *Plebeia nigriceps* → `PLEBNIGR`

> Quando dois nomes gerarem o mesmo código (colisão), desambiguar acrescentando
> uma letra a mais do epíteto. Nenhuma colisão ocorre na lista atual do RS.

---

## As 19 espécies do Rio Grande do Sul

### Tetragonisca (Jataís)

| Código | Nome científico | Nome popular |
|--------|-----------------|--------------|
| `TETRANGU` | *Tetragonisca angustula* | Jataí |
| `TETRFIEB` | *Tetragonisca fiebrigi* | Jataí-da-terra |

### Melipona (Mandaçaias, Guaraipos, Manduris)

| Código | Nome científico | Nome popular |
|--------|-----------------|--------------|
| `MELIQUAD` | *Melipona quadrifasciata* | Mandaçaia |
| `MELIBICO_SCHE` | *Melipona bicolor schencki* | Guaraipo |
| `MELIOBSC` | *Melipona obscurior* | Manduri |
| `MELIMARG` | *Melipona marginata* | Manduri / Rajada |

### Plebeia (Mirins)

| Código | Nome científico | Nome popular |
|--------|-----------------|--------------|
| `PLEBDROR` | *Plebeia droryana* | Mirim-droryana |
| `PLEBEMER` | *Plebeia emerina* | Mirim-emerina |
| `PLEBNIGR` | *Plebeia nigriceps* | Mirim-nigriceps |
| `PLEBREMO` | *Plebeia remota* | Mirim-remota |
| `PLEBCATA` | *Plebeia catamarcensis* | Mirim-catamarcense |
| `PLEBMERI` | *Plebeia meridionalis* | Mirim-meridional |
| `PLEBWITT` | *Plebeia wittmanni* | Mirim-wittmanni |

### Scaptotrigona (Tubunas, Canudos)

| Código | Nome científico | Nome popular |
|--------|-----------------|--------------|
| `SCAPBIPU` | *Scaptotrigona bipunctata* | Tubuna |
| `SCAPPOST` | *Scaptotrigona postica* | Mandaguari-preta |
| `SCAPXANT` | *Scaptotrigona xanthotricha* | Canudo |

### Outros gêneros

| Código | Nome científico | Nome popular |
|--------|-----------------|--------------|
| `NANNTEST` | *Nannotrigona testaceicornis* | Iraí |
| `TRIGSPIN` | *Trigona spinipes* | Irapuá |
| `LESTLIMA` | *Lestrimelitta limao* | Iratim / Abelha-limão |
| `LESTSULI` | *Lestrimelitta sulina* | Iratim-do-sul |
| `MOURCAER` | *Mourella caerulea* | Mirim-do-chão |
| `PARASUBN` | *Paratrigona subnuda* | Mirim-sem-brilho |

> Total: 21 registros (19 espécies + 1 subespécie destacada + variações). Ajuste conforme o escopo final desejado.

---

## Modelo Prisma (Especie)

```prisma
model Especie {
  id                Int       @id @default(autoincrement())
  codigo            String    @unique  // padrão Kew: TETRANGU
  nomePopular       String
  nomeCientifico    String    @unique
  genero            String
  especie           String              // epíteto específico
  subespecie        String?
  nomesAlternativos String?   @db.Text  // JSON array
  caracteristicas   String?   @db.Text  // JSON: tamanho, cor, comportamento, entrada, populacao
  ocorrenciaBiomas  String?   @db.Text  // JSON array
  statusConservacao String?             // LC, VU, EN
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  colonias Colonia[]

  @@index([codigo])
  @@index([genero])
  @@map("especies")
}
```

---

## Função de geração de código (referência)

Para o seed ou para cadastro de novas espécies, o código deve ser
**derivado**, não digitado à mão:

```typescript
function gerarCodigoKew(genero: string, especie: string, subespecie?: string): string {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const gen = norm(genero).slice(0, 4);
  const esp = norm(especie).slice(0, 4);
  let codigo = gen + esp;
  if (subespecie) codigo += '_' + norm(subespecie).slice(0, 4);
  return codigo;
}

// gerarCodigoKew('Tetragonisca', 'angustula')        → 'TETRANGU'
// gerarCodigoKew('Melipona', 'bicolor', 'schencki')  → 'MELIBICO_SCHE'
```

Guardar o código gerado em `especies.codigo`. Colônias referenciam a espécie por
`especie_id` (FK), então o código é usado para exibição/busca, não como chave
estrangeira.

---

## Seed (estrutura)

O seed percorre uma lista de espécies com `{ genero, especie, subespecie?,
nomePopular, nomesAlternativos, caracteristicas, ocorrenciaBiomas,
statusConservacao }` e gera o `codigo` via `gerarCodigoKew()` antes de inserir.
Isso garante que todos os códigos sigam o padrão sem risco de digitação manual
inconsistente.

Dados completos de características por espécie (tamanho, cor, comportamento,
tipo de entrada, população, biomas) estão documentados no seed
`app/backend/prisma/seed-especies.ts`.

---
