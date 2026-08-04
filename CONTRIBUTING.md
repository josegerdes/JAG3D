# Convencoes de codigo — JAG3D

Projeto construido para eventualmente ser vendido/licenciado — qualidade de codigo e documentacao nao sao opcionais aqui.

## Modulos de servidor

`server/modules/<nome>/{repository.ts,service.ts,types.ts}` + rotas paralelas em `app/api/<nome>/`.

- **repository.ts**: CRUD cru no Mongo (via `collections.ts`), sem regra de negocio.
- **service.ts**: regra de negocio, lanca `ApiError` (de `server/auth/guards.ts`), chama o repository.
- **types.ts**: schemas Zod + tipos inferidos.
- Toda rota passa por `withApiHandler(handler, { permission?, requireSuperAdmin?, requireLicense? })`.

## Comentarios

So onde justificam uma decisao nao-obvia (uma restricao escondida, um workaround, um comportamento que surpreenderia quem le depois). Nunca para reafirmar o que o codigo ja diz. Nunca referenciando a tarefa atual ("adicionado para X") — isso vira ruido conforme o codigo evolui.

## Documentacao inline

Funcoes de servico exportadas que tem pre-condicoes ou invariantes nao-obvios (ex: `commitOperation()` e sua garantia transacional, semantica de `syncVersion`) levam um JSDoc curto explicando isso.

## Schema Mongo

Ao adicionar um campo novo a um schema: sempre perguntar "algum documento ja existente fica sem esse campo?" — se sim, registrar uma entrada no backfill runner (`server/db/backfill.ts`), nunca confiar so em seed inicial ou default de leitura.
