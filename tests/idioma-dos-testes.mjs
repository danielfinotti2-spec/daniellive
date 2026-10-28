/**
 * Fixa o idioma da interface nos testes de ponta a ponta.
 *
 * Os testes procuram botões e textos pelo nome — "Compartilhar minha tela",
 * "Pausar", "Ao vivo". Esses rótulos agora vêm do dicionário e mudam com o
 * idioma escolhido. Sem fixar, o resultado dependeria do idioma do Chrome de
 * quem roda: numa máquina em inglês, os 28 seletores por texto falhariam.
 *
 * A escolha vai para o `localStorage` **antes** de qualquer script da página
 * rodar, que é onde `lib/idioma.ts` a procura. É o mesmo caminho que uma pessoa
 * usaria escolhendo no menu, só que sem depender da detecção do navegador.
 *
 * Também é o que dá sentido à asserção: o teste verifica a interface em
 * português, que é o idioma padrão do produto, e não o idioma da máquina.
 */
export const IDIOMA_DOS_TESTES = "pt-BR";

/** Script a registrar com `addInitScript` num contexto do Playwright. */
export const fixarIdioma = `
  try {
    localStorage.setItem("daniellive-idioma", ${JSON.stringify(IDIOMA_DOS_TESTES)});
  } catch (e) {}
`;

/**
 * Aplica a fixação a um contexto.
 *
 * Devolve o próprio contexto, para encadear: `const ctx = preparar(await
 * browser.newContext(...))`.
 */
export async function preparar(contexto) {
  await contexto.addInitScript(fixarIdioma);
  return contexto;
}
