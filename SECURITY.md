# Modelo de seguranca — JAG3D

## Modelo de ameaca

O motor de geometria (Three.js) roda 100% no navegador, por decisao de arquitetura (ver ARCHITECTURE.md). Isso significa que **qualquer JS enviado ao cliente pode ser inspecionado, depurado e adulterado por um usuario determinado** — nao ha como impedir isso com codigo client-side, e nenhuma ofuscacao muda essa premissa fundamentalmente.

A fronteira de protecao real deste sistema **nao** e o codigo do editor rodando no navegador. E o servidor: toda acao com valor comercial de fato — persistir um caso (`POST /api/cases/:id/save`) ou exportar um arquivo de malha (STL/PLY/OBJ) — sempre exige uma checagem de licenca fresca, feita no servidor, no momento da chamada. Um usuario pode patchear o bundle client para pular a trava local de ferramentas, mas nao consegue fazer o servidor persistir ou liberar um export sem uma `LicenseDoc` ativa e valida.

## Camadas de licenciamento (defesa em profundidade)

1. **Guard de rota**: `withApiHandler(handler, { requireLicense: true })` checa `LicenseDoc.status === "active" && expiresAt > now` em toda rota de mutacao.
2. **Capability token de curta duracao**: assinado com par de chaves **ES256** dedicado (`LICENSE_TOKEN_PRIVATE_KEY`/`LICENSE_TOKEN_PUBLIC_KEY`, diferente do `JWT_SECRET` da sessao), TTL ~15min, verificavel no navegador via `jose` contra a chave publica (`NEXT_PUBLIC_LICENSE_TOKEN_PUBLIC_KEY`). A chave privada nunca sai do servidor.
3. **Heartbeat periodico** (`/api/license/heartbeat`, ~10min): renova o capability token enquanto a licenca segue ativa; se foi revogada/expirou, simplesmente para de emitir token novo.
4. **Trava dura em save/export**: sempre recheca a licenca no servidor, ao vivo, independente do token local em cache. Este e o backstop comercial de verdade.
5. **Propagacao de revogacao**: revogar no admin flipa `LicenseDoc.status` na hora; uso local de ferramenta pode continuar ate o token expirar (~15min), mas save/export bloqueia na proxima tentativa.
6. **Job de varredura de expiracao**: `license-expiry-sweep` roda a cada hora, flipando licencas vencidas para `"expired"`.

## Outras praticas

- Segredos (chaves, tokens) sempre criptografados em repouso com AES-256-GCM (`server/crypto/secrets.ts`), chave derivada de `APP_SECRET` via SHA-256.
- Upload de malha valida o formato pelos **bytes reais do arquivo** (assinatura/magic bytes), nunca so pela extensao ou `Content-Type` declarado pelo cliente.
- Todo dado de caso/malha e escopado por `ownerId` no servidor (nunca confiar em um id vindo do cliente sem checar posse).
- JWT de sessao fixa `algorithms: ["HS256"]` explicitamente na verificacao, para nao aceitar um token com algoritmo trocado (ataque de confusao de algoritmo).
- `middleware.ts` (Edge runtime) so verifica presenca do cookie, nunca a assinatura — a validacao criptografica de verdade acontece em `getSession()`, que roda em runtime Node.

## Conhecido, aceito, nao resolvido na Fase 1

- Backup/redundancia do volume `mesh-data` — precisa ser resolvido antes de onboarding de clientes pagantes reais.
- Licencas multi-seat / compra self-service — fase futura.
