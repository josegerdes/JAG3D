import { Quaternion, Vector3 } from "three";

import { RigidTransform } from "@/server/db/schema";

/**
 * Delta de transform representado explicitamente (nao "novo valor absoluto") de proposito: um
 * delta pode ser aplicado igualmente a uma malha vinculada sem o servidor precisar conhecer o
 * transform absoluto que o cliente tinha em mente — so soma/rotaciona/escala a partir do que ja
 * esta salvo. E o que permite `commitOperation()` propagar o mesmo movimento pras irmas de um
 * conjunto vinculado (`linkedGroupId`) sem o cliente precisar listar cada uma explicitamente.
 */
export interface TransformDelta {
  deltaPosition: [number, number, number];
  /** Aplicado como rotacao em espaco de mundo: newRot = deltaQuaternion * oldRot. */
  deltaQuaternion: [number, number, number, number];
  /** Multiplicativo. */
  deltaScale: [number, number, number];
}

export function applyDelta(base: RigidTransform, delta: TransformDelta): RigidTransform {
  const basePos = new Vector3(...base.position);
  const baseQuat = new Quaternion(...base.quaternion);
  const baseScale = new Vector3(...base.scale);

  const newPos = basePos.add(new Vector3(...delta.deltaPosition));
  const newQuat = new Quaternion(...delta.deltaQuaternion).multiply(baseQuat);
  const newScale = baseScale.multiply(new Vector3(...delta.deltaScale));

  return {
    position: newPos.toArray() as [number, number, number],
    quaternion: newQuat.toArray() as [number, number, number, number],
    scale: newScale.toArray() as [number, number, number],
  };
}
