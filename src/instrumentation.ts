export async function register() {
  // O worker de jobs, o seed e o backfill so fazem sentido no runtime Node.js (nao no Edge, ex: middleware).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { connectDB } = await import("@/server/db/client");
    const { seedInitialAdmin } = await import("@/server/db/seed-admin");
    const { runBackfills } = await import("@/server/db/backfill");
    const { startJobWorker } = await import("@/server/jobs/worker");
    // Registra os backfills por efeito colateral (cada modulo se auto-registra ao ser importado).
    await import("@/server/db/backfills/seed-license-sweep-job");

    try {
      const db = await connectDB();
      await seedInitialAdmin(db);
      await runBackfills(db);
    } catch (error) {
      console.error("[boot] falha ao rodar seed/backfill inicial:", error);
    }

    startJobWorker();
  }
}
