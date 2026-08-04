import { Db } from "mongodb";
import type {
  CaseDoc,
  JobDoc,
  LicenseDoc,
  MeshAssetDoc,
  MeshComparisonDoc,
  MeshGroupDoc,
  OperationLogDoc,
  RoleDoc,
  UserDoc,
} from "@/server/db/schema";

/**
 * Getters tipados por colecao — nunca chamar `db.collection("nomeCru")` direto
 * fora daqui.
 */
export const collections = {
  users: (db: Db) => db.collection<UserDoc>("users"),
  roles: (db: Db) => db.collection<RoleDoc>("roles"),
  jobs: (db: Db) => db.collection<JobDoc>("jobs"),
  licenses: (db: Db) => db.collection<LicenseDoc>("licenses"),
  cases: (db: Db) => db.collection<CaseDoc>("cases"),
  meshAssets: (db: Db) => db.collection<MeshAssetDoc>("meshAssets"),
  meshGroups: (db: Db) => db.collection<MeshGroupDoc>("meshGroups"),
  operationLogs: (db: Db) => db.collection<OperationLogDoc>("operationLogs"),
  meshComparisons: (db: Db) => db.collection<MeshComparisonDoc>("meshComparisons"),
};
