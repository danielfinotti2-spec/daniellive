import { DownloadPage } from "./DownloadPage";
import { MARCA } from "@/lib/marca";

export const metadata = {
  title: `Baixar o ${MARCA.nome} para Windows`,
  description:
    "Baixe o aplicativo do DanielLive para Windows e transmita sua tela escolhendo exatamente o que compartilhar.",
};

/**
 * Página de download do aplicativo.
 *
 * Existe para separar as duas formas de usar o DanielLive, que antes ficavam
 * misturadas na mesma tela: pelo navegador (a aba "Site") e pelo aplicativo
 * instalado (esta aba). A diferença é real e vale explicar — no aplicativo, a
 * captura usa a GPU e alcança a tela inteira; no navegador, depende do que o
 * navegador deixa escolher.
 *
 * Enquanto o endereço de publicação não for confirmado, a página **não** mostra
 * um botão que leva a lugar nenhum: diz o que está pendente. É a mesma regra das
 * redes sociais no rodapé — link errado é pior do que link nenhum.
 *
 * **Por que o JSX mora em `DownloadPage.tsx`.** O texto visível vem do
 * dicionário, que é um hook de cliente — e um arquivo com `export const
 * metadata` não pode ser componente de cliente. Aqui ficam só os metadados, que
 * o servidor monta; o corpo, que depende do idioma, fica no arquivo ao lado.
 */
export default function Download() {
  return <DownloadPage />;
}
