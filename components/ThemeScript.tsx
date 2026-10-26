/**
 * Aplica o tema salvo antes da primeira pintura.
 *
 * Precisa ser um script inline síncrono: qualquer coisa que passe pelo React
 * só rodaria depois da hidratação, e a página piscaria branca por um instante
 * para quem escolheu o tema escuro.
 *
 * Escreve `data-theme` (que é o que os utilitários `dark:` leem) e também
 * `colorScheme`, que é o que faz a barra de rolagem, os campos nativos e os
 * controles do sistema nascerem já na cor certa.
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
    '}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();';
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
