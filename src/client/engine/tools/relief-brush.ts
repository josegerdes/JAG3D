import { Mesh, SphereGeometry, Vector3 } from "three";

import { makeDefaultMaterial } from "@/client/engine/loaders";
import { performBooleanOp } from "@/client/engine/tools/boolean-cut";

export type ReliefDirection = "raise" | "indent";

/**
 * Alivio, ponto unico: uma esfera posicionada no ponto/normal escolhido, unida (raise) ou
 * subtraida (indent) via o mesmo motor booleano do corte (`performBooleanOp`).
 */
export function createReliefBrush(point: Vector3, normal: Vector3, radius: number, direction: ReliefDirection): Mesh {
  const geometry = new SphereGeometry(radius, 32, 24);
  const brush = new Mesh(geometry, makeDefaultMaterial());
  const offset = direction === "raise" ? radius * 0.35 : -radius * 0.35;
  brush.position.copy(point).addScaledVector(normal.clone().normalize(), offset);
  return brush;
}

/**
 * Alivio em pincel (arraste continuo, estilo exocad/Meshmixer): em vez de rodar um boolean pesado
 * contra a malha alvo a cada `pointermove` (caro pra malhas reais de scanner), acumula amostras do
 * trajeto localmente e monta UMA unica malha-pincel (uniao das esferas do trajeto — operacao barata,
 * so entre primitivas pequenas) quando o traco termina. O boolean caro contra a malha alvo roda
 * UMA vez por traco, nao uma vez por frame.
 */
export function buildStrokeBrush(points: Vector3[], normals: Vector3[], radius: number, direction: ReliefDirection): Mesh {
  if (points.length === 0) throw new Error("Traco vazio");

  let combined = createReliefBrush(points[0]!, normals[0]!, radius, direction);
  for (let i = 1; i < points.length; i += 1) {
    const stamp = createReliefBrush(points[i]!, normals[i]!, radius, direction);
    combined = performBooleanOp(combined, stamp, "union");
    stamp.geometry.dispose();
  }
  return combined;
}

/** Distancia minima entre amostras do trajeto — evita acumular centenas de esferas quase
 *  coincidentes num arraste lento, sem perder resolucao num arraste rapido. */
export const STROKE_MIN_SAMPLE_DISTANCE = 0.6;
