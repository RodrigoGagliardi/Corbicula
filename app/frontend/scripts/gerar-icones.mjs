// Gera os ícones PNG do PWA sem dependências externas (rasterização própria +
// encoder PNG com zlib). Desenho: favo hexagonal âmbar sobre fundo mel escuro,
// o mesmo do favicon.svg. Rode com `npm run icones` após alterar o desenho.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const FUNDO = [69, 26, 3]; // #451a03
const MEL = [245, 158, 11]; // #f59e0b
const CERA = [254, 243, 199]; // #fef3c7

// ─── Geometria ────────────────────────────────────────────────────────────────

function hexagono(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2; // vértice para cima
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

function dentro(x, y, poligono) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// Favo: 1 hexágono central + 6 ao redor (vizinhos de um hexágono "pointy-top").
function favo(tamanho, escala) {
  const c = tamanho / 2;
  const r = tamanho * 0.13 * escala;
  const passo = r * Math.sqrt(3) * 1.08;
  const centros = [[c, c]];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    centros.push([c + passo * Math.cos(a), c + passo * Math.sin(a)]);
  }
  return centros.map(([x, y], i) => ({ poligono: hexagono(x, y, r), cor: i === 0 ? CERA : MEL }));
}

// ─── Rasterização com supersampling 4×4 ──────────────────────────────────────

function desenhar(tamanho, { escala = 1, cantos = 0.22 } = {}) {
  const celulas = favo(tamanho, escala);
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
          const cel = celulas.find((c) => dentro(fx, fy, c.poligono));
          const cor = cel ? cel.cor : FUNDO;
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
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  // maskable: fundo cheio (sem cantos) e desenho dentro da zona segura (80%)
  ["icon-maskable-512.png", 512, { escala: 0.8, cantos: 0 }],
  ["apple-touch-icon.png", 180, { cantos: 0 }],
];

for (const [nome, tamanho, opcoes] of icones) {
  writeFileSync(new URL(nome, destino), png(tamanho, desenhar(tamanho, opcoes)));
  console.log(`  [OK] public/icons/${nome}`);
}
