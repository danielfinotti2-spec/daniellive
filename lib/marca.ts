/**
 * Identidade e presença na internet do DanielLive.
 *
 * **Um lugar só.** Nome, marca e redes sociais ficam aqui. Antes de publicar,
 * confira os campos marcados com `confirmado: false` — a interface mostra
 * "a confirmar" neles para ninguém clicar num endereço que não existe.
 *
 * Por que existe uma lista de redes em vez de escrever os links direto no
 * rodapé: link errado em rodapé é pior do que link nenhum. Assim o que falta
 * fica visível e o que existe não se perde no meio do JSX.
 */

export const MARCA = {
  /** Nome do produto. Aparece no título das páginas, no cabeçalho e no rodapé. */
  nome: "DanielLive",
  /** Como o produto se descreve em uma linha. Usado em metadados e no rodapé. */
  descricao: "Compartilhamento de tela pelo navegador, sem instalar nada.",
  /**
   * A mesma descrição para o aplicativo instalado.
   *
   * "Sem instalar nada" é verdade no site e mentira aqui: quem está lendo isto
   * já instalou. A frase passa a dizer o que o aplicativo realmente faz — ligar
   * duas pontas e mandar a imagem direto de uma para a outra.
   */
  descricaoApp: "Compartilhamento de tela direto entre computadores, sem servidor no meio.",
  /** Quem faz. É também o @ usado nas redes sociais. */
  autor: "euodeene",
} as const;

export type Rede = {
  /** Identificador estável; também escolhe o ícone em components/ui.tsx. */
  id: "github" | "instagram" | "discord" | "linkedin" | "x" | "tiktok" | "email";
  /** Nome mostrado no rodapé e no rótulo acessível do link. */
  nome: string;
  /** Endereço completo. Vazio significa "ainda não definido". */
  url: string;
  /** @ do perfil, mostrado quando existe. */
  usuario?: string;
  /**
   * `false` enquanto o endereço não foi conferido.
   *
   * Enquanto for falso, a interface não cria um link clicável: mostra apenas o
   * rótulo com "a confirmar". Isso evita mandar alguém para um perfil de outra
   * pessoa, ou para um 404.
   */
  confirmado: boolean;
};

/**
 * Redes sociais.
 *
 * Todos os endereços abaixo foram informados pelo próprio autor do projeto, e
 * por isso ficam `confirmado: true` — a interface cria links clicáveis para
 * eles. `confirmado: false` é para endereço que ainda não existe: enquanto for
 * falso, a interface mostra o rótulo sem link, em vez de mandar alguém para um
 * perfil de outra pessoa ou para um 404.
 *
 * O YouTube saiu da lista: não existe canal, e um rótulo "a confirmar" no rodapé
 * só ocupava espaço para dizer que não havia nada ali.
 */
export const REDES: Rede[] = [
  {
    id: "github",
    nome: "GitHub",
    url: "https://github.com/danielfinotti2-spec",
    usuario: "danielfinotti2-spec",
    confirmado: true,
  },
  {
    id: "instagram",
    nome: "Instagram",
    url: "https://www.instagram.com/euodeene/",
    usuario: "euodeene",
    confirmado: true,
  },
  {
    id: "discord",
    nome: "Discord",
    url: "https://discord.gg/am9s4fqRHw",
    usuario: "Discord",
    confirmado: true,
  },
  {
    id: "x",
    nome: "X",
    url: "https://x.com/euodeene",
    usuario: "euodeene",
    confirmado: true,
  },
];

/** Só o que foi confirmado e tem endereço válido vira link de verdade. */
export function redesConfirmadas(): Rede[] {
  return REDES.filter((r) => r.confirmado && /^https?:\/\/\S+$/i.test(r.url));
}

/**
 * As redes que ainda faltam preencher, para a interface poder dizer isso de
 * forma explícita em vez de simplesmente omitir.
 */
export function redesPendentes(): Rede[] {
  return REDES.filter((r) => !r.confirmado || !/^https?:\/\/\S+$/i.test(r.url));
}

/**
 * Mascote oficial.
 *
 * O arquivo fica em `public/branding/pato.png` — 1254x1254, PNG com canal alfa
 * (o pato recortado, 63% de pixels transparentes). É a arte original, guardada
 * sem nenhuma alteração: o componente apenas a encaixa por proporção, sem
 * cortar, esticar nem trocar por um desenho inventado.
 *
 * Se o arquivo faltar, a interface mostra o glifo da marca no lugar — nunca um
 * substituto improvisado, porque substituir a identidade por um palpite é pior
 * do que mostrar menos.
 *
 * O ícone do Windows é derivado desta mesma arte: `npm run icone`.
 */
export const MASCOTE = {
  /** Caminho público da arte. */
  src: "/branding/pato.png",
  /** Texto alternativo: descreve a imagem para quem não a vê. */
  alt: "Pato de óculos, mascote do DanielLive",
} as const;

/**
 * Onde o aplicativo para Windows é baixado.
 *
 * Os instaladores passam de 250 MB, então não ficam no repositório — vão para as
 * "releases" do GitHub, que é onde se publicam binários. O endereço abaixo é a
 * página de releases; os arquivos ficam anexados a cada versão publicada.
 *
 * **Como o endereço das redes sociais, isto precisa ser conferido.** Enquanto
 * `confirmado` for `false`, a aba Download não cria um botão que leva a lugar
 * nenhum: ela mostra o que vai existir e diz que a publicação está pendente.
 */
export const DOWNLOAD = {
  /** Página de releases, de onde saem todos os instaladores. */
  url: "https://github.com/danielfinotti2-spec/daniellive/releases/latest",
  /** Enquanto falso, a interface não promete um download que ainda não existe. */
  confirmado: false,
  /**
   * Os arquivos publicados em cada versão.
   *
   * `principal: true` marca o que a maioria das pessoas deve baixar. O portátil
   * e o `.msi` existem para quem precisa deles, e ficam listados abaixo sem
   * competir com o botão grande.
   */
  arquivos: [
    {
      id: "instalador",
      nome: "DanielLive-Setup-1.0.0.exe",
      rotulo: "Instalador",
      descricao: "Instala o DanielLive no Windows. Recomendado para a maioria.",
      tamanho: "≈ 188 MB",
      principal: true,
    },
    {
      id: "portatil",
      nome: "DanielLive-Portatil-1.0.0.exe",
      rotulo: "Versão portátil",
      descricao: "Não instala nada: abre direto do arquivo. Bom para pen drive.",
      tamanho: "≈ 147 MB",
      principal: false,
    },
    {
      id: "msi",
      nome: "DanielLive-1.0.0.msi",
      rotulo: "Pacote .msi",
      descricao: "Para instalar em rede ou por política de empresa.",
      tamanho: "≈ 186 MB",
      principal: false,
    },
  ],
  /** Requisitos, mostrados junto do botão para ninguém baixar à toa. */
  requisitos: [
    "Windows 10 ou 11, 64 bits",
    "4 GB de memória",
    "Placa de vídeo com driver atualizado (a captura de tela usa a GPU)",
  ],
} as const;

export type ArquivoDownload = (typeof DOWNLOAD.arquivos)[number];
