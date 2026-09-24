// Parse tolerante para campos JSON armazenados como texto no banco.
export function parsearJson<T>(valor: string | null, padrao: T): T {
  if (!valor) return padrao;
  try {
    return JSON.parse(valor) as T;
  } catch {
    return padrao;
  }
}
