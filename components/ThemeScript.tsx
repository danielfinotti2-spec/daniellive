/**
 * Aplica o tema salvo e o idioma antes da primeira pintura.
 *
 * Precisa ser um script inline síncrono: qualquer coisa que passe pelo React
 * só rodaria depois da hidratação, e a página piscaria branca por um instante
 * para quem escolheu o tema escuro.
 *
 * Escreve `data-theme` (que é o que os utilitários `dark:` leem) e também
 * `colorScheme`, que é o que faz a barra de rolagem, os campos nativos e os
 * controles do sistema nascerem já na cor certa.
 *
 * O `lang` do `<html>` sai daqui pelo mesmo motivo, mas por outra razão: o
 * servidor não tem como saber o idioma escolhido — ele vive no `localStorage` e
 * não na URL. Deixar `lang="pt-BR"` fixo faria um leitor de tela pronunciar
 * inglês com fonética de português, que é pior do que não anunciar idioma
 * nenhum. O React não escreve este atributo, então não há briga na hidratação.
 */
export function ThemeScript() {
  const code =
    "(function(){try{" +
    'var k="screenlive-theme";' +
    "var s=localStorage.getItem(k);" +
    'var m=window.matchMedia("(prefers-color-scheme: dark)").matches;' +
    'var t=s==="claro"?"light":s==="escuro"?"dark":(m?"dark":"light");' +
    'var r=document.documentElement;' +
    'r.setAttribute("data-theme",t);' +
    "r.style.colorScheme=t;" +
    // Idioma: a escolha salva vence; sem escolha, o prefixo do navegador decide.
    // Mesma regra de `lib/idioma.ts`, reescrita aqui porque este trecho roda
    // antes de qualquer módulo carregar.
    'var i=localStorage.getItem("daniellive-idioma");' +
    'if(i!=="pt-BR"&&i!=="en"&&i!=="es"){' +
    "var n=(navigator.languages&&navigator.languages[0])||navigator.language||\"pt\";" +
    'var p=n.toLowerCase().split("-")[0];' +
    'i=p==="en"?"en":p==="es"?"es":"pt-BR";}' +
    'r.setAttribute("lang",i);' +
    '}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();';
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
