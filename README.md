# JAG3D

Editor de malha 3D no navegador para casos odontologicos e harmonizacao facial — concorrente do exocad/Medit Link. Ferramentas todas visiveis (estilo Photoshop, sem fluxo fechado): selecionar, mover/transformar, duplicar, agrupar/desagrupar, alinhamento manual, corte booleano, alivio, comparacao antes/depois. Motor de geometria roda 100% no navegador (Three.js), com Mongo/Node no servidor para dados, licenciamento e arquivos de malha.

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para o desenho tecnico completo e [SECURITY.md](./SECURITY.md) para o modelo de ameaca/licenciamento.

## Stack

Next.js 14 (App Router) + TypeScript + MongoDB (driver nativo, sem ORM) + Three.js. Deploy: 2 containers principais (`mongo` + `app`) via Docker/Dockploy, mais um job de inicializacao de execucao unica (`mongo-init`) para o replica set do Mongo.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL, JWT_SECRET, APP_SECRET, LICENSE_TOKEN_*
npm run dev
```

O Mongo local tambem precisa ser um replica set single-node (transactions sao usadas pelo modulo `operations` — ver ARCHITECTURE.md). Rodar via `docker compose up mongo mongo-init` reaproveita a configuracao de producao mesmo em dev.

## Rodando com Docker

```bash
docker compose up --build
```

Isso sobe `mongo` (replica set `rs0`), roda `mongo-init` uma vez para inicializar o replica set, e sobe `app`. O usuario administrador inicial e criado automaticamente no boot (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`).

## Modelo de licenciamento (Fase 1)

Licencas sao emitidas manualmente por um admin (`license.manage`), com data de expiracao. A compra de assinatura self-service fica para uma fase futura. Ver a secao "Licenciamento" em ARCHITECTURE.md para as camadas de verificacao.

## Modelo de seguranca

Ver [SECURITY.md](./SECURITY.md).

## Estrutura de pastas

```
src/
  app/                 # rotas (App Router) + API routes
  server/
    auth/              # sessao, JWT, guards
    rbac/              # catalogo de permissoes
    crypto/            # segredos (AES-256-GCM) + capability token (ES256)
    db/                 # client, schema, backfill
    jobs/              # fila Mongo-backed
    modules/<nome>/    # repository.ts + service.ts + types.ts por dominio
    http/              # withApiHandler
  client/
    engine/            # JAG3DViewportEngine (Three.js imperativo)
  components/          # UI (shell, paineis, shadcn/ui)
storage/meshes/        # arquivos de malha em dev (volume Docker em producao)
```
