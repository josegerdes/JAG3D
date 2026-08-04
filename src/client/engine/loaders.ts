import { BufferGeometry } from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { Mesh, MeshStandardMaterial } from "three";

import { MeshFormat } from "@/server/db/schema";

const stlLoader = new STLLoader();
const plyLoader = new PLYLoader();
const objLoader = new OBJLoader();

/**
 * Registry por formato — extensivel: adicionar um formato novo e so registrar aqui, nada mais no
 * resto da engine precisa mudar (ver ARCHITECTURE.md).
 */
export function parseMeshBuffer(format: MeshFormat, buffer: ArrayBuffer): BufferGeometry {
  switch (format) {
    case "stl":
      return stlLoader.parse(buffer);
    case "ply":
      return plyLoader.parse(buffer);
    case "obj": {
      const text = new TextDecoder("utf-8").decode(buffer);
      const group = objLoader.parse(text);
      const firstMesh = group.children.find((child): child is Mesh => child instanceof Mesh);
      if (!firstMesh) throw new Error("Arquivo OBJ nao contem nenhuma malha valida");
      return firstMesh.geometry;
    }
  }
}

const stlExporter = new STLExporter();
const plyExporter = new PLYExporter();
const objExporter = new OBJExporter();

/**
 * Export client-side (usado para gerar o arquivo resultante de um corte/alivio antes de subir pro
 * servidor via commitOperation). RISCO CONHECIDO: `OBJExporter` do three.js e simples (sem MTL
 * robusto) — validar fidelidade com arquivo real de scanner antes de depender disso em producao
 * (ver ARCHITECTURE.md).
 */
export function exportMeshToBuffer(format: MeshFormat, mesh: Mesh): ArrayBuffer {
  switch (format) {
    case "stl":
      return stlExporter.parse(mesh, { binary: true }) as unknown as ArrayBuffer;
    case "ply":
      return plyExporter.parse(mesh, () => {}, { binary: true }) as unknown as ArrayBuffer;
    case "obj":
      return new TextEncoder().encode(objExporter.parse(mesh)).buffer;
  }
}

export function makeDefaultMaterial(color = 0xd9d3c7): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, side: 2 });
}
