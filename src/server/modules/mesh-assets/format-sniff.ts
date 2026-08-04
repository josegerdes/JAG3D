import { MeshFormat } from "@/server/db/schema";

/**
 * Deteccao de formato pelos BYTES reais do arquivo — nunca confiar so na extensao ou no
 * `Content-Type` declarado pelo cliente (trivialmente falsificavel). STL e OBJ nao tem um numero
 * magico formal (STL pode ser texto ou binario; OBJ e sempre texto), entao a deteccao aqui e
 * heuristica de conteudo, nao um magic-byte estrito como PLY — documentado explicitamente para nao
 * passar a falsa impressao de uma garantia mais forte do que existe.
 */
export interface SniffResult {
  format: MeshFormat;
  triangleCount: number;
}

const PLY_MAGIC = Buffer.from("ply");

export function sniffMeshFormat(buffer: Buffer, declaredName: string): SniffResult {
  if (buffer.subarray(0, 3).equals(PLY_MAGIC)) {
    return { format: "ply", triangleCount: countPlyFaces(buffer) };
  }

  const binarySTL = trySniffBinarySTL(buffer);
  if (binarySTL) return binarySTL;

  const head = buffer.subarray(0, 4096).toString("utf8");
  if (/^\s*solid\b/.test(head) && /facet\s+normal/i.test(head)) {
    return { format: "stl", triangleCount: countAsciiSTLFacets(buffer) };
  }

  if (looksLikeObj(head)) {
    return { format: "obj", triangleCount: countObjFaces(buffer) };
  }

  const ext = declaredName.split(".").pop()?.toLowerCase();
  throw new Error(
    `Nao foi possivel identificar o formato do arquivo pelo conteudo (extensao declarada: .${ext ?? "?"}). ` +
      "Confirme que e um STL, PLY ou OBJ valido."
  );
}

/** STL binario: header de 80 bytes (arbitrario) + uint32 LE com a contagem de triangulos, cada
 *  triangulo ocupando exatamente 50 bytes depois disso. Tamanho do arquivo bate exato = forte sinal
 *  de que e binario (nao 100% infalivel, mas muito mais confiavel que so olhar a extensao). */
function trySniffBinarySTL(buffer: Buffer): SniffResult | null {
  if (buffer.length < 84) return null;
  const triangleCount = buffer.readUInt32LE(80);
  const expectedSize = 84 + triangleCount * 50;
  if (expectedSize === buffer.length) {
    return { format: "stl", triangleCount };
  }
  return null;
}

function countAsciiSTLFacets(buffer: Buffer): number {
  const text = buffer.toString("utf8");
  const matches = text.match(/facet\s+normal/gi);
  return matches?.length ?? 0;
}

function countPlyFaces(buffer: Buffer): number {
  const headerEnd = buffer.indexOf("end_header");
  const header = buffer.subarray(0, headerEnd > -1 ? headerEnd : Math.min(buffer.length, 8192)).toString("utf8");
  const match = header.match(/element\s+face\s+(\d+)/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

function looksLikeObj(head: string): boolean {
  const lines = head.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length === 0) return false;
  return lines.some((line) => /^(v|vn|vt|f|g|o|usemtl|mtllib)\s/.test(line));
}

function countObjFaces(buffer: Buffer): number {
  const text = buffer.toString("utf8");
  const matches = text.match(/^f\s+/gim);
  return matches?.length ?? 0;
}
