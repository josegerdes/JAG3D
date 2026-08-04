import { Brush, Evaluator, ADDITION, INTERSECTION, SUBTRACTION } from "three-bvh-csg";
import { Mesh } from "three";

export type BooleanOp = "subtract" | "union" | "intersect";

const OP_MAP: Record<BooleanOp, number> = { subtract: SUBTRACTION, union: ADDITION, intersect: INTERSECTION };

const evaluator = new Evaluator();

/**
 * Corte booleano via `three-bvh-csg` — opera direto em `BufferGeometry`, reaproveitando a mesma
 * BVH usada pro picking (ver ARCHITECTURE.md). Roda no thread principal por enquanto; a fronteira
 * de Web Worker (via `comlink`) fica pra quando malhas reais de scanner (centenas de milhares de
 * triangulos) mostrarem travamento perceptivel — ver nota de risco em ARCHITECTURE.md sobre
 * `manifold-3d` como alternativa se a saida ficar nao-manifold em scans com topologia suja.
 */
export function performBooleanOp(target: Mesh, tool: Mesh, op: BooleanOp): Mesh {
  const targetBrush = new Brush(target.geometry.clone());
  targetBrush.position.copy(target.position);
  targetBrush.quaternion.copy(target.quaternion);
  targetBrush.scale.copy(target.scale);
  targetBrush.updateMatrixWorld(true);

  const toolBrush = new Brush(tool.geometry.clone());
  toolBrush.position.copy(tool.position);
  toolBrush.quaternion.copy(tool.quaternion);
  toolBrush.scale.copy(tool.scale);
  toolBrush.updateMatrixWorld(true);

  const result = evaluator.evaluate(targetBrush, toolBrush, OP_MAP[op]);
  result.geometry.computeVertexNormals();
  return result;
}
