import { ObjectId } from "mongodb";

/**
 * Definicoes de documento por colecao Mongo. O banco e schemaless (driver nativo,
 * sem ORM), entao estes tipos existem so no lado da aplicacao para dar seguranca
 * de tipos as queries. Ao adicionar um campo novo aqui, ver CONTRIBUTING.md —
 * documentos ja existentes nunca ganham o campo retroativamente sozinhos.
 */

export interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  roleIds: ObjectId[];
  color: string;
  active: boolean;
  /** Contador de senha errada seguida — zera no login certo. Usado pra travar a conta temporariamente. */
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleDoc {
  _id: ObjectId;
  name: string;
  color: string;
  position: number;
  permissions: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobDoc {
  _id: ObjectId;
  type: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type LicenseStatus = "active" | "revoked" | "expired";

export interface LicenseDoc {
  _id: ObjectId;
  userId: ObjectId;
  /** Texto livre na Fase 1 (ex: "standard") — tiering de verdade e coisa de fase futura (pagamento self-service). */
  plan: string;
  status: LicenseStatus;
  issuedAt: Date;
  expiresAt: Date;
  issuedByAdminId: ObjectId;
  revokedAt: Date | null;
  revokedReason: string | null;
  /** Ultima vez que o heartbeat renovou o capability token — so telemetria, nao usado pra decidir status. */
  lastHeartbeatAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CaseStatus = "draft" | "active" | "archived";

export interface CaseDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  name: string;
  /** Identificador de texto livre do caso (ex: nome/codigo do paciente) — nunca PII estruturada. */
  patientRef: string | null;
  status: CaseStatus;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MeshFormat = "stl" | "ply" | "obj";

export interface RigidTransform {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
}

export function identityTransform(): RigidTransform {
  return { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] };
}

export interface MeshAssetDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  caseId: ObjectId;
  groupId: ObjectId | null;
  name: string;
  format: MeshFormat;
  storageKey: string;
  checksumSha256: string;
  sizeBytes: number;
  triangleCount: number;
  transform: RigidTransform;
  /** Conjunto rigido pra anti-dessincronizacao — mover uma malha vinculada move as irmas junto. */
  linkedGroupId: ObjectId | null;
  /** Incrementado a cada commitOperation() que toca este asset — usado pra deteccao de conflito/dessincronizacao. */
  syncVersion: number;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeshGroupDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  caseId: ObjectId;
  name: string;
  meshAssetIds: ObjectId[];
  groupTransform: RigidTransform;
  visible: boolean;
  locked: boolean;
  syncVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export type OperationType =
  | "transform"
  | "booleanCut"
  | "relief"
  | "group"
  | "ungroup"
  | "duplicate"
  | "delete";

export interface OperationLogDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  caseId: ObjectId;
  /** Monotonico por caso — ordena a pilha de undo/redo. */
  sequence: number;
  type: OperationType;
  /** Todo asset atingido atomicamente pela operacao — nao so o visivelmente alterado (ver ARCHITECTURE.md). */
  targetAssetIds: ObjectId[];
  beforeState: unknown;
  afterState: unknown;
  syncVersionBefore: Record<string, number>;
  syncVersionAfter: Record<string, number>;
  userId: ObjectId;
  status: "committed" | "undone";
  committedAt: Date;
}

export interface MeshComparisonDoc {
  _id: ObjectId;
  ownerId: ObjectId;
  caseId: ObjectId;
  beforeAssetId: ObjectId;
  afterAssetId: ObjectId;
  /** Calculado via a ferramenta de alinhamento manual (N pontos) — null ate o usuario alinhar o par. */
  alignmentTransform: RigidTransform | null;
  createdAt: Date;
  updatedAt: Date;
}
