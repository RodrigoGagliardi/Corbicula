// Compressão de foto no navegador antes do upload (claude.md §8): foto de
// celular tem 3–8 MB; o alvo é ~200–500 KB, o que torna o envio rápido mesmo
// em 3G/4G fraco no campo. Sem dependências: canvas nativo.

const LADO_MAXIMO = 1600;
const ALVO_BYTES = 500 * 1024;

export async function comprimirImagem(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  // Reduz a qualidade até caber no alvo (ou chegar ao piso de 0,5).
  let qualidade = 0.85;
  let blob = await paraBlob(canvas, qualidade);
  while (blob.size > ALVO_BYTES && qualidade > 0.5) {
    qualidade -= 0.1;
    blob = await paraBlob(canvas, qualidade);
  }
  return blob;
}

function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao comprimir"))), "image/jpeg", qualidade)
  );
}
