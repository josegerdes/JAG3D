# Changelog

Todas as mudancas relevantes deste projeto sao documentadas aqui. Formato livre por enquanto (pre-v1.0).

## [Unreleased]

### Fase 1 — Fundacao

- Bootstrap do projeto (Next.js 14 + TS + Tailwind/shadcn), Docker/compose com Mongo replica-set single-node.
- Auth/RBAC estilo Discord, licenciamento em 6 camadas (guard de rota, capability token ES256, heartbeat, trava dura em export, propagacao de revogacao, job de expiracao).
- Casos, upload/export de malha (STL/PLY/OBJ, validacao por bytes reais), grupos vinculados, comparacao antes/depois (overlay + split-screen), `commitOperation()` transacional anti-dessincronizacao com undo.
- Engine 3D imperativa (Three.js + three-mesh-bvh + three-bvh-csg): selecionar, mover/transformar, duplicar, agrupar, alinhamento manual (Kabsch), corte booleano, pincel de alivio (traco continuo), pincel de suavizacao.
- Atalhos de teclado estilo exocad (V/M/A/B/R/S/C, G, Delete, F, Esc, Ctrl+D, Ctrl+Z).
- UI: login, dashboard de casos, editor por caso, administracao (usuarios/roles/licencas).
- Corrigido bug upstream do three@0.169 (`TransformControls.dispose()` chamando `this.traverse` numa classe que nao e `Object3D`) via workaround em `JAG3DViewportEngine`.
