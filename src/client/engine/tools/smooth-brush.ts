import { Mesh, Vector3 } from "three";

/**
 * Pincel de suavizacao: media ponderada por distancia dos vertices dentro do raio, estilo pincel
 * de escultura (nao Laplaciano de verdade — precisaria de topologia/vizinhanca real — mas
 * suficiente pra suavizar ruido de scan localmente, que e o uso pratico aqui).
 *
 * RISCO DE PERFORMANCE CONHECIDO: percorre TODOS os vertices da malha por chamada (O(n)), aceitavel
 * pra malhas de teste/pequenas. Pra scans reais de scanner intraoral (centenas de milhares de
 * vertices) isso precisa de uma busca espacial via `three-mesh-bvh` (`shapecast`) ou mover pra Web
 * Worker antes de ir pra producao — ver ARCHITECTURE.md.
 */
export function applySmoothBrush(mesh: Mesh, hitPointLocal: Vector3, radius: number, strength: number): boolean {
  const position = mesh.geometry.attributes.position;
  if (!position) return false;

  const radiusSq = radius * radius;
  const v = new Vector3();
  const indicesInRadius: number[] = [];

  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    if (v.distanceToSquared(hitPointLocal) <= radiusSq) indicesInRadius.push(i);
  }
  if (indicesInRadius.length < 3) return false;

  const centroid = new Vector3();
  for (const i of indicesInRadius) {
    v.fromBufferAttribute(position, i);
    centroid.add(v);
  }
  centroid.divideScalar(indicesInRadius.length);

  for (const i of indicesInRadius) {
    v.fromBufferAttribute(position, i);
    const dist = v.distanceTo(hitPointLocal);
    const falloff = 1 - Math.min(dist / radius, 1);
    v.lerp(centroid, strength * falloff);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  position.needsUpdate = true;
  return true;
}
