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
    /*
     * `dist-desktop/**` entrou na lista junto com a correção do `asarUnpack`.
     *
     * O aplicativo empacotado passou a levar `.next` e `public` **fora** do asar,
     * como arquivos soltos — e a partir daí o ESLint passou a enxergar o pacote
     * inteiro e a reclamar de código gerado (dezenas de
     * `no-assign-module-variable` em bundles do Next, e regras que nem existem
     * neste projeto). Nada disso é código deste repositório: é o resultado de
     * compilar este repositório.
     *
     * O diretório já era ignorado pelo git; faltava aqui.
     */
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist-desktop/**",
      "next-env.d.ts",
      "tests/**",
    ],
  },
];

export default eslintConfig;
