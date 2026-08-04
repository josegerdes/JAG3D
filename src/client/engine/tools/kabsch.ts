import { Matrix3, Matrix4, Quaternion, Vector3 } from "three";

/**
 * Algoritmo de Kabsch: dado N (>=3) pares de pontos correspondentes entre duas malhas, calcula a
 * transformacao rigida (rotacao + translacao, sem escala) que melhor alinha o conjunto "source" ao
 * conjunto "target" no sentido de minimos quadrados. E o alinhamento manual por pontos ("N-point
 * alignment", estilo exocad/Meshmixer) — Fase 1; ICP automatico de refinamento fica pra depois.
 */
export function computeRigidAlignment(source: Vector3[], target: Vector3[]): Matrix4 {
  if (source.length < 3 || source.length !== target.length) {
    throw new Error("Alinhamento manual precisa de pelo menos 3 pares de pontos correspondentes");
  }

  const sourceCentroid = centroid(source);
  const targetCentroid = centroid(target);

  const sourceCentered = source.map((p) => p.clone().sub(sourceCentroid));
  const targetCentered = target.map((p) => p.clone().sub(targetCentroid));

  // Matriz de covariancia H = sum(source_i * target_i^T)
  const h = new Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);
  for (let i = 0; i < sourceCentered.length; i += 1) {
    const s = sourceCentered[i]!;
    const t = targetCentered[i]!;
    addOuterProduct(h, s, t);
  }

  const { u, vt } = svd3(h);
  // R = V * U^T, com correcao de determinante negativo (reflexao) pra garantir rotacao propria.
  const det = determinant3(multiply3(vt.clone().transpose(), u.clone().transpose()));
  const d = new Matrix3().set(1, 0, 0, 0, 1, 0, 0, 0, det < 0 ? -1 : 1);
  const rotation3 = multiply3(multiply3(vt.clone().transpose(), d), u.clone().transpose());

  const quaternion = quaternionFromMatrix3(rotation3);
  const rotationMatrix = new Matrix4().makeRotationFromQuaternion(quaternion);

  const rotatedSourceCentroid = sourceCentroid.clone().applyMatrix4(rotationMatrix);
  const translation = targetCentroid.clone().sub(rotatedSourceCentroid);

  return rotationMatrix.setPosition(translation);
}

function centroid(points: Vector3[]): Vector3 {
  const sum = points.reduce((acc, p) => acc.add(p), new Vector3());
  return sum.divideScalar(points.length);
}

function addOuterProduct(target: Matrix3, a: Vector3, b: Vector3): void {
  const e = target.elements;
  e[0] += a.x * b.x;
  e[3] += a.x * b.y;
  e[6] += a.x * b.z;
  e[1] += a.y * b.x;
  e[4] += a.y * b.y;
  e[7] += a.y * b.z;
  e[2] += a.z * b.x;
  e[5] += a.z * b.y;
  e[8] += a.z * b.z;
}

function multiply3(a: Matrix3, b: Matrix3): Matrix3 {
  return a.clone().multiply(b);
}

function determinant3(m: Matrix3): number {
  return m.determinant();
}

function quaternionFromMatrix3(m: Matrix3): Quaternion {
  const m4 = new Matrix4();
  const e = m.elements;
  // Matrix3 do three.js e column-major, igual Matrix4 — copia direta pros 9 componentes de rotacao.
  m4.set(e[0]!, e[3]!, e[6]!, 0, e[1]!, e[4]!, e[7]!, 0, e[2]!, e[5]!, e[8]!, 0, 0, 0, 0, 1);
  return new Quaternion().setFromRotationMatrix(m4);
}

/**
 * SVD 3x3 via metodo de Jacobi sobre H^T*H (suficiente para o caso de matriz 3x3 do Kabsch — nao e
 * uma SVD geral de proposito, so o necessario pra decompor a matriz de covariancia aqui).
 */
function svd3(h: Matrix3): { u: Matrix3; vt: Matrix3 } {
  const hth = multiply3(h.clone().transpose(), h);
  const { eigenvectors, eigenvalues } = jacobiEigen3(hth);

  const singularValues = eigenvalues.map((v) => Math.sqrt(Math.max(v, 0)));
  const v = eigenvectors;

  const uCols: Vector3[] = [];
  for (let i = 0; i < 3; i += 1) {
    const vCol = new Vector3(v.elements[i * 3]!, v.elements[i * 3 + 1]!, v.elements[i * 3 + 2]!);
    const sigma = singularValues[i]!;
    if (sigma < 1e-10) {
      uCols.push(vCol);
    } else {
      uCols.push(vCol.clone().applyMatrix3(h).divideScalar(sigma));
    }
  }
  const u = new Matrix3().set(
    uCols[0]!.x, uCols[1]!.x, uCols[2]!.x,
    uCols[0]!.y, uCols[1]!.y, uCols[2]!.y,
    uCols[0]!.z, uCols[1]!.z, uCols[2]!.z
  );
  const vt = v.clone().transpose();
  return { u, vt };
}

/** Diagonalizacao de uma matriz simetrica 3x3 por rotacoes de Jacobi — poucas iteracoes bastam pra
 *  convergir em matrizes 3x3. */
function jacobiEigen3(m: Matrix3): { eigenvectors: Matrix3; eigenvalues: number[] } {
  const a = m.clone();
  const v = new Matrix3().identity();

  for (let iter = 0; iter < 50; iter += 1) {
    const { p, q, offDiagMax } = largestOffDiagonal(a);
    if (offDiagMax < 1e-12) break;
    jacobiRotate(a, v, p, q);
  }

  const eigenvalues = [a.elements[0]!, a.elements[4]!, a.elements[8]!];
  return { eigenvectors: v, eigenvalues };
}

function largestOffDiagonal(a: Matrix3): { p: number; q: number; offDiagMax: number } {
  const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
  let best = { p: 0, q: 1, offDiagMax: 0 };
  for (const [p, q] of pairs) {
    const value = Math.abs(a.elements[p * 3 + q]!);
    if (value > best.offDiagMax) best = { p, q, offDiagMax: value };
  }
  return best;
}

function jacobiRotate(a: Matrix3, v: Matrix3, p: number, q: number): void {
  const app = a.elements[p * 3 + p]!;
  const aqq = a.elements[q * 3 + q]!;
  const apq = a.elements[p * 3 + q]!;
  if (Math.abs(apq) < 1e-14) return;

  const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
  const c = Math.cos(phi);
  const s = Math.sin(phi);

  for (let i = 0; i < 3; i += 1) {
    const aip = a.elements[i * 3 + p]!;
    const aiq = a.elements[i * 3 + q]!;
    a.elements[i * 3 + p] = c * aip - s * aiq;
    a.elements[i * 3 + q] = s * aip + c * aiq;
  }
  for (let i = 0; i < 3; i += 1) {
    const api = a.elements[p * 3 + i]!;
    const aqi = a.elements[q * 3 + i]!;
    a.elements[p * 3 + i] = c * api - s * aqi;
    a.elements[q * 3 + i] = s * api + c * aqi;
  }
  for (let i = 0; i < 3; i += 1) {
    const vip = v.elements[i * 3 + p]!;
    const viq = v.elements[i * 3 + q]!;
    v.elements[i * 3 + p] = c * vip - s * viq;
    v.elements[i * 3 + q] = s * vip + c * viq;
  }
}
