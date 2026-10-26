import next from "eslint-config-next";

/**
 * Configuração no formato flat, que é o nativo do ESLint 9.
 *
 * O caminho antigo (FlatCompat + "next/core-web-vitals") quebra nesta versão:
 * o eslint-config-next traz objetos de plugin circulares, e o validador do
 * FlatCompat tenta serializá-los. Importar o preset direto evita a conversão.
 */
const eslintConfig = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "tests/**"],
  },
];

export default eslintConfig;
