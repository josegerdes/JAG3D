/**
 * Constantes de auth sem dependencias pesadas (ex: jsonwebtoken) — importavel
 * a partir de `middleware.ts`, que roda no Edge Runtime e nao pode carregar
 * modulos Node.js como o `jsonwebtoken`.
 */
export const AUTH_COOKIE_NAME = "jag3d_session";
