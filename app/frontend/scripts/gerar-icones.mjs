// Gera os ícones do PWA e o favicon.svg sem dependências externas
// (rasterização própria + encoder PNG com zlib). O desenho reproduz os logos
// oficiais (public/icons/Logo Corbicula*.png): favo de 7 hexágonos "flat-top"
// amarelo #fff000 com contorno preto, bordas compartilhadas entre vizinhos.
// Rode com `npm run icones` após alterar o desenho.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const AMARELO = [255, 240, 0]; // #fff000 — cor exata do logo
const PRETO = [0, 0, 0];
const VERDE = [74, 157, 63]; // #4a9d3f — fundo dos ícones (folhagem)

// ─── Geometria ────────────────────────────────────────────────────────────────

const RAIZ3 = Math.sqrt(3);

// Centros do favo para hexágonos de raio r (flat-top): o central + 6 vizinhos
// a distância r·√3, nos ângulos 30°, 90°, 150°...
function centros(cx, cy, r) {
  const lista = [[cx, cy]];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (Math.PI / 3) * i;
    lista.push([cx + r * RAIZ3 * Math.cos(a), cy + r * RAIZ3 * Math.sin(a)]);
  }
  return lista;
}

// Ponto dentro de um hexágono flat-top de raio r centrado em (cx, cy).
function dentroHex(x, y, cx, cy, r) {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  return dy <= (RAIZ3 / 2) * r && RAIZ3 * dx + dy <= RAIZ3 * r;
}

// O favo ocupa 5r de largura e 3√3·r de altura (+ contorno).
// `ocupacao`: fração do lado do ícone que o desenho ocupa.
// `contorno`: espessura do traço em relação ao raio (logo original: ~0,077).
function favo(tamanho, ocupacao, contorno) {
  const r = (tamanho * ocupacao) / (3 * RAIZ3 + contorno);
  return { r, traco: r * contorno, centros: centros(tamanho / 2, tamanho / 2, r) };
}

function corNoPonto(x, y, { r, traco, centros }, fundo) {
  const meio = traco / 2;
  if (centros.some(([cx, cy]) => dentroHex(x, y, cx, cy, r - meio))) {
    // dentro do miolo de algum hexágono, mas ainda pode cair na faixa do traço de um vizinho
    const naBorda = centros.some(([cx, cy]) => dentroHex(x, y, cx, cy, r + meio) && !dentroHex(x, y, cx, cy, r - meio));
    return naBorda ? PRETO : AMARELO;
  }
  if (centros.some(([cx, cy]) => dentroHex(x, y, cx, cy, r + meio))) return PRETO;
  return fundo;
}

// ─── Rasterização com supersampling 4×4 ──────────────────────────────────────

function desenhar(tamanho, { ocupacao = 0.8, contorno = 0.09, cantos = 0.22, fundo = VERDE } = {}) {
  const geo = favo(tamanho, ocupacao, contorno);
  const raio = tamanho * cantos;
  const px = Buffer.alloc(tamanho * tamanho * 4);
  const S = 4;

  const noFundoArredondado = (x, y) => {
    if (raio === 0) return true;
    const dx = Math.max(raio - x, 0, x - (tamanho - raio));
    const dy = Math.max(raio - y, 0, y - (tamanho - raio));
    return dx * dx + dy * dy <= raio * raio;
  };

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      let [r, g, b, a] = [0, 0, 0, 0];
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const fx = x + (sx + 0.5) / S;
          const fy = y + (sy + 0.5) / S;
          if (!noFundoArredondado(fx, fy)) continue;
          const cor = corNoPonto(fx, fy, geo, fundo);
          if (!cor) continue; // fundo transparente
          r += cor[0];
          g += cor[1];
          b += cor[2];
          a += 255;
        }
      }
      const n = S * S;
      const i = (y * tamanho + x) * 4;
      const cobertura = a / 255;
      px[i] = cobertura ? Math.round(r / cobertura) : 0;
      px[i + 1] = cobertura ? Math.round(g / cobertura) : 0;
      px[i + 2] = cobertura ? Math.round(b / cobertura) : 0;
      px[i + 3] = Math.round(a / n);
    }
  }
  return px;
}

// ─── Favicon SVG (mesma geometria, fundo transparente) ────────────────────────

function faviconSvg() {
  const lado = 64;
  const contorno = 0.16; // traço mais grosso: o favicon é exibido a 16–32 px
  const { r, traco, centros: cs } = favo(lado, 0.94, contorno);
  const f = (n) => Number(n.toFixed(2));
  const hex = ([cx, cy]) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`;
    }).join(" ");
  const poligonos = cs.map((c) => `    <polygon points="${hex(c)}"/>`).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}">
  <!-- Gerado por scripts/gerar-icones.mjs — não editar à mão -->
  <g fill="#fff000" stroke="#000" stroke-width="${f(traco)}" stroke-linejoin="round">
${poligonos}
  </g>
</svg>
`;
}

// ─── Encoder PNG (RGBA 8 bits) ────────────────────────────────────────────────

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dados) {
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tam, corpo, crc]);
}

function png(tamanho, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 6; // RGBA
  const linhas = Buffer.alloc((tamanho * 4 + 1) * tamanho);
  for (let y = 0; y < tamanho; y++) {
    linhas[y * (tamanho * 4 + 1)] = 0; // filtro "none"
    rgba.copy(linhas, y * (tamanho * 4 + 1) + 1, y * tamanho * 4, (y + 1) * tamanho * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(linhas, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Saída ────────────────────────────────────────────────────────────────────

const destino = new URL("../public/icons/", import.meta.url);
const icones = [
  // ícones comuns: só o favo, fundo transparente
  ["icon-192.png", 192, { ocupacao: 0.94, fundo: null }],
  ["icon-512.png", 512, { ocupacao: 0.94, fundo: null }],
  // maskable e iOS exigem fundo opaco (o sistema recorta o ícone ou preenche a
  // transparência de preto), então usam fundo preto.
  // maskable: fundo cheio (sem cantos) e favo dentro do círculo da zona segura (80%)
  ["icon-maskable-512.png", 512, { ocupacao: 0.62, cantos: 0, fundo: PRETO }],
  ["apple-touch-icon.png", 180, { ocupacao: 0.74, cantos: 0, fundo: PRETO }],
];

for (const [nome, tamanho, opcoes] of icones) {
  writeFileSync(new URL(nome, destino), png(tamanho, desenhar(tamanho, opcoes)));
  console.log(`  [OK] public/icons/${nome}`);
}

writeFileSync(new URL("favicon.svg", destino), faviconSvg());
console.log("  [OK] public/icons/favicon.svg");
