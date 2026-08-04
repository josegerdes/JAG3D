import { Db, MongoClient } from "mongodb";

type MongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
  indexesEnsured: boolean;
};

// eslint-disable-next-line no-var
declare global {
  var __mongoCache: MongoCache | undefined;
}

const cache: MongoCache = global.__mongoCache ?? { client: null, promise: null, indexesEnsured: false };
global.__mongoCache = cache;

/**
 * Indices pros filtros mais comuns. Nao-unicos de proposito (nunca confirmado
 * que dados existentes nao tem duplicata) — roda uma vez por processo, e
 * falha aqui nunca derruba a aplicacao, so fica mais lento ate alguem notar.
 */
async function ensureIndexes(db: Db): Promise<void> {
  if (cache.indexesEnsured) return;
  cache.indexesEnsured = true;

  try {
    await Promise.all([
      db.collection("licenses").createIndex({ userId: 1 }),
      db.collection("licenses").createIndex({ status: 1, expiresAt: 1 }),
      db.collection("cases").createIndex({ ownerId: 1 }),
      db.collection("meshAssets").createIndex({ caseId: 1 }),
      db.collection("meshAssets").createIndex({ ownerId: 1 }),
      db.collection("meshAssets").createIndex({ linkedGroupId: 1 }),
      db.collection("meshAssets").createIndex({ checksumSha256: 1 }),
      db.collection("meshGroups").createIndex({ caseId: 1 }),
      db.collection("operationLogs").createIndex({ caseId: 1, sequence: 1 }),
      db.collection("meshComparisons").createIndex({ caseId: 1 }),
    ]);
  } catch (error) {
    console.error("Falha ao criar indices do Mongo (nao bloqueia a aplicacao):", error);
  }
}

// Lazy (nao no module scope) pra nao quebrar o build do Next, que carrega
// route handlers pra coletar metadados antes de qualquer variavel de
// ambiente de runtime estar disponivel (ex: build do Docker).
async function getClient(): Promise<MongoClient> {
  if (cache.client) return cache.client;
  if (!cache.promise) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("Defina a variavel de ambiente DATABASE_URL (.env)");
    }
    cache.promise = new MongoClient(databaseUrl).connect().catch((error) => {
      // Sem isso, uma falha na primeira tentativa fica em cache pra sempre — toda chamada
      // seguinte reusa essa mesma promise ja rejeitada e a aplicacao inteira fica sem banco
      // permanentemente, exigindo reiniciar o processo pra voltar a funcionar.
      cache.promise = null;
      throw error;
    });
  }
  cache.client = await cache.promise;
  return cache.client;
}

export async function connectDB(dbName: string = process.env.DB ?? "jag3d"): Promise<Db> {
  const client = await getClient();
  const db = client.db(dbName);
  void ensureIndexes(db);
  return db;
}

/** Cliente Mongo cru (nao escopado a um Db) — usado por `commitOperation()` para abrir uma `ClientSession` de transaction. */
export async function getMongoClient(): Promise<MongoClient> {
  return getClient();
}

export default connectDB;
