# Arquitetura — JAG3D

Editor de malha 3D (odontologico + harmonizacao facial) rodando no navegador, com admin/RBAC/licenciamento no servidor. Reaproveita o padrao de arquitetura do projeto irmao "Sistema do Aluno" (Next.js 14 App Router + TypeScript + MongoDB driver nativo, sem ORM), adaptado para dados isolados por usuario (`ownerId`) em vez de por unidade/organizacao.

## Auth / Sessao

- `server/auth/constants.ts` — so o nome do cookie, sem dependencia pesada (importavel pelo `middleware.ts`, que roda em Edge Runtime e nao pode carregar `jsonwebtoken`).
- `server/auth/jwt.ts` — HS256, Node-only, payload so com `{ userId }`. `algorithms: ["HS256"]` fixado explicitamente na verificacao (evita ataque de confusao de algoritmo).
- `server/auth/session.ts#getSession()` — busca usuario + roles frescos do Mongo a cada request (nunca confia em claims do token), computa `permissions` (uniao de todas as roles), `isSuperAdmin` (role `isDefault` "Administrador") e `hasActiveLicense` (checagem ao vivo contra `LicenseDoc`).
- `middleware.ts` (Edge) — so verifica presenca do cookie, para redirect. A validacao criptografica de verdade so acontece em `getSession()`, em runtime Node.

## RBAC (estilo Discord)

`server/rbac/permissions.ts` — `PERMISSION_CATEGORIES` agrupadas (cases, meshes, tools, license, users, roles). Roles tem `{name, color, position, permissions[], isDefault}`; usuario pode ter varias roles, permissao efetiva = uniao. A role `isDefault` "Administrador" e sempre resolvida com `ALL_PERMISSIONS` calculado ao vivo (nunca o array salvo), entao uma permissao nova adicionada ao catalogo nao exige migracao manual.

Acesso a dados de caso/malha usa `requireCaseOwnership(session, caseDoc)` — `caseDoc.ownerId === session.userId` — em vez do `requireUnitAccess` do projeto irmao. Roles servem principalmente para o lado administrativo (emitir licenca, gerenciar usuarios, suporte com override `cases.manageAny`).

## Modulos de servidor

Convencao: `server/modules/<nome>/{repository.ts,service.ts,types.ts}` + `app/api/<nome>/route.ts`, tudo atras de `withApiHandler(handler, {permission?, requireSuperAdmin?, requireLicense?})` (`server/http/with-api-handler.ts`), que centraliza autenticacao/autorizacao/licenca e o formato de erro.

## Modelo de dados

Ver interfaces completas em `server/db/schema.ts`. Resumo:

- **LicenseDoc** — `{userId, plan, status, issuedAt, expiresAt, issuedByAdminId, revokedAt, revokedReason, lastHeartbeatAt}`.
- **CaseDoc** — `{ownerId, name, patientRef, status}`.
- **MeshAssetDoc** — `{ownerId, caseId, groupId, format, storageKey, checksumSha256, transform, linkedGroupId, syncVersion}`.
- **MeshGroupDoc** — `{ownerId, caseId, meshAssetIds[], groupTransform, syncVersion}`.
- **OperationLogDoc** — pilha de undo/redo E trilha de auditoria: `{caseId, sequence, type, targetAssetIds[], beforeState, afterState, syncVersionBefore/After}`.
- **MeshComparisonDoc** — par antes/depois para o modo de comparacao: `{caseId, beforeAssetId, afterAssetId, alignmentTransform}`.

Arquivos de malha (STL/PLY/OBJ) ficam num **volume Docker** (`mesh-data:/data/meshes`), nao no Mongo — GridFS infla o working set a toa para arquivos de dezenas/centenas de MB, e a filosofia de poucos containers descarta S3. Layout endereçado por conteudo (`storageKey` derivado de `checksumSha256`).

## Anti-dessincronizacao de malhas

Mecanismo central de seguranca do editor (multiplas malhas de um caso — ex: arcada superior + antagonista + die de preparo — precisam permanecer espacialmente consistentes):

1. **Conjuntos vinculados**: `MeshAssetDoc.linkedGroupId` — mover uma malha vinculada move as irmas pelo mesmo delta, a menos que desvinculado explicitamente (acao logada).
2. **Commit transacional unico**: toda mutacao (transform, corte, alivio, agrupar, duplicar) passa por `commitOperation()` — compara `syncVersion` atual de todos os assets tocados contra a versao que o cliente leu por ultimo (`409 Conflict` em mismatch, nunca merge silencioso), grava o novo estado e insere um `OperationLogDoc` cobrindo tudo, **dentro de uma Mongo transaction multi-documento**.
   > **Por isso `mongo` roda como replica set single-node (`rs0`)** — transactions nao existem em Mongo standalone. Ver `docker-compose.yml` (servico `mongo-init`, `rs.initiate()` no primeiro boot). Se um write transacional falhar com erro de "Transaction numbers are only allowed on a replica set member", esse init nao rodou.
3. Cliente aplica o efeito otimisticamente, mas desfaz em `409` — nunca confia na propria memoria como fonte de verdade.
4. Endpoint de integridade compara `{assetId: syncVersion}` do cliente com o servidor; divergencia fora do fluxo normal acende o indicador de sync na UI e bloqueia edicao ate reload.

## Licenciamento

Ver [SECURITY.md](./SECURITY.md) para o detalhamento completo das 6 camadas (guard de rota, capability token ES256, heartbeat, trava dura em save/export, propagacao de revogacao, job de varredura de expiracao).

## Motor de geometria (client)

100% client-side (decisao de arquitetura, nao server-compute):

| Necessidade | Pacote |
|---|---|
| Engine 3D | `three` |
| Import/export STL/PLY/OBJ | addons `three` (`STLLoader`/`PLYLoader`/`OBJLoader`/exporters) |
| Picking/raycasting rapido | `three-mesh-bvh` |
| Boolean CSG (corte, alivio) | `three-bvh-csg` (mesmo autor do `three-mesh-bvh`, opera direto em `BufferGeometry`) |
| Gizmo/camera | `TransformControls`/`OrbitControls` |
| Estado do editor | `zustand` |
| Isolamento de calculo pesado | Web Worker via `comlink` |
| Verificacao de licenca no navegador | `jose` |

`manifold-3d` (WASM, saida garantidamente watertight) fica cotado para Fase 2 caso cortes booleanos em scans reais produzam malha nao-manifold com `three-bvh-csg`.

### Ferramentas de pincel (alivio e suavizacao)

Estilo exocad/Meshmixer — `pointerdown` comeca o traco, `pointermove` amostra/aplica, `pointerup`
fecha e commita uma unica vez (nao a cada frame):

- **Alivio (pincel)**: acumula pontos+normais do trajeto (`relief-brush.ts#buildStrokeBrush`,
  distancia minima `STROKE_MIN_SAMPLE_DISTANCE` entre amostras), monta UMA malha-pincel (uniao de
  esferas — barato, so entre primitivas) e roda o boolean caro contra a malha alvo so uma vez no
  fim do traco.
- **Suavizar (pincel)**: `smooth-brush.ts#applySmoothBrush` mexe direto no `BufferAttribute` de
  posicao (media ponderada por distancia dos vertices no raio), sem CSG — aplicado ao vivo a cada
  `pointermove`, sync com o servidor so uma vez no `pointerup`. **Risco de performance conhecido**:
  busca O(n) em todos os vertices por chamada — ok pra malhas pequenas/teste, precisa de busca
  espacial via `three-mesh-bvh` (`shapecast`) ou mover pra Web Worker antes de escalar pra scans
  reais de scanner intraoral.

### Atalhos de teclado (estilo exocad)

`use-editor-shortcuts.ts` — uma letra por ferramenta, sempre disponivel (sem modo, ver layout
Photoshop acima): `V` selecionar, `M` mover/transformar, `A` alinhar, `B` corte booleano, `R`
alivio, `S` suavizar, `C` comparar. `G` agrupa a selecao, `Delete`/`Backspace` apaga, `F` enquadra
tudo, `Esc` volta pra selecao/cancela sessao de alinhamento em andamento, `Ctrl+D` duplica,
`Ctrl+Z` desfaz. Ignorado quando o foco esta num campo de texto/select.

### Engine imperativa, nao React declarativo

`src/client/engine/JAG3DViewportEngine.ts` possui a `Scene`/camera/renderer/controls/raycaster BVH/registro de meshes, com API imperativa (`loadMesh`, `selectAsset`, `applyTransform`, `executeBooleanCut`, `undo`, `redo`). `Viewport.tsx` monta a engine uma vez; React nunca re-renderiza a arvore Three.js. Motivo: editor CAD com pilha de undo/redo baseada em comandos e gizmo arrastado a 60-120Hz — o reconciler do `@react-three/fiber` e pensado para cena-como-funcao-de-estado-React, o oposto do que se precisa aqui.

### Comparacao antes/depois (harmonizacao facial)

`CompareController`, parte da mesma engine, dois submodos sobre um `MeshComparisonDoc`:
- **Overlay com rotacao sincronizada** — antes/depois no mesmo centro de orbita, toggle de visibilidade, camera nunca reseta.
- **Split-screen com arraste** — renderiza a cena duas vezes por frame a partir da mesma pose de camera, compoe via scissor-rect do WebGL seguindo um divisor arrastavel.

## Layout da UI (estilo Photoshop)

`AppShell` fixo, sem wizard — `TopToolbar` (ferramentas sempre visiveis, habilitadas por contexto de selecao) · `LeftPanel` → `MeshGroupsPanel` (arvore Grupo→Malha, status de sync) · `CenterPanel` → `Viewport` · `RightPanel` → `PropertiesPanel` · `StatusBar` (licenca, sync, triangulos).

## Deploy

Docker: `mongo` (replica set `rs0`) + `mongo-init` (job de execucao unica, inicializa o replica set) + `app` (Next.js `standalone`, non-root). Todo `NEXT_PUBLIC_*` precisa ser passado como build `ARG` no Dockerfile — Next.js inlina essas vars no bundle client durante `next build`, que roda dentro do build da imagem, antes de qualquer `environment:` do compose se aplicar. No Dockploy, usar o metodo de build **Dockerfile** (nao Nixpacks/Railpack), para manter esse controle.
