import { SitePage } from "./SitePage";
import { MARCA } from "@/lib/marca";

export const metadata = {
  title: `${MARCA.nome} — compartilhe sua tela pelo navegador`,
  description: MARCA.descricao,
};

/**
 * A versão web do DanielLive.
 *
 * É a mesma transmissão da página inicial, apresentada como uma das duas formas
 * de usar o produto — a outra é o aplicativo, na aba Download. A separação
 * importa porque as duas têm limites diferentes, e quem escolhe merece saber
 * qual está escolhendo.
 *
 * A página inicial continua sendo a entrada; esta é o destino da aba "Site",
 * para quem chegou pela aba "Download" e quer voltar atrás.
 *
 * **Por que o JSX mora em `SitePage.tsx`.** O texto visível vem do dicionário,
 * que é um hook de cliente — e um arquivo com `export const metadata` não pode
 * ser componente de cliente. Aqui ficam só os metadados, que o servidor monta;
 * o corpo, que depende do idioma, fica no arquivo ao lado.
 */
export default function Site() {
  return <SitePage />;
}
