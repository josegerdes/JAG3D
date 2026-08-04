/**
 * Catalogo fixo de permissoes, agrupado por categoria — igual ao painel de
 * permissoes do Discord (Server Settings > Roles), especifico do dominio
 * deste sistema. `roles` no banco guardam um array de chaves daqui.
 */
export interface PermissionDef {
  key: string;
  label: string;
  description: string;
}

export interface PermissionCategory {
  key: string;
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: "cases",
    label: "Casos",
    permissions: [
      { key: "cases.view", label: "Ver casos", description: "Visualizar os proprios casos" },
      {
        key: "cases.manageAny",
        label: "Gerenciar qualquer caso",
        description: "Ver e editar casos de qualquer usuario (suporte/administracao)",
      },
    ],
  },
  {
    key: "meshes",
    label: "Malhas",
    permissions: [
      { key: "meshes.upload", label: "Enviar malhas", description: "Fazer upload de arquivos STL/PLY/OBJ" },
      { key: "meshes.export", label: "Exportar malhas", description: "Baixar malhas editadas (sujeito a licenca ativa)" },
    ],
  },
  {
    key: "tools",
    label: "Ferramentas do editor",
    permissions: [
      { key: "tools.transform", label: "Mover/transformar", description: "Selecionar, mover, rotacionar e escalar malhas" },
      { key: "tools.duplicate", label: "Duplicar", description: "Duplicar malhas e grupos" },
      { key: "tools.group", label: "Agrupar", description: "Agrupar/desagrupar e vincular malhas" },
      { key: "tools.align", label: "Alinhamento", description: "Alinhamento manual por pontos correspondentes" },
      { key: "tools.booleanCut", label: "Corte booleano", description: "Cortes e operacoes booleanas" },
      { key: "tools.relief", label: "Alivio", description: "Ferramenta de alivio (carimbo parametrico)" },
      { key: "tools.compare", label: "Comparar antes/depois", description: "Modo de comparacao (overlay e split-screen)" },
    ],
  },
  {
    key: "license",
    label: "Licenciamento",
    permissions: [
      { key: "license.manage", label: "Gerenciar licencas", description: "Emitir, estender e revogar licencas de usuarios" },
    ],
  },
  {
    key: "administration",
    label: "Administracao",
    permissions: [
      { key: "users.manage", label: "Gerenciar usuarios", description: "Criar/editar usuarios e atribuir roles" },
      { key: "roles.manage", label: "Gerenciar roles", description: "Criar/editar roles e permissoes" },
    ],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_CATEGORIES.flatMap((category) =>
  category.permissions.map((permission) => permission.key)
);

export function isValidPermission(key: string): boolean {
  return ALL_PERMISSIONS.includes(key);
}
