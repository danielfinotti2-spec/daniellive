"use client";

import { useSyncExternalStore } from "react";

/**
 * Idioma da interface.
 *
 * **Por que não `next-intl` ou uma rota por idioma.** O DanielLive não tem
 * conteúdo por idioma — não há artigos, nem SEO que valha uma URL própria por
 * tradução. O que existe é uma interface com dois ou três idiomas e uma escolha
 * que pertence a quem usa, não ao endereço. Trocar de idioma sem mudar de
 * endereço é o comportamento certo aqui, e cabe em um arquivo.
 *
 * **A escolha é do navegador, não do servidor.** Como no tema, a preferência
 * vive no `localStorage`, e o servidor não a conhece. Por isso o primeiro
 * render é sempre no idioma padrão e o valor real chega logo depois, pelo
 * `useSyncExternalStore` — que é o que evita a divergência de hidratação.
 */
export const IDIOMAS = ["pt-BR", "en", "es"] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const IDIOMA_PADRAO: Idioma = "pt-BR";

const CHAVE = "daniellive-idioma";

/** Nomes dos idiomas no próprio idioma, como se faz em seletores de idioma. */
export const NOME_DO_IDIOMA: Record<Idioma, string> = {
  "pt-BR": "Português",
  en: "English",
  es: "Español",
};

/**
 * O dicionário.
 *
 * A forma é aninhada por área (`nav.site`) porque é assim que quem escreve o
 * JSX pensa: ao mexer no cabeçalho, procura em `nav`. Uma lista plana de chaves
 * obrigaria a inventar prefixos de qualquer jeito, sem a checagem do tipo.
 *
 * `pt-BR` é a fonte da verdade: `Dicionario` sai dele, então uma chave que
 * exista em inglês mas não em português é um erro de tipo, e uma tradução
 * incompleta também. O TypeScript é quem garante que os três idiomas cobrem o
 * mesmo conjunto — sem isso, a interface mostraria português no meio do inglês
 * e ninguém perceberia até um usuário reclamar.
 *
 * **Sem `as const`.** Com ele, cada string vira um tipo literal ("Criar
 * transmissão"), e nenhuma tradução seria atribuível — o inglês não é "Criar
 * transmissão". O que se quer preservar é o *conjunto de chaves*, não o texto
 * de cada uma; `Dicionario` já carrega as chaves, e o valor é `string`.
 */
const ptBR = {
  comum: {
    voltarAoInicio: "Voltar para o início",
    pularParaConteudo: "Pular para o conteúdo",
    copiar: "Copiar",
    copiado: "Copiado!",
    naoCopiou: "Não foi possível",
    nadaParaColar: "A área de transferência está vazia.",
    copiarLink: "Copiar link",
    copiarCodigo: "Copiar código",
    fechar: "Fechar",
    cancelar: "Cancelar",
    salvar: "Salvar",
    carregando: "Carregando",
    ajuda: "Precisa de ajuda?",
    inicio: "início",
    entrarComCodigo: "Entrar com um código",
    dispensarAviso: "Dispensar aviso",
    semNome: "Sem nome",
    aoVivo: "Ao vivo",
    conectado: "Conectado",
    conectar: "Conectando",
    reconectar: "Reconectando",
    offline: "Sem conexão",
    pausada: "Pausada",
    apresentando: "Apresentando",
    foraDoAr: "Fora do ar",
    preparando: "Preparando",
    assistindo: "Assistindo",
    conexaoInstavel: "Conexão instável",
    falhou: "Falhou",
    saiu: "Saiu",
    conexaoBoa: "Conexão boa",
    conexaoRuim: "Conexão ruim",
    criarTransmissao: "Criar transmissão",
    assistir: "Assistir",
  },
  nav: {
    transmitir: "Transmitir",
    aoVivo: "Ao vivo",
    site: "Site",
    download: "Download",
    conta: "Conta",
    contaRotulo: "Ir para a sua conta",
    siteRotulo: "Versão web",
    downloadRotulo: "Baixar o aplicativo",
    tema: "Tema",
    temaClaro: "Tema claro",
    temaEscuro: "Tema escuro",
    temaSistema: "Tema do sistema",
    temaMudar: "{tema} — clique para mudar",
    idioma: "Idioma",
    idiomaMudar: "Idioma: {idioma} — clique para mudar",
    navegacaoPrincipal: "Navegação principal",
    /**
     * A barra inferior do celular tem 390px de largura e três abas. Os rótulos
     * abaixo foram encurtados por isso; em inglês e espanhol eles ficam mais
     * longos ("Help" já é o mais curto que ainda diz o que a aba faz), então
     * antes de encompridar qualquer um deles, confira a largura no celular.
     */
    inicio: "Início",
    ajudaCurto: "Ajuda",
  },
  home: {
    seloWeb: "Grátis, sem conta e sem instalar nada",
    seloApp: "Aplicativo para Windows, sem conta e sem cadastro",
    titulo: "Mostre sua tela",
    tituloDestaque: "mandando um link.",
    subtituloWeb:
      "O DanielLive abre uma sala no navegador e liga quem apresenta a quem assiste, direto de um para o outro. Não há programa para instalar nem conta para criar — só o link.",
    subtituloApp:
      "O DanielLive abre uma sala no seu computador e liga quem apresenta a quem assiste, direto de um para o outro. Você escolhe o que compartilhar e envia o link — a imagem não passa por um servidor que a guarde.",
    recursoNavegadoresWeb: "Chrome, Edge, Firefox e Safari",
    recursoNavegadoresApp: "Funciona em qualquer Windows 10 ou 11",
    recursoCelularWeb: "Assistir pelo celular funciona",
    recursoCelularApp: "Quem assiste usa só o navegador",
    recursoAudioWeb: "Pode incluir o áudio da aba",
    recursoAudioApp: "Pode incluir o áudio do sistema",
    recursoGravacaoWeb: "Nada fica gravado no servidor",
    recursoGravacaoApp: "Nada fica gravado no seu computador",
    comecarAgora: "Começar agora",
    comecarDescricao: "Crie uma sala e receba um link para convidar quem quiser.",
    criar: "Criar transmissão",
    entrarTitulo: "Já tem um link ou código?",
    entrarDica: "Cole o link que você recebeu ou digite o código da sala.",
    entrarPlaceholder: "Cole o link ou o código da sala",
    assistir: "Assistir",
    codigoInvalido: "Código inválido. Ele tem 9 caracteres, como K7M2PQR4T.",
    semCapturaTitulo: "Este navegador não sabe capturar a tela",
    semCapturaTexto:
      "Compartilhar tela depende de uma API que este navegador não oferece. O Chrome, o Edge e o Firefox no computador funcionam; no celular, só assistir.",
    ou: "ou",
    passosTitulo: "Como funciona",
    passosWeb: "Não há nada para configurar. O navegador cuida da conexão entre as duas pontas.",
    passosApp: "Não há nada para configurar. O aplicativo cuida da conexão entre as duas pontas.",
    passo1Titulo: "Crie a transmissão",
    passo1Web: "Escolha um nome e a sala é criada com um código próprio.",
    passo1App: "Escolha um nome e a sala é criada com um código próprio.",
    passo2Titulo: "Copie o link",
    passo2Web: "Um endereço único para mandar por onde você já conversa.",
    passo2App: "Um endereço único para mandar por onde você já conversa.",
    passo3Titulo: "Compartilhe a tela",
    passo3Web: "Você escolhe a tela, a janela ou a aba. Nada é capturado sem isso.",
    passo3App: "Você escolhe a tela ou a janela. Nada é capturado sem a sua confirmação.",
    verInstrucoes: "Ver as instruções completas e as dúvidas comuns",
    passo4Titulo: "A pessoa abre e vê",
    passo4Web: "Quem receber o link assiste na hora, sem instalar nada.",
    passo4App: "Quem receber o link abre no navegador e assiste na hora.",
    /** Os três cartões da seção de privacidade. */
    privacidade: {
      titulo1: "A imagem não passa pelo servidor",
      texto1Web:
        "Ela viaja direto de um navegador para o outro, cifrada pelo próprio WebRTC. O servidor só apresenta as duas pontas uma à outra.",
      texto1App:
        "Ela viaja direto do seu computador para quem assiste, cifrada pelo próprio WebRTC. O servidor só apresenta as duas pontas uma à outra.",
      titulo2: "Você decide o que mostrar",
      texto2Web:
        "O navegador sempre pergunta antes de capturar, e mostra uma barra enquanto isso dura. Fechar essa barra encerra a transmissão.",
      texto2App:
        "O aplicativo sempre pergunta o que compartilhar antes de capturar, e deixa a escolha visível na própria janela. Nada é capturado sem a sua confirmação.",
      titulo3: "Nada é gravado",
      texto3: "Não há gravação nem histórico. Quando todo mundo sai da sala, ela deixa de existir no servidor.",
    },
  },
  /** Textos que o formulário de entrada e o cartão de criação exibem. */
  entrada: {
    titulo: "Já tem um link ou código?",
    dica: "Cole o link que você recebeu ou digite o código da sala.",
    placeholder: "Cole o link ou o código da sala",
    codigoInvalido: "Código inválido. Ele tem 9 caracteres, como K7M2PQR4T.",
    indoNaSala: "Abrindo a sala…",
    colar: "Colar",
    colado: "Colado!",
    verifiqueOTexto: "Verifique o texto e tente de novo.",
    avisoInseguroTitulo: "Esta página não está em HTTPS",
    /**
     * As duas partes entre chaves são literais técnicos (`https://` e
     * `localhost`) e por isso ficam como marcador: assim a frase se reordena em
     * cada idioma sem que o endereço seja traduzido junto.
     */
    avisoInseguroTexto:
      "Os navegadores só permitem compartilhar a tela em conexões seguras. Aqui a captura vai falhar. Abra o site por {https} ou por {localhost}.",
  },
  criarTransmissao: {
    descricaoApp: "Você escolhe o que compartilhar e recebe o link na hora.",
    descricaoWeb: "Sem conta, sem instalar nada. Você escolhe o que compartilhar.",
  },
  /** Chat da sala (`components/SalaChat.tsx`): texto da conversa em tempo real. */
  chat: {
    titulo: "Chat da sala",
    dica: "As mensagens somem junto com a sala.",
    vazio: "Nenhuma mensagem ainda. Diga alô!",
    placeholder: "Escreva a sua mensagem…",
    aguardandoConexao: "Conectando à sala…",
    enviar: "Enviar",
    voce: "você",
  },
  /** Tela da conta (`/conta`): cadastro, entrada com Google e amizades. */
  conta: {
    tituloPagina: "Sua conta",
    subtitulo:
      "A conta serve para guardar os seus amigos daqui. O resto do DanielLive funciona igual, sem login.",
    criarTitulo: "Criar conta",
    criarDescricao: "E-mail, um nome e uma senha. Nada além disso.",
    entrarTitulo: "Entrar",
    entrarDescricao: "A senha que você criou aqui — ou o Google.",
    nome: "Nome",
    nomePlaceholder: "Como as pessoas te veem",
    email: "E-mail",
    emailPlaceholder: "voce@exemplo.com",
    senha: "Senha",
    senhaDica: "Pelo menos 8 caracteres. Quanto mais comprida, melhor.",
    criar: "Criar conta",
    criando: "Criando a conta…",
    entrar: "Entrar",
    entrando: "Entrando…",
    criarGoogle: "Criar conta com o Google",
    entrarGoogle: "Entrar com o Google",
    ou: "ou",
    sair: "Sair",
    saindo: "Saindo…",
    membroDesde: "Membro desde {data}",
    provedorGoogle: "Esta conta entra pelo Google, sem senha daqui.",
    pedidosTitulo: "Pedidos de amizade",
    aceitar: "Aceitar",
    recusar: "Recusar",
    remover: "Remover",
    amigosTitulo: "Amigos",
    amigosDescricao: "Adicione pelo e-mail que a pessoa usou na conta daqui.",
    amigosVazio: "Nenhum amigo ainda. O primeiro entra pelo e-mail da pessoa.",
    adicionarTitulo: "Adicionar amigo",
    adicionarDescricao: "A pessoa recebe o pedido ao abrir a própria conta.",
    adicionar: "Adicionar",
    adicionando: "Enviando…",
    mensagens: {
      pedido_enviado: "Pedido de amizade enviado.",
      amizade_direta: "Ela já tinha pedido para você — agora vocês são amigos.",
      amizade_aceita: "Amizade aceita!",
      removido: "Removido.",
    },
    erros: {
      email_invalido: "E-mail inválido.",
      senha_curta: "A senha precisa de pelo menos 8 caracteres.",
      nome_curto: "O nome precisa de pelo menos 2 letras.",
      email_em_uso: "Este e-mail já tem uma conta. Tente entrar.",
      credenciais: "E-mail ou senha errados.",
      nao_encontrado: "Ninguém tem conta com esse e-mail.",
      pedido_existente: "O pedido já foi enviado. Agora é esperar.",
      voce_mesmo: "Você já é amigo de si mesmo, por definição.",
      nao_logado: "Entre de novo na sua conta.",
      desconhecido: "Algo deu errado. Tente de novo.",
      googleFalhou: "Não deu para entrar com o Google. Tente de novo, ou use e-mail e senha.",
    },
  },
  /** Palco de vídeo (`components/VideoSurface.tsx`). */
  video: {
    vazio: "Nada sendo transmitido agora",
    iniciar: "Clique para iniciar o vídeo",
    aoVivo: "Ao vivo",
  },
  /** Campo de nome (`components/NameField.tsx`); os padrões valem quando o chamador não passa outro. */
  campo: {
    nome: "Seu nome",
    nomePlaceholder: "Como você quer aparecer",
  },
  /** Redes sociais (`components/RedesSociais.tsx`). */
  redes: {
    titulo: "Acompanhe o {marca}",
    /** O `{autor}` é o @ de quem mantém o projeto: não se traduz, só se posiciona. */
    descricao: "Novidades, bastidores e o que vem por aí. Feito por {autor}.",
    externo: "{rede} (abre em nova aba, site externo)",
    semConfirmadas: "Os endereços ainda estão sendo confirmados.",
    pendentesTitulo: "A confirmar",
    /** O sufixo `· @usuario` só existe quando a rede tem usuário: vem como marcador. */
    pendentesItem: "{rede}{usuario}",
    usuarioComArroba: " · @{usuario}",
    /** `lib/marca.ts` e `confirmado: true` são código: ficam literais dentro da frase. */
    pendentesInstrucao: "Preencha os endereços em {arquivo} e marque {confirmado}.",
    rodapeTitulo: "Redes",
    rodapeConfirmada: "{rede} de {autor} (abre em nova aba)",
    rodapePendente: "{rede} (endereço a confirmar)",
  },
  /**
   * Página `/site` (`app/site/page.tsx`).
   *
   * O `titulo` daqui é o `<h1>` visível e é diferente do `<title>` da aba, que
   * continua vindo de `metadata` — mesmo par de `download.titulo`.
   */
  comoFunciona: {
    titulo: "Como funciona",
    introWeb: "O DanielLive liga dois navegadores um ao outro. Quem apresenta captura a própria tela; quem assiste recebe a imagem direto de quem apresenta, sem passar por um servidor no meio.",
    introApp: "O DanielLive liga o seu computador a quem assiste. Você captura a tela pelo aplicativo; a outra ponta recebe a imagem direto de você, sem passar por um servidor no meio.",
    transmitirTitulo: "Para quem vai transmitir",
    tresPassos: "Três passos.",
    passo1: "Escreva um nome",
    passo1Texto: "É o que aparece para quem assiste. Pode ser o seu nome ou o assunto da apresentação.",
    passo2: "Clique em compartilhar",
    passo2Web: "O navegador abre a própria janela de escolha — tela inteira, uma janela ou uma aba. Nada é capturado antes de você confirmar ali.",
    passo2App: "O aplicativo abre a própria janela de escolha — tela inteira ou uma janela. Nada é capturado antes de você confirmar ali.",
    passo3: "Envie o link",
    passo3Texto: "Um endereço único por sala. Quem abrir entra e passa a ver. Dá para copiar o link ou só o código.",
    controlarTitulo: "O que dá para controlar",
    duranteTransmissao: "Durante a transmissão.",
    controlarPausar: "Pausar e retomar",
    controlarPausarTexto: "Interrompe o envio de quadros de verdade, sem derrubar a conexão nem pedir a tela de novo. Quem assiste vê a imagem congelar.",
    controlarQualidade: "Qualidade do vídeo",
    controlarQualidadeTexto: "Escolher 1080p, 720p ou 480p muda a nitidez e a banda consumida por cada pessoa. Em rede ruim, cair um degrau costuma resolver a travada.",
    controlarAudio: "Áudio da aba",
    controlarAudioTexto: "Ao compartilhar uma aba do navegador, o som dela pode ir junto. Para uma tela inteira, o navegador não captura o áudio do sistema.",
    controlarEncerrar: "Encerrar",
    controlarEncerrarTexto: "Fecha a captura e avisa quem está assistindo. A sala também termina se você fechar a aba.",
    navegadoresTitulo: "Navegadores",
    navegadoresDescricao: "O que funciona em cada um.",
    colNavegador: "Navegador",
    colTransmitir: "Transmitir",
    colAssistir: "Assistir",
    navChromeEdge: "Chrome e Edge (computador)",
    navFirefox: "Firefox (computador)",
    navSafari: "Safari (macOS)",
    navCelular: "Navegadores de celular",
    simComAudioAba: "Sim, com áudio da aba",
    simSemAudioAba: "Sim, sem áudio da aba",
    sim: "Sim",
    naoSoAssistir: "Não — só assistir",
    notaSegurancaWeb: "Compartilhar tela só é permitido em conexões seguras. Por isso o site precisa estar em {code} — ou em {code2}, quando você mesmo está rodando.",
    notaSegurancaApp: "A tabela vale para quem {destaque}: quem recebe o link abre no navegador que preferir. Quem transmite é o próprio DanielLive, neste computador.",
    tecnicoHttps: "https://",
    tecnicoLocalhost: "localhost",
    destaqueAssiste: "assiste",
    naoConectaTitulo: "Quando não conecta",
    naoConectaDescricao: "As duas causas mais comuns.",
    avisoRedeTitulo: "Rede corporativa ou Wi-Fi público",
    avisoRedeWeb: "Muitas redes bloqueiam a ligação direta entre dois computadores. Nesses casos é preciso um servidor intermediário (TURN) para retransmitir a imagem. O DanielLive não traz um embutido — quem publica o site precisa configurar o seu em {code}.",
    avisoRedeApp: "Muitas redes bloqueiam a ligação direta entre dois computadores. Nesses casos é preciso um servidor intermediário (TURN) para retransmitir a imagem. Se a sua rede for assim, avise quem mantém o aplicativo — o endereço do TURN é configurado na compilação.",
    tecnicoIceServers: "NEXT_PUBLIC_ICE_SERVERS",
    avisoSalaTitulo: "Sala não encontrada",
    avisoSalaTexto: "Salas deixam de existir quando o apresentador sai e ninguém mais está assistindo. Um código com um caractere trocado também cai aqui — o alfabeto do código não usa 0, O, 1 nem L justamente para evitar essa confusão.",
    privacidadeTitulo: "Privacidade",
    privacidadeDescricao: "O que o servidor vê e o que ele não vê.",
    privacidadeWeb: "O servidor do DanielLive só apresenta as duas pontas uma à outra: ele troca os dados de conexão e mantém a lista de quem está na sala. A imagem e o som viajam cifrados de um navegador para o outro e não passam por ele. Não há gravação, conta nem histórico.",
    privacidadeApp: "O servidor do DanielLive só apresenta as duas pontas uma à outra: ele troca os dados de conexão e mantém a lista de quem está na sala. A imagem e o som viajam cifrados do seu computador para quem assiste e não passam por ele. Não há gravação, conta nem histórico.",
    prontoTitulo: "Pronto para começar?",
    prontoTexto: "Crie uma transmissão ou entre em uma que já existe.",
  },
  site: {
    titulo: "DanielLive no navegador",
    descricao:
      "Nada para instalar. Você abre esta página, cria a sala e compartilha o link.",
    /** O `{marca}` é o nome do produto: não se traduz, só se posiciona. */
    tituloPagina: "Transmita sua tela pelo navegador",
    subtitulo:
      "Crie uma sala, receba um link e mande para quem quiser. Quem assiste abre o link e pronto — não instala nada, nem cria conta. A imagem vai direto de um computador para o outro.",
    comecarAgora: "Começar agora",
    entrarExistente: "Ou entre numa sala existente",
    ganhosTitulo: "O que você ganha",
    ganhos: {
      item1: "Nada para instalar, em nenhum dos lados",
      item2: "Nenhuma conta e nenhum cadastro",
      item3: "Funciona no Chrome, Edge, Firefox e Safari",
      item4: "Quem assiste pode usar o celular",
      item5: "A imagem não passa por um servidor que a guarde",
    },
    limiteTitulo: "O limite do navegador",
    limiteTexto1:
      "Para proteger você, o navegador sempre pede confirmação e só oferece o que ele mesmo permite capturar. Em alguns casos isso significa escolher entre a tela inteira, uma janela ou uma aba — e não um recorte livre.",
    limiteTexto2:
      "O aplicativo para Windows não tem essa limitação: ele captura com a placa de vídeo e deixa você escolher exatamente o que mostrar.",
    limiteLink: "Ver o aplicativo para Windows",
    privacidadeTitulo: "Privacidade",
    privacidadeTexto:
      "O servidor do DanielLive só apresenta as duas pontas uma à outra. A imagem e o áudio viajam direto entre quem transmite e quem assiste, e nada é gravado.",
    privacidadeLink: "Como funciona",
  },
  /**
   * Página `/download` (`app/download/page.tsx`).
   *
   * Rótulos, descrições e tamanhos dos arquivos continuam vindo de
   * `lib/marca.ts`, em português — traduzi-los é uma passada à parte.
   */
  download: {
    titulo: "Baixar o DanielLive",
    descricao: "Instale uma vez e abra pelo menu Iniciar.",
    botao: "Baixar o instalador",
    emBreve: "Download em breve",
    demaisOpcoes: "Outras opções",
    semInstalar: "Prefere não instalar?",
    semInstalarTexto:
      "A versão web faz o mesmo pelo navegador, sem baixar nada. Ela é a escolha certa para uma transmissão rápida ou para quem está num computador que não é seu.",
    usarNavegador: "Usar pelo navegador",
    requisitos: "Requisitos",
    /** Rótulos e descrições dos arquivos, que antes vinham de `lib/marca.ts`. */
    arquivos: {
      instaladorRotulo: "Instalador",
      instaladorDescricao: "Instala o DanielLive no Windows. Recomendado para a maioria.",
      portatilRotulo: "Versão portátil",
      portatilDescricao: "Não instala nada: abre direto do arquivo. Bom para pen drive.",
      msiRotulo: "Pacote .msi",
      msiDescricao: "Para instalar em rede ou por política de empresa.",
    },
    requisitosLista: [
      "Windows 10 ou 11, 64 bits",
      "4 GB de memória",
      "Placa de vídeo com driver atualizado (a captura de tela usa a GPU)",
    ],
    /** O `{marca}` é o nome do produto: não se traduz, só se posiciona. */
    tituloPagina: "Baixe o {marca} para Windows",
    subtitulo:
      "O aplicativo transmite sua tela com a qualidade da placa de vídeo e deixa você escolher a tela ou a janela exata que quer mostrar. Quem assiste só precisa do navegador — nada para instalar do outro lado.",
    /**
     * A frase entrega a escolha a quem lê e termina no link "versão web". O
     * `{link}` é um marcador com o `<Link>` dentro: em inglês e espanhol o
     * trecho não cai no mesmo lugar da oração, e concatenar fixaria a ordem do
     * português.
     */
    emBreveAviso:
      "Os instaladores estão prontos, mas ainda não foram publicados. Enquanto isso, use a {link} — ela funciona sem instalar nada.",
    emBreveLink: "versão web",
    antesDeBaixar: "Antes de baixar",
    outrasTitulo: "Outras opções",
    /** O `·` separa rótulo e tamanho; o tamanho vem de `lib/marca.ts`. */
    arquivoMeta: "{rotulo} · {tamanho}",
  },
  transmitir: {
    titulo: "Sua transmissão",
    foraDoAr: "Fora do ar",
    conectado: "Conectado",
    palcoVazio: "Sua tela aparece aqui quando você começar",
    comecar: "Compartilhar minha tela",
    transmitirDeNovo: "Transmitir de novo",
    encerrar: "Encerrar",
    pausar: "Pausar",
    retomar: "Retomar",
    linkTitulo: "Link para convidar",
    linkDica: "Quem abrir este endereço entra na sala e passa a ver sua tela.",
    ouDiteCodigo: "Ou dite só o código:",
    nomeTitulo: "Seu nome",
    nomeDica: "É o nome que aparece para quem está assistindo.",
    nomePlaceholder: "Como você quer aparecer",
    nomeObrigatorio: "Escreva um nome para poder começar.",
    espectadores: "Quem está assistindo",
    ninguemAinda: "Ninguém entrou ainda. Envie o link.",
    listaEnche: "A lista se preenche conforme as pessoas abrem o link.",
    qualidade: "Qualidade do vídeo",
    qualidadeCurta: {
      auto: "Automática",
      "1080p": "1080p",
      "720p": "720p",
      "480p": "480p",
    },
    qualidadeLonga: {
      auto: "Automática",
      "1080p": "1080p (nitidez máxima)",
      "720p": "720p (equilibrada)",
      "480p": "480p (economia de banda)",
    },
    qualidadeEAudio: "Qualidade e áudio",
    enquantoTransmite: "Enquanto transmite",
    /** `{botao}` é o nome de um botão: "Encerrar" (nosso) ou o do Chrome. */
    dicaApp1: "O botão {botao} para a captura e avisa quem está assistindo. O ícone de compartilhamento do Windows faz o mesmo.",
    dicaApp2: "Fechar o aplicativo derruba a transmissão para todo mundo.",
    dicaWeb1: "A barra do navegador com o botão {botao} encerra a transmissão. O DanielLive percebe e avisa.",
    dicaWeb2: "Fechar esta aba derruba a transmissão para todo mundo.",
    dicaPausar: "Pausar interrompe o envio de verdade, sem gastar banda.",
    botaoEncerrar: "Encerrar",
    botaoPararDeCompartilhar: "Parar de compartilhar",
    escolhasValemProxima: "Aplicadas na hora e lembradas na próxima transmissão.",
    incluirAudioAba: "Incluir o áudio da aba",
    audioSoEmAbaApache:
      "Só funciona ao compartilhar uma aba do navegador. Para uma tela inteira, o áudio do sistema não é capturado.",
    avisoPrimeiraVez:
      "Na primeira vez, o navegador pergunta o que compartilhar. Dá para trocar depois sem recarregar a página.",
    linkCopiar: "Copiar link",
    linkApareceQuando: "O link aparece aqui assim que a sala for criada.",
    criandoSala: "Criando sua sala…",
    espectadoresContagem: {
      zero: "ninguém assistindo",
      one: "1 assistindo",
      other: "{n} assistindo",
    },
    espectadoresDe: "{n} de {max} possíveis.",
    /** Textos do painel que a primeira passada não alcançou. */
    audio: "Áudio",
    resolucao: "Resolução",
    resolucaoDica:
      "Quanto maior, mais nítido e mais banda consumida por quem assiste. Em uma rede ruim, cair para 720p costuma resolver a travada.",
    maisDetalhes: "Mais detalhes…",
    telaCompartilhada: "Tela sendo compartilhada",
    listaSePreenche: "A lista se preenche conforme as pessoas abrem o link.",
    nadaCapturadoAntes: "Nada é capturado antes de você confirmar a escolha.",
    escolhaNoAplicativo: "Escolha o que compartilhar na janela do aplicativo",
    escolhaNoNavegador: "Escolha o que compartilhar na janela do navegador",
    semCapturaTexto:
      "Compartilhar tela depende de uma API que este navegador não oferece. O Chrome, o Edge e o Firefox no computador funcionam; no celular, só assistir.",
    semCapturaTitulo: "Este navegador não sabe capturar a tela",
    erroTitulo: "Não deu para continuar",
  },
  assistir: {
    titulo: "Assistindo",
    entrando: "Entrando na sala…",
    aguardando: "Aguardando quem transmite…",
    aoVivoAgora: "Ao vivo agora",
    /** Título da sala: `{nome}` é o nome de quem transmite. */
    transmissaoDe: "Transmissão de {nome}",
    salaDeTransmissao: "Sala de transmissão",
    voltarAoInicio: "Voltar ao início",
    pausada: "Pausada",
    apresentando: "Apresentando",
    apresentador: "Apresentador",
    ninguemNaSala: "Ninguém na sala ainda.",
    aguardandoApresentador: "Aguardando o apresentador",
    aindaNaoComecou: "{nome} ainda não começou",
    conectado: "Conectado",
    transmissaoTerminou: "A transmissão terminou",
    salaNaoEncontrada: "Sala não encontrada",
    salaCheia: "Sala cheia",
    naoFoiPossivelConectar: "Não foi possível conectar",
    dicaRedeTitulo: "Se a imagem travar",
    dicaRede1: "Feche outras abas que estejam usando a rede.",
    dicaRede2: "Prefira o cabo ao Wi-Fi, quando houver.",
    dicaRede3: "Peça para quem transmite escolher uma qualidade menor.",
    nestaSala: "Nesta sala",
    soVoce: "Só você por aqui.",
    quemTransmiteMarcado: "Quem transmite aparece marcado.",
    quemApresenta: "Quem apresenta",
    /** O transmissor pausou: {nome} é o nome dele. */
    pausouTransmissao: "{nome} pausou a transmissão",
    paraSaberQuemEntrou: "Para o apresentador saber quem entrou.",
    seuNome: "Seu nome",
    envieMesmoLink: "Envie o mesmo link para quem quiser.",
    copiarEsteLink: "Copiar este link",
    digaSeuNome: "Diga seu nome",
    convidarMaisGente: "Convidar mais gente",
    /** Textos do palco e dos avisos que a primeira passada não alcançou. */
    pausadaDica: "A imagem fica parada onde estava. Assim que retomar, ela volta sozinha — não precisa recarregar nada.",
    aguardandoDica: "A página se conecta sozinha assim que a transmissão começar. Você pode deixá-la aberta.",
    naoExisteTitulo: "Esta sala não existe (ou já terminou)",
    naoExisteTexto: "Confira o link com quem enviou. Salas deixam de existir quando o apresentador sai e ninguém mais está assistindo.",
    cheiaTitulo: "A sala está cheia",
    cheiaTexto: "O limite é de 32 pessoas assistindo ao mesmo tempo. Tente de novo em alguns minutos.",
    encerradaTitulo: "A transmissão terminou",
    encerradaTexto: "Quem apresentava encerrou o compartilhamento. Você pode fechar esta página.",
    erroTitulo: "Não foi possível ver o vídeo",
    erroTexto: "A conexão falhou.",
    tentarDeNovo: "Tentar de novo",
    caiuTitulo: "A conexão caiu, tentando reconectar",
    caiuTexto: "A imagem volta sozinha quando a rede se recuperar.",
    telaCheiaVer: "Ver em tela cheia",
    telaCheiaSair: "Sair da tela cheia",
  },
  erro: {
    generico: "Não deu para continuar",
    tentarDeNovo: "Tentar de novo",
    paginaNaoEncontrada: "Página não encontrada",
    voltarHome: "Voltar para o início",
    /** `app/not-found.tsx`. O código de exemplo e o conjunto `0, O, 1, L` ficam literais. */
    naoEncontradoTitulo: "Não encontramos esta página",
    naoEncontradoTexto:
      "Se você chegou por um link de transmissão, confira se ele foi copiado por inteiro. O código de uma sala do DanielLive tem 9 caracteres, como {codigo} — e nunca usa 0, O, 1 ou L, justamente para não confundir quem digita de memória.",
    /**
     * Mensagens de `lib/useHost.ts`, `lib/useViewer.ts` e `lib/webrtc.ts`.
     *
     * Ficam aqui, e não dentro desses arquivos, porque não são componentes: um
     * hook de tradução não funcionaria numa função chamada de um tratador de
     * evento. Quem tem o dicionário é quem chama.
     *
     * `conexaoComTurn` e `conexaoSemTurn` são duas mensagens técnicas distintas
     * — qual delas se aplica depende de haver um servidor TURN configurado, e
     * isso não é decisão de tradução.
     */
    conexaoComTurn: "Não foi possível conectar. Verifique sua rede e tente novamente.",
    conexaoSemTurn:
      "Não foi possível conectar direto com o anfitrião. Isso costuma acontecer em redes corporativas ou com firewall rígido — um servidor TURN resolveria (veja NEXT_PUBLIC_TURN_URL no README).",
    salaCheia: "A sala atingiu o limite de espectadores.",
    salaNaoCriada: "Não foi possível criar a sala. Tente novamente.",
    capturaCancelada: "Você cancelou a seleção de tela. Nada foi transmitido.",
    capturaNaoIniciada: "Não foi possível iniciar a captura.",
    naoRespondeuAoAnfitriao: "Não foi possível responder ao anfitrião.",
    servidorReiniciando: "O servidor está reiniciando. Recarregue a página em instantes.",
    muitasSalas: "Você criou muitas transmissões em pouco tempo. Aguarde um minuto.",
    operacaoRecusada: "O servidor recusou a operação. Tente novamente.",
    paradaPeloNavegador: "O compartilhamento foi encerrado pelo navegador.",
  },
  rodape: {
    criar: "Criar transmissão",
    comoFunciona: "Como funciona",
    sobreWebrtc: "Sobre WebRTC",
    redes: "Redes",
    licencaWeb:
      "Software livre sob licença MIT. A imagem viaja direto de um navegador para o outro — o servidor só apresenta as partes e nunca vê o conteúdo.",
    licencaApp:
      "Software livre sob licença MIT. A imagem viaja direto do seu computador para quem assiste — o servidor só apresenta as partes e nunca vê o conteúdo.",
    /** `aria-label` do `<nav>`; "Rodapé" aqui é o nome da região, não o objeto. */
    navRotulo: "Rodapé",
    /** O `{ano}` vem de `new Date()`; a versão do produto fica literal. */
    copyright: "© {ano} DanielLive · v1.0.0",
  },
};

/**
 * A forma do dicionário, com os valores alargados para `string`.
 *
 * `typeof ptBR` sozinho inferiria o texto literal de cada chave e recusaria
 * qualquer tradução. O `-readonly` combinado com o mapa `string` mantém apenas
 * o que interessa: **quais chaves existem**.
 */
type Alargar<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : Alargar<T[K]>;
};

export type Dicionario = Alargar<typeof ptBR>;

/**
 * Os outros idiomas.
 *
 * Tipados como `Dicionario`, e não como objetos livres: assim, esquecer uma
 * chave é erro de compilação em vez de um texto em português no meio da versão
 * em inglês. É a única garantia barata de tradução completa.
 *
 * A tradução não é literal. "Mostre sua tela mandando um link" vira "Show your
 * screen by sending a link" — a construção com gerúndio é a que soa natural em
 * inglês, ainda que a palavra a palavra fosse outra.
 */
const en: Dicionario = {
  comum: {
    voltarAoInicio: "Back to home",
    pularParaConteudo: "Skip to content",
    copiar: "Copy",
    copiado: "Copied!",
    naoCopiou: "Could not copy",
    nadaParaColar: "The clipboard is empty.",
    copiarLink: "Copy link",
    copiarCodigo: "Copy code",
    fechar: "Close",
    cancelar: "Cancel",
    salvar: "Save",
    carregando: "Loading",
    ajuda: "Need help?",
    inicio: "home",
    entrarComCodigo: "Join with a code",
    dispensarAviso: "Dismiss notice",
    semNome: "No name",
    aoVivo: "Live",
    conectado: "Connected",
    conectar: "Connecting",
    reconectar: "Reconnecting",
    offline: "Offline",
    pausada: "Paused",
    apresentando: "Presenting",
    foraDoAr: "Off air",
    preparando: "Getting ready",
    assistindo: "Watching",
    conexaoInstavel: "Unstable connection",
    falhou: "Failed",
    saiu: "Left",
    conexaoBoa: "Good connection",
    conexaoRuim: "Poor connection",
    criarTransmissao: "Start streaming",
    assistir: "Watch",
  },
  nav: {
    transmitir: "Go live",
    aoVivo: "Live",
    site: "Web",
    download: "Download",
    conta: "Account",
    contaRotulo: "Go to your account",
    siteRotulo: "Web version",
    downloadRotulo: "Download the app",
    tema: "Theme",
    temaClaro: "Light theme",
    temaEscuro: "Dark theme",
    temaSistema: "System theme",
    temaMudar: "{tema} — click to change",
    idioma: "Language",
    idiomaMudar: "Language: {idioma} — click to change",
    navegacaoPrincipal: "Main navigation",
    /* Rótulos curtos por causa dos 390px de largura da barra inferior. */
    inicio: "Home",
    ajudaCurto: "Help",
  },
  home: {
    seloWeb: "Free, no account and nothing to install",
    seloApp: "Windows app, no account and no sign-up",
    titulo: "Show your screen",
    tituloDestaque: "by sending a link.",
    subtituloWeb:
      "DanielLive opens a room in your browser and connects the presenter straight to the viewers, one to one. There is no program to install and no account to create — just the link.",
    subtituloApp:
      "DanielLive opens a room on your computer and connects the presenter straight to the viewers, one to one. You pick what to share and send the link — the image never passes through a server that stores it.",
    recursoNavegadoresWeb: "Chrome, Edge, Firefox and Safari",
    recursoNavegadoresApp: "Works on any Windows 10 or 11",
    recursoCelularWeb: "Watching on a phone works",
    recursoCelularApp: "Viewers only need a browser",
    recursoAudioWeb: "Can include tab audio",
    recursoAudioApp: "Can include system audio",
    recursoGravacaoWeb: "Nothing is recorded on the server",
    recursoGravacaoApp: "Nothing is recorded on your computer",
    comecarAgora: "Start now",
    comecarDescricao: "Create a room and get a link to invite anyone.",
    criar: "Start streaming",
    entrarTitulo: "Already have a link or code?",
    entrarDica: "Paste the link you received or type the room code.",
    entrarPlaceholder: "Paste the link or the room code",
    assistir: "Watch",
    codigoInvalido: "Invalid code. It has 9 characters, like K7M2PQR4T.",
    semCapturaTitulo: "This browser cannot capture your screen",
    semCapturaTexto:
      "Screen sharing needs an API this browser does not offer. Chrome, Edge and Firefox on a computer work; on a phone you can only watch.",
    ou: "or",
    passosTitulo: "How it works",
    passosWeb: "There is nothing to set up. The browser handles the connection between the two ends.",
    passosApp: "There is nothing to set up. The app handles the connection between the two ends.",
    passo1Titulo: "Create the stream",
    passo1Web: "Pick a name and the room is created with its own code.",
    passo1App: "Pick a name and the room is created with its own code.",
    passo2Titulo: "Copy the link",
    passo2Web: "A single address to send wherever you already talk.",
    passo2App: "A single address to send wherever you already talk.",
    passo3Titulo: "Share your screen",
    passo3Web: "You pick the screen, window or tab. Nothing is captured without that.",
    passo3App: "You pick the screen or window. Nothing is captured without your confirmation.",
    verInstrucoes: "See the full instructions and common questions",
    passo4Titulo: "They open and watch",
    passo4Web: "Whoever gets the link watches right away, with nothing to install.",
    passo4App: "Whoever gets the link opens it in a browser and watches right away.",
    privacidade: {
      titulo1: "The image does not go through the server",
      texto1Web:
        "It travels straight from one browser to the other, encrypted by WebRTC itself. The server only introduces the two ends to each other.",
      texto1App:
        "It travels straight from your computer to the viewers, encrypted by WebRTC itself. The server only introduces the two ends to each other.",
      titulo2: "You decide what to show",
      texto2Web:
        "The browser always asks before capturing, and shows a bar while it lasts. Closing that bar ends the stream.",
      texto2App:
        "The app always asks what to share before capturing, and keeps the choice visible in its own window. Nothing is captured without your confirmation.",
      titulo3: "Nothing is recorded",
      texto3: "There is no recording and no history. When everyone leaves the room, it stops existing on the server.",
    },
  },
  entrada: {
    titulo: "Already have a link or code?",
    dica: "Paste the link you received or type the room code.",
    placeholder: "Paste the link or the room code",
    codigoInvalido: "Invalid code. It has 9 characters, like K7M2PQR4T.",
    indoNaSala: "Opening the room…",
    colar: "Paste",
    colado: "Pasted!",
    verifiqueOTexto: "Check the text and try again.",
    avisoInseguroTitulo: "This page is not on HTTPS",
    avisoInseguroTexto:
      "Browsers only allow screen sharing on secure connections. Capture will fail here. Open the site over {https} or on {localhost}.",
  },
  criarTransmissao: {
    descricaoApp: "You pick what to share and get the link right away.",
    descricaoWeb: "No account, nothing to install. You pick what to share.",
  },
  chat: {
    titulo: "Room chat",
    dica: "Messages disappear with the room.",
    vazio: "No messages yet. Say hi!",
    placeholder: "Write your message…",
    aguardandoConexao: "Connecting to the room…",
    enviar: "Send",
    voce: "you",
  },
  conta: {
    tituloPagina: "Your account",
    subtitulo:
      "An account keeps your friends from here. The rest of DanielLive works the same, signed in or not.",
    criarTitulo: "Create account",
    criarDescricao: "E-mail, a name, and a password. Nothing else.",
    entrarTitulo: "Sign in",
    entrarDescricao: "The password you created here — or Google.",
    nome: "Name",
    nomePlaceholder: "How people see you",
    email: "E-mail",
    emailPlaceholder: "you@example.com",
    senha: "Password",
    senhaDica: "At least 8 characters. Longer is better.",
    criar: "Create account",
    criando: "Creating the account…",
    entrar: "Sign in",
    entrando: "Signing in…",
    criarGoogle: "Sign up with Google",
    entrarGoogle: "Sign in with Google",
    ou: "or",
    sair: "Sign out",
    saindo: "Signing out…",
    membroDesde: "Member since {data}",
    provedorGoogle: "This account signs in with Google — no password stored here.",
    pedidosTitulo: "Friend requests",
    aceitar: "Accept",
    recusar: "Decline",
    remover: "Remove",
    amigosTitulo: "Friends",
    amigosDescricao: "Add people by the e-mail they used for their account here.",
    amigosVazio: "No friends yet. The first one goes in by e-mail.",
    adicionarTitulo: "Add friend",
    adicionarDescricao: "The person sees the request when they open their account.",
    adicionar: "Add",
    adicionando: "Sending…",
    mensagens: {
      pedido_enviado: "Friend request sent.",
      amizade_direta: "They had already asked you — now you're friends.",
      amizade_aceita: "Friendship accepted!",
      removido: "Removed.",
    },
    erros: {
      email_invalido: "Invalid e-mail.",
      senha_curta: "The password needs at least 8 characters.",
      nome_curto: "The name needs at least 2 letters.",
      email_em_uso: "This e-mail already has an account. Try signing in.",
      credenciais: "Wrong e-mail or password.",
      nao_encontrado: "Nobody has an account with that e-mail.",
      pedido_existente: "The request was already sent.",
      voce_mesmo: "You're already your own friend, by definition.",
      nao_logado: "Please sign in again.",
      desconhecido: "Something went wrong. Try again.",
      googleFalhou: "Google sign-in didn't work. Try again, or use e-mail and password.",
    },
  },
  video: {
    vazio: "Nothing being streamed right now",
    iniciar: "Click to start the video",
    aoVivo: "Live",
  },
  campo: {
    nome: "Your name",
    nomePlaceholder: "How you want to appear",
  },
  redes: {
    titulo: "Follow {marca}",
    descricao: "News, behind the scenes and what is coming next. Made by {autor}.",
    externo: "{rede} (opens in a new tab, external site)",
    semConfirmadas: "The addresses are still being confirmed.",
    pendentesTitulo: "To confirm",
    pendentesItem: "{rede}{usuario}",
    usuarioComArroba: " · @{usuario}",
    pendentesInstrucao: "Fill in the addresses in {arquivo} and mark {confirmado}.",
    rodapeTitulo: "Social",
    rodapeConfirmada: "{rede} by {autor} (opens in a new tab)",
    rodapePendente: "{rede} (address to confirm)",
  },
  comoFunciona: {
    titulo: "How it works",
    introWeb: "DanielLive connects two browsers to each other. The presenter captures their own screen; the viewer receives the image straight from the presenter, without going through a server in between.",
    introApp: "DanielLive connects your computer to the viewers. You capture the screen through the app; the other end receives the image straight from you, without going through a server in between.",
    transmitirTitulo: "If you are going to stream",
    tresPassos: "Three steps.",
    passo1: "Type a name",
    passo1Texto: "This is what viewers see. It can be your name or the subject of the presentation.",
    passo2: "Click share",
    passo2Web: "The browser opens its own picker — whole screen, a window or a tab. Nothing is captured before you confirm there.",
    passo2App: "The app opens its own picker — whole screen or a window. Nothing is captured before you confirm there.",
    passo3: "Send the link",
    passo3Texto: "One address per room. Whoever opens it joins and starts watching. You can copy the link or just the code.",
    controlarTitulo: "What you can control",
    duranteTransmissao: "During the stream.",
    controlarPausar: "Pause and resume",
    controlarPausarTexto: "Really stops sending frames, without dropping the connection or asking for the screen again. Viewers see the image freeze.",
    controlarQualidade: "Video quality",
    controlarQualidadeTexto: "Choosing 1080p, 720p or 480p changes the sharpness and the bandwidth each person uses. On a weak network, dropping one step usually fixes the stutter.",
    controlarAudio: "Tab audio",
    controlarAudioTexto: "When sharing a browser tab, its sound can come along. For a whole screen, the browser does not capture system audio.",
    controlarEncerrar: "End",
    controlarEncerrarTexto: "Stops the capture and tells the viewers. The room also ends if you close the tab.",
    navegadoresTitulo: "Browsers",
    navegadoresDescricao: "What works in each one.",
    colNavegador: "Browser",
    colTransmitir: "Stream",
    colAssistir: "Watch",
    navChromeEdge: "Chrome and Edge (computer)",
    navFirefox: "Firefox (computer)",
    navSafari: "Safari (macOS)",
    navCelular: "Phone browsers",
    simComAudioAba: "Yes, with tab audio",
    simSemAudioAba: "Yes, without tab audio",
    sim: "Yes",
    naoSoAssistir: "No — watch only",
    notaSegurancaWeb: "Screen sharing is only allowed on secure connections. That is why the site must be on {code} — or on {code2}, when you are running it yourself.",
    notaSegurancaApp: "The table applies to whoever is {destaque}: they open the link in whichever browser they prefer. The one streaming is DanielLive itself, on this computer.",
    tecnicoHttps: "https://",
    tecnicoLocalhost: "localhost",
    destaqueAssiste: "watching",
    naoConectaTitulo: "When it will not connect",
    naoConectaDescricao: "The two most common causes.",
    avisoRedeTitulo: "Corporate network or public Wi-Fi",
    avisoRedeWeb: "Many networks block the direct connection between two computers. In those cases an intermediary server (TURN) is needed to relay the image. DanielLive does not ship one — whoever publishes the site has to configure theirs in {code}.",
    avisoRedeApp: "Many networks block the direct connection between two computers. In those cases an intermediary server (TURN) is needed to relay the image. If your network is like that, tell whoever maintains the app — the TURN address is set at build time.",
    tecnicoIceServers: "NEXT_PUBLIC_ICE_SERVERS",
    avisoSalaTitulo: "Room not found",
    avisoSalaTexto: "Rooms stop existing when the presenter leaves and nobody is watching anymore. A code with one character swapped also lands here — the code alphabet avoids 0, O, 1 and L precisely to prevent that confusion.",
    privacidadeTitulo: "Privacy",
    privacidadeDescricao: "What the server sees and what it does not.",
    privacidadeWeb: "The DanielLive server only introduces the two ends to each other: it exchanges the connection data and keeps the list of who is in the room. The image and sound travel encrypted from one browser to the other and do not pass through it. There is no recording, no account and no history.",
    privacidadeApp: "The DanielLive server only introduces the two ends to each other: it exchanges the connection data and keeps the list of who is in the room. The image and sound travel encrypted from your computer to the viewers and do not pass through it. There is no recording, no account and no history.",
    prontoTitulo: "Ready to start?",
    prontoTexto: "Create a stream or join one that already exists.",
  },
  site: {
    titulo: "DanielLive in your browser",
    descricao: "Nothing to install. Open this page, create the room and share the link.",
    tituloPagina: "Share your screen from the browser",
    subtitulo:
      "Create a room, get a link and send it to anyone. Viewers open the link and that is it — nothing to install and no account to create. The image goes straight from one computer to the other.",
    comecarAgora: "Start now",
    entrarExistente: "Or join an existing room",
    ganhosTitulo: "What you get",
    ganhos: {
      item1: "Nothing to install, on either side",
      item2: "No account and no sign-up",
      item3: "Works in Chrome, Edge, Firefox and Safari",
      item4: "Viewers can use a phone",
      item5: "The image never passes through a server that stores it",
    },
    limiteTitulo: "The browser's limit",
    limiteTexto1:
      "To protect you, the browser always asks for confirmation and only offers what it allows you to capture. In some cases that means choosing between the whole screen, a window or a tab — and not a free-form crop.",
    limiteTexto2:
      "The Windows app has no such limitation: it captures through the video card and lets you pick exactly what to show.",
    limiteLink: "See the Windows app",
    privacidadeTitulo: "Privacy",
    privacidadeTexto:
      "The DanielLive server only introduces the two ends to each other. Image and audio travel straight between the presenter and the viewers, and nothing is recorded.",
    privacidadeLink: "How it works",
  },
  download: {
    titulo: "Download DanielLive",
    descricao: "Install once and open it from the Start menu.",
    botao: "Download the installer",
    emBreve: "Download coming soon",
    demaisOpcoes: "Other options",
    semInstalar: "Rather not install?",
    semInstalarTexto:
      "The web version does the same in your browser, with nothing to download. It is the right choice for a quick stream or on a computer that is not yours.",
    usarNavegador: "Use it in the browser",
    requisitos: "Requirements",
    arquivos: {
      instaladorRotulo: "Installer",
      instaladorDescricao: "Installs DanielLive on Windows. Recommended for most people.",
      portatilRotulo: "Portable version",
      portatilDescricao: "Installs nothing: runs straight from the file. Good for a USB stick.",
      msiRotulo: ".msi package",
      msiDescricao: "For installing over a network or by company policy.",
    },
    requisitosLista: [
      "Windows 10 or 11, 64-bit",
      "4 GB of memory",
      "Graphics card with an up-to-date driver (screen capture uses the GPU)",
    ],
    tituloPagina: "Download {marca} for Windows",
    subtitulo:
      "The app streams your screen with the quality of your video card and lets you pick the exact screen or window you want to show. Viewers only need a browser — nothing to install on their side.",
    emBreveAviso:
      "The installers are ready, but they have not been published yet. In the meantime, use the {link} — it works without installing anything.",
    emBreveLink: "web version",
    antesDeBaixar: "Before you download",
    outrasTitulo: "Other options",
    arquivoMeta: "{rotulo} · {tamanho}",
  },
  transmitir: {
    titulo: "Your stream",
    foraDoAr: "Off air",
    conectado: "Connected",
    palcoVazio: "Your screen shows up here once you start",
    comecar: "Share my screen",
    transmitirDeNovo: "Stream again",
    encerrar: "End",
    pausar: "Pause",
    retomar: "Resume",
    linkTitulo: "Invite link",
    linkDica: "Anyone who opens this address joins the room and starts watching your screen.",
    ouDiteCodigo: "Or just read out the code:",
    nomeTitulo: "Your name",
    nomeDica: "This is the name viewers see.",
    nomePlaceholder: "How you want to appear",
    nomeObrigatorio: "Type a name to get started.",
    espectadores: "Who is watching",
    ninguemAinda: "Nobody has joined yet. Send the link.",
    listaEnche: "The list fills up as people open the link.",
    qualidade: "Video quality",
    qualidadeCurta: {
      auto: "Automatic",
      "1080p": "1080p",
      "720p": "720p",
      "480p": "480p",
    },
    qualidadeLonga: {
      auto: "Automatic",
      "1080p": "1080p (sharpest)",
      "720p": "720p (balanced)",
      "480p": "480p (saves bandwidth)",
    },
    qualidadeEAudio: "Quality and audio",
    enquantoTransmite: "While you stream",
    dicaApp1: "The {botao} button stops the capture and tells the viewers. The Windows share icon does the same.",
    dicaApp2: "Closing the app drops the stream for everyone.",
    dicaWeb1: "The browser bar with the {botao} button ends the stream. DanielLive notices and lets you know.",
    dicaWeb2: "Closing this tab drops the stream for everyone.",
    dicaPausar: "Pausing really stops sending, without spending bandwidth.",
    botaoEncerrar: "End",
    botaoPararDeCompartilhar: "Stop sharing",
    escolhasValemProxima: "Applied right away and remembered for the next stream.",
    incluirAudioAba: "Include tab audio",
    audioSoEmAbaApache:
      "Only works when sharing a browser tab. For a whole screen, system audio is not captured.",
    avisoPrimeiraVez:
      "The first time, the browser asks what to share. You can switch later without reloading the page.",
    linkCopiar: "Copy link",
    linkApareceQuando: "The link shows up here as soon as the room is created.",
    criandoSala: "Creating your room…",
    espectadoresContagem: {
      zero: "nobody watching",
      one: "1 watching",
      other: "{n} watching",
    },
    espectadoresDe: "{n} of {max} possible.",
    audio: "Audio",
    resolucao: "Resolution",
    resolucaoDica:
      "The higher it is, the sharper and the more bandwidth each viewer uses. On a weak network, dropping to 720p usually fixes the stutter.",
    maisDetalhes: "More details…",
    telaCompartilhada: "Screen being shared",
    listaSePreenche: "The list fills in as people open the link.",
    nadaCapturadoAntes: "Nothing is captured before you confirm the choice.",
    escolhaNoAplicativo: "Choose what to share in the app window",
    escolhaNoNavegador: "Choose what to share in the browser window",
    semCapturaTexto:
      "Screen sharing depends on an API this browser does not offer. Chrome, Edge and Firefox on a computer work; on a phone, watching only.",
    semCapturaTitulo: "This browser cannot capture the screen",
    erroTitulo: "Could not continue",
  },
  assistir: {
    titulo: "Watching",
    entrando: "Joining the room…",
    aguardando: "Waiting for the presenter…",
    aoVivoAgora: "Live now",
    transmissaoDe: "Stream by {nome}",
    salaDeTransmissao: "Stream room",
    voltarAoInicio: "Back to home",
    pausada: "Paused",
    apresentando: "Presenting",
    apresentador: "Presenter",
    ninguemNaSala: "Nobody in the room yet.",
    aguardandoApresentador: "Waiting for the presenter",
    aindaNaoComecou: "{nome} has not started yet",
    conectado: "Connected",
    transmissaoTerminou: "The stream ended",
    salaNaoEncontrada: "Room not found",
    salaCheia: "Room full",
    naoFoiPossivelConectar: "Could not connect",
    dicaRedeTitulo: "If the image freezes",
    dicaRede1: "Close other tabs that are using the network.",
    dicaRede2: "Prefer cable over Wi-Fi when you can.",
    dicaRede3: "Ask the presenter to pick a lower quality.",
    nestaSala: "In this room",
    soVoce: "Just you here.",
    quemTransmiteMarcado: "The presenter is marked.",
    quemApresenta: "The presenter",
    pausouTransmissao: "{nome} paused the stream",
    paraSaberQuemEntrou: "So the presenter knows who joined.",
    seuNome: "Your name",
    envieMesmoLink: "Send the same link to anyone.",
    copiarEsteLink: "Copy this link",
    digaSeuNome: "Say your name",
    convidarMaisGente: "Invite more people",
    pausadaDica: "The image stays where it was. As soon as you resume, it comes back on its own — no need to reload anything.",
    aguardandoDica: "The page connects on its own as soon as the stream starts. You can leave it open.",
    naoExisteTitulo: "This room does not exist (or has ended)",
    naoExisteTexto: "Check the link with whoever sent it. Rooms stop existing when the presenter leaves and nobody is watching anymore.",
    cheiaTitulo: "The room is full",
    cheiaTexto: "The limit is 32 people watching at the same time. Try again in a few minutes.",
    encerradaTitulo: "The stream ended",
    encerradaTexto: "The presenter stopped sharing. You can close this page.",
    erroTitulo: "Could not play the video",
    erroTexto: "The connection failed.",
    tentarDeNovo: "Try again",
    caiuTitulo: "The connection dropped, reconnecting",
    caiuTexto: "The image comes back on its own when the network recovers.",
    telaCheiaVer: "View full screen",
    telaCheiaSair: "Exit full screen",
  },
  erro: {
    generico: "Could not continue",
    tentarDeNovo: "Try again",
    paginaNaoEncontrada: "Page not found",
    voltarHome: "Back to home",
    naoEncontradoTitulo: "We could not find this page",
    naoEncontradoTexto:
      "If you got here from a stream link, check that it was copied in full. A DanielLive room code has 9 characters, like {codigo} — and never uses 0, O, 1 or L, precisely so that nobody mistypes it from memory.",
    conexaoComTurn: "Could not connect. Check your network and try again.",
    conexaoSemTurn:
      "Could not connect directly to the host. This usually happens on corporate networks or behind a strict firewall — a TURN server would solve it (see NEXT_PUBLIC_TURN_URL in the README).",
    salaCheia: "The room reached its viewer limit.",
    salaNaoCriada: "Could not create the room. Try again.",
    capturaCancelada: "You cancelled the screen selection. Nothing was streamed.",
    capturaNaoIniciada: "Could not start the capture.",
    naoRespondeuAoAnfitriao: "Could not answer the host.",
    servidorReiniciando: "The server is restarting. Reload the page in a moment.",
    muitasSalas: "You created too many streams in a short time. Wait a minute.",
    operacaoRecusada: "The server refused the operation. Try again.",
    paradaPeloNavegador: "Sharing was stopped by the browser.",
  },
  rodape: {
    criar: "Start streaming",
    comoFunciona: "How it works",
    sobreWebrtc: "About WebRTC",
    redes: "Social",
    licencaWeb:
      "Free software under the MIT licence. The image travels straight from one browser to another — the server only introduces the two ends and never sees the content.",
    licencaApp:
      "Free software under the MIT licence. The image travels straight from your computer to the viewers — the server only introduces the two ends and never sees the content.",
    navRotulo: "Footer",
    copyright: "© {ano} DanielLive · v1.0.0",
  },
};

const es: Dicionario = {
  comum: {
    voltarAoInicio: "Volver al inicio",
    pularParaConteudo: "Saltar al contenido",
    copiar: "Copiar",
    copiado: "¡Copiado!",
    naoCopiou: "No se pudo copiar",
    nadaParaColar: "El portapapeles está vacío.",
    copiarLink: "Copiar enlace",
    copiarCodigo: "Copiar código",
    fechar: "Cerrar",
    cancelar: "Cancelar",
    salvar: "Guardar",
    carregando: "Cargando",
    ajuda: "¿Necesitas ayuda?",
    inicio: "inicio",
    entrarComCodigo: "Entrar con un código",
    dispensarAviso: "Descartar aviso",
    semNome: "Sin nombre",
    aoVivo: "En vivo",
    conectado: "Conectado",
    conectar: "Conectando",
    reconectar: "Reconectando",
    offline: "Sin conexión",
    pausada: "Pausada",
    apresentando: "Presentando",
    foraDoAr: "Fuera del aire",
    preparando: "Preparando",
    assistindo: "Mirando",
    conexaoInstavel: "Conexión inestable",
    falhou: "Falló",
    saiu: "Salió",
    conexaoBoa: "Conexión buena",
    conexaoRuim: "Conexión mala",
    criarTransmissao: "Crear transmisión",
    assistir: "Ver",
  },
  nav: {
    transmitir: "Emitir",
    aoVivo: "En vivo",
    site: "Web",
    download: "Descargar",
    conta: "Cuenta",
    contaRotulo: "Ir a tu cuenta",
    siteRotulo: "Versión web",
    downloadRotulo: "Descargar la aplicación",
    tema: "Tema",
    temaClaro: "Tema claro",
    temaEscuro: "Tema oscuro",
    temaSistema: "Tema del sistema",
    temaMudar: "{tema} — haz clic para cambiar",
    idioma: "Idioma",
    idiomaMudar: "Idioma: {idioma} — haz clic para cambiar",
    navegacaoPrincipal: "Navegación principal",
    /* Rótulos curtos por causa dos 390px de largura da barra inferior. */
    inicio: "Inicio",
    ajudaCurto: "Ayuda",
  },
  home: {
    seloWeb: "Gratis, sin cuenta y sin instalar nada",
    seloApp: "Aplicación para Windows, sin cuenta y sin registro",
    titulo: "Muestra tu pantalla",
    tituloDestaque: "enviando un enlace.",
    subtituloWeb:
      "DanielLive abre una sala en el navegador y conecta a quien presenta con quien mira, directo de uno a otro. No hay programa que instalar ni cuenta que crear — solo el enlace.",
    subtituloApp:
      "DanielLive abre una sala en tu computadora y conecta a quien presenta con quien mira, directo de uno a otro. Tú eliges qué compartir y envías el enlace — la imagen no pasa por un servidor que la guarde.",
    recursoNavegadoresWeb: "Chrome, Edge, Firefox y Safari",
    recursoNavegadoresApp: "Funciona en cualquier Windows 10 u 11",
    recursoCelularWeb: "Mirar desde el celular funciona",
    recursoCelularApp: "Quien mira solo usa el navegador",
    recursoAudioWeb: "Puede incluir el audio de la pestaña",
    recursoAudioApp: "Puede incluir el audio del sistema",
    recursoGravacaoWeb: "Nada queda grabado en el servidor",
    recursoGravacaoApp: "Nada queda grabado en tu computadora",
    comecarAgora: "Empezar ahora",
    comecarDescricao: "Crea una sala y recibe un enlace para invitar a quien quieras.",
    criar: "Crear transmisión",
    entrarTitulo: "¿Ya tienes un enlace o código?",
    entrarDica: "Pega el enlace que recibiste o escribe el código de la sala.",
    entrarPlaceholder: "Pega el enlace o el código de la sala",
    assistir: "Ver",
    codigoInvalido: "Código inválido. Tiene 9 caracteres, como K7M2PQR4T.",
    semCapturaTitulo: "Este navegador no sabe capturar la pantalla",
    semCapturaTexto:
      "Compartir pantalla depende de una API que este navegador no ofrece. Chrome, Edge y Firefox en computadora funcionan; en el celular solo puedes mirar.",
    ou: "o",
    passosTitulo: "Cómo funciona",
    passosWeb: "No hay nada que configurar. El navegador se encarga de la conexión entre las dos partes.",
    passosApp: "No hay nada que configurar. La aplicación se encarga de la conexión entre las dos partes.",
    passo1Titulo: "Crea la transmisión",
    passo1Web: "Elige un nombre y la sala se crea con un código propio.",
    passo1App: "Elige un nombre y la sala se crea con un código propio.",
    passo2Titulo: "Copia el enlace",
    passo2Web: "Una dirección única para enviar por donde ya conversas.",
    passo2App: "Una dirección única para enviar por donde ya conversas.",
    passo3Titulo: "Comparte la pantalla",
    passo3Web: "Tú eliges la pantalla, la ventana o la pestaña. Nada se captura sin eso.",
    passo3App: "Tú eliges la pantalla o la ventana. Nada se captura sin tu confirmación.",
    verInstrucoes: "Ver las instrucciones completas y las dudas frecuentes",
    passo4Titulo: "La persona abre y ve",
    passo4Web: "Quien reciba el enlace mira al instante, sin instalar nada.",
    passo4App: "Quien reciba el enlace lo abre en el navegador y mira al instante.",
    privacidade: {
      titulo1: "La imagen no pasa por el servidor",
      texto1Web:
        "Viaja directo de un navegador al otro, cifrada por el propio WebRTC. El servidor solo presenta las dos partes una a la otra.",
      texto1App:
        "Viaja directo de tu computadora a quienes miran, cifrada por el propio WebRTC. El servidor solo presenta las dos partes una a la otra.",
      titulo2: "Tú decides qué mostrar",
      texto2Web:
        "El navegador siempre pregunta antes de capturar, y muestra una barra mientras dura. Cerrar esa barra termina la transmisión.",
      texto2App:
        "La aplicación siempre pregunta qué compartir antes de capturar, y deja la elección visible en su propia ventana. Nada se captura sin tu confirmación.",
      titulo3: "Nada se graba",
      texto3: "No hay grabación ni historial. Cuando todos salen de la sala, deja de existir en el servidor.",
    },
  },
  entrada: {
    titulo: "¿Ya tienes un enlace o código?",
    dica: "Pega el enlace que recibiste o escribe el código de la sala.",
    placeholder: "Pega el enlace o el código de la sala",
    codigoInvalido: "Código inválido. Tiene 9 caracteres, como K7M2PQR4T.",
    indoNaSala: "Abriendo la sala…",
    colar: "Pegar",
    colado: "¡Pegado!",
    verifiqueOTexto: "Revisa el texto e inténtalo de nuevo.",
    avisoInseguroTitulo: "Esta página no está en HTTPS",
    avisoInseguroTexto:
      "Los navegadores solo permiten compartir la pantalla en conexiones seguras. Aquí la captura va a fallar. Abre el sitio por {https} o por {localhost}.",
  },
  criarTransmissao: {
    descricaoApp: "Tú eliges qué compartir y recibes el enlace al instante.",
    descricaoWeb: "Sin cuenta y sin instalar nada. Tú eliges qué compartir.",
  },
  chat: {
    titulo: "Chat de la sala",
    dica: "Los mensajes desaparecen con la sala.",
    vazio: "Aún no hay mensajes. ¡Saluda!",
    placeholder: "Escribe tu mensaje…",
    aguardandoConexao: "Conectando a la sala…",
    enviar: "Enviar",
    voce: "tú",
  },
  conta: {
    tituloPagina: "Tu cuenta",
    subtitulo:
      "La cuenta guarda a tus amigos de aquí. Lo demás de DanielLive funciona igual, con o sin entrada.",
    criarTitulo: "Crear cuenta",
    criarDescricao: "Correo, un nombre y una contraseña. Nada más.",
    entrarTitulo: "Entrar",
    entrarDescricao: "La contraseña que creaste aquí — o Google.",
    nome: "Nombre",
    nomePlaceholder: "Cómo te ve la gente",
    email: "Correo",
    emailPlaceholder: "tu@ejemplo.com",
    senha: "Contraseña",
    senhaDica: "Al menos 8 caracteres. Más larga, mejor.",
    criar: "Crear cuenta",
    criando: "Creando la cuenta…",
    entrar: "Entrar",
    entrando: "Entrando…",
    criarGoogle: "Crear cuenta con Google",
    entrarGoogle: "Entrar con Google",
    ou: "o",
    sair: "Salir",
    saindo: "Saliendo…",
    membroDesde: "Miembro desde {data}",
    provedorGoogle: "Esta cuenta entra por Google, sin contraseña de aquí.",
    pedidosTitulo: "Solicitudes de amistad",
    aceitar: "Aceptar",
    recusar: "Rechazar",
    remover: "Quitar",
    amigosTitulo: "Amigos",
    amigosDescricao: "Agrega por el correo que usaron en la cuenta de aquí.",
    amigosVazio: "Aún no hay amigos. El primero entra por el correo de la persona.",
    adicionarTitulo: "Agregar amigo",
    adicionarDescricao: "La persona recibe la solicitud al abrir su cuenta.",
    adicionar: "Agregar",
    adicionando: "Enviando…",
    mensagens: {
      pedido_enviado: "Solicitud de amistad enviada.",
      amizade_direta: "Ya te había pedido, ahora son amigos.",
      amizade_aceita: "¡Amistad aceptada!",
      removido: "Quitado.",
    },
    erros: {
      email_invalido: "Correo inválido.",
      senha_curta: "La contraseña necesita al menos 8 caracteres.",
      nome_curto: "El nombre necesita al menos 2 letras.",
      email_em_uso: "Este correo ya tiene cuenta. Intenta entrar.",
      credenciais: "Correo o contraseña equivocados.",
      nao_encontrado: "Nadie tiene cuenta con ese correo.",
      pedido_existente: "La solicitud ya fue enviada. Ahora es esperar.",
      voce_mesmo: "Ya eres amigo de ti mismo, por definición.",
      nao_logado: "Entra de nuevo en tu cuenta.",
      desconhecido: "Algo salió mal. Inténtalo de nuevo.",
      googleFalhou: "No se pudo entrar con Google. Inténtalo de nuevo, o usa correo y contraseña.",
    },
  },
  video: {
    vazio: "Nada se está transmitiendo ahora",
    iniciar: "Haz clic para iniciar el vídeo",
    aoVivo: "En vivo",
  },
  campo: {
    nome: "Tu nombre",
    nomePlaceholder: "Cómo quieres aparecer",
  },
  redes: {
    titulo: "Sigue a {marca}",
    descricao: "Novedades, detrás de escena y lo que viene. Hecho por {autor}.",
    externo: "{rede} (abre en una pestaña nueva, sitio externo)",
    semConfirmadas: "Las direcciones todavía se están confirmando.",
    pendentesTitulo: "Por confirmar",
    pendentesItem: "{rede}{usuario}",
    usuarioComArroba: " · @{usuario}",
    pendentesInstrucao: "Rellena las direcciones en {arquivo} y marca {confirmado}.",
    rodapeTitulo: "Redes",
    rodapeConfirmada: "{rede} de {autor} (abre en una pestaña nueva)",
    rodapePendente: "{rede} (dirección por confirmar)",
  },
  comoFunciona: {
    titulo: "Cómo funciona",
    introWeb: "DanielLive conecta dos navegadores entre sí. Quien presenta captura su propia pantalla; quien mira recibe la imagen directo de quien presenta, sin pasar por un servidor en el medio.",
    introApp: "DanielLive conecta tu computadora con quienes miran. Tú capturas la pantalla desde la aplicación; la otra parte recibe la imagen directo de ti, sin pasar por un servidor en el medio.",
    transmitirTitulo: "Para quien va a transmitir",
    tresPassos: "Tres pasos.",
    passo1: "Escribe un nombre",
    passo1Texto: "Es lo que ven quienes miran. Puede ser tu nombre o el tema de la presentación.",
    passo2: "Haz clic en compartir",
    passo2Web: "El navegador abre su propia ventana de elección — pantalla completa, una ventana o una pestaña. Nada se captura antes de que confirmes ahí.",
    passo2App: "La aplicación abre su propia ventana de elección — pantalla completa o una ventana. Nada se captura antes de que confirmes ahí.",
    passo3: "Envía el enlace",
    passo3Texto: "Una dirección única por sala. Quien la abra entra y empieza a ver. Puedes copiar el enlace o solo el código.",
    controlarTitulo: "Qué puedes controlar",
    duranteTransmissao: "Durante la transmisión.",
    controlarPausar: "Pausar y reanudar",
    controlarPausarTexto: "Detiene de verdad el envío de cuadros, sin cortar la conexión ni pedir la pantalla otra vez. Quien mira ve la imagen congelarse.",
    controlarQualidade: "Calidad de vídeo",
    controlarQualidadeTexto: "Elegir 1080p, 720p o 480p cambia la nitidez y el ancho de banda que usa cada persona. En una red mala, bajar un escalón suele resolver el trabado.",
    controlarAudio: "Audio de la pestaña",
    controlarAudioTexto: "Al compartir una pestaña del navegador, su sonido puede ir junto. Para una pantalla completa, el navegador no captura el audio del sistema.",
    controlarEncerrar: "Terminar",
    controlarEncerrarTexto: "Cierra la captura y avisa a quienes miran. La sala también termina si cierras la pestaña.",
    navegadoresTitulo: "Navegadores",
    navegadoresDescricao: "Qué funciona en cada uno.",
    colNavegador: "Navegador",
    colTransmitir: "Transmitir",
    colAssistir: "Mirar",
    navChromeEdge: "Chrome y Edge (computadora)",
    navFirefox: "Firefox (computadora)",
    navSafari: "Safari (macOS)",
    navCelular: "Navegadores de celular",
    simComAudioAba: "Sí, con audio de la pestaña",
    simSemAudioAba: "Sí, sin audio de la pestaña",
    sim: "Sí",
    naoSoAssistir: "No — solo mirar",
    notaSegurancaWeb: "Compartir pantalla solo se permite en conexiones seguras. Por eso el sitio tiene que estar en {code} — o en {code2}, cuando lo estás ejecutando tú mismo.",
    notaSegurancaApp: "La tabla vale para quien {destaque}: quien recibe el enlace lo abre en el navegador que prefiera. Quien transmite es DanielLive mismo, en esta computadora.",
    tecnicoHttps: "https://",
    tecnicoLocalhost: "localhost",
    destaqueAssiste: "mira",
    naoConectaTitulo: "Cuando no conecta",
    naoConectaDescricao: "Las dos causas más comunes.",
    avisoRedeTitulo: "Red corporativa o Wi-Fi público",
    avisoRedeWeb: "Muchas redes bloquean la conexión directa entre dos computadoras. En esos casos hace falta un servidor intermediario (TURN) para retransmitir la imagen. DanielLive no trae uno incorporado — quien publica el sitio tiene que configurar el suyo en {code}.",
    avisoRedeApp: "Muchas redes bloquean la conexión directa entre dos computadoras. En esos casos hace falta un servidor intermediario (TURN) para retransmitir la imagen. Si tu red es así, avísale a quien mantiene la aplicación — la dirección del TURN se configura al compilar.",
    tecnicoIceServers: "NEXT_PUBLIC_ICE_SERVERS",
    avisoSalaTitulo: "Sala no encontrada",
    avisoSalaTexto: "Las salas dejan de existir cuando el presentador sale y ya nadie está mirando. Un código con un carácter cambiado también cae aquí — el alfabeto del código no usa 0, O, 1 ni L justamente para evitar esa confusión.",
    privacidadeTitulo: "Privacidad",
    privacidadeDescricao: "Lo que el servidor ve y lo que no ve.",
    privacidadeWeb: "El servidor de DanielLive solo presenta las dos partes una a la otra: intercambia los datos de conexión y mantiene la lista de quién está en la sala. La imagen y el sonido viajan cifrados de un navegador a otro y no pasan por él. No hay grabación, ni cuenta, ni historial.",
    privacidadeApp: "El servidor de DanielLive solo presenta las dos partes una a la otra: intercambia los datos de conexión y mantiene la lista de quién está en la sala. La imagen y el sonido viajan cifrados de tu computadora a quienes miran y no pasan por él. No hay grabación, ni cuenta, ni historial.",
    prontoTitulo: "¿Listo para empezar?",
    prontoTexto: "Crea una transmisión o entra en una que ya existe.",
  },
  site: {
    titulo: "DanielLive en el navegador",
    descricao: "Nada que instalar. Abre esta página, crea la sala y comparte el enlace.",
    tituloPagina: "Transmite tu pantalla desde el navegador",
    subtitulo:
      "Crea una sala, recibe un enlace y mándalo a quien quieras. Quien mira abre el enlace y listo — no instala nada ni crea cuenta. La imagen va directo de una computadora a otra.",
    comecarAgora: "Empezar ahora",
    entrarExistente: "O entra a una sala existente",
    ganhosTitulo: "Lo que ganas",
    ganhos: {
      item1: "Nada que instalar, en ninguno de los dos lados",
      item2: "Ninguna cuenta y ningún registro",
      item3: "Funciona en Chrome, Edge, Firefox y Safari",
      item4: "Quien mira puede usar el celular",
      item5: "La imagen no pasa por un servidor que la guarde",
    },
    limiteTitulo: "El límite del navegador",
    limiteTexto1:
      "Para protegerte, el navegador siempre pide confirmación y solo ofrece lo que él mismo permite capturar. En algunos casos eso significa elegir entre la pantalla completa, una ventana o una pestaña — y no un recorte libre.",
    limiteTexto2:
      "La aplicación para Windows no tiene esa limitación: captura con la tarjeta de vídeo y te deja elegir exactamente qué mostrar.",
    limiteLink: "Ver la aplicación para Windows",
    privacidadeTitulo: "Privacidad",
    privacidadeTexto:
      "El servidor de DanielLive solo presenta a las dos partes una a la otra. La imagen y el audio viajan directo entre quien transmite y quien mira, y nada queda grabado.",
    privacidadeLink: "Cómo funciona",
  },
  download: {
    titulo: "Descargar DanielLive",
    descricao: "Instálalo una vez y ábrelo desde el menú Inicio.",
    botao: "Descargar el instalador",
    emBreve: "Descarga próximamente",
    demaisOpcoes: "Otras opciones",
    semInstalar: "¿Prefieres no instalar?",
    semInstalarTexto:
      "La versión web hace lo mismo en el navegador, sin descargar nada. Es la opción correcta para una transmisión rápida o en una computadora que no es tuya.",
    usarNavegador: "Usar en el navegador",
    requisitos: "Requisitos",
    arquivos: {
      instaladorRotulo: "Instalador",
      instaladorDescricao: "Instala DanielLive en Windows. Recomendado para la mayoría.",
      portatilRotulo: "Versión portátil",
      portatilDescricao: "No instala nada: se abre directo del archivo. Buena para pendrive.",
      msiRotulo: "Paquete .msi",
      msiDescricao: "Para instalar en red o por política de empresa.",
    },
    requisitosLista: [
      "Windows 10 u 11, 64 bits",
      "4 GB de memoria",
      "Tarjeta gráfica con controlador actualizado (la captura de pantalla usa la GPU)",
    ],
    tituloPagina: "Descarga {marca} para Windows",
    subtitulo:
      "La aplicación transmite tu pantalla con la calidad de la tarjeta de vídeo y te deja elegir la pantalla o la ventana exacta que quieres mostrar. Quien mira solo necesita el navegador — nada que instalar del otro lado.",
    emBreveAviso:
      "Los instaladores están listos, pero todavía no se publicaron. Mientras tanto, usa la {link} — funciona sin instalar nada.",
    emBreveLink: "versión web",
    antesDeBaixar: "Antes de descargar",
    outrasTitulo: "Otras opciones",
    arquivoMeta: "{rotulo} · {tamanho}",
  },
  transmitir: {
    titulo: "Tu transmisión",
    foraDoAr: "Fuera del aire",
    conectado: "Conectado",
    palcoVazio: "Tu pantalla aparece aquí cuando empieces",
    comecar: "Compartir mi pantalla",
    transmitirDeNovo: "Emitir de nuevo",
    encerrar: "Terminar",
    pausar: "Pausar",
    retomar: "Reanudar",
    linkTitulo: "Enlace para invitar",
    linkDica: "Quien abra esta dirección entra a la sala y empieza a ver tu pantalla.",
    ouDiteCodigo: "O dicta solo el código:",
    nomeTitulo: "Tu nombre",
    nomeDica: "Es el nombre que ven quienes están mirando.",
    nomePlaceholder: "Cómo quieres aparecer",
    nomeObrigatorio: "Escribe un nombre para poder empezar.",
    espectadores: "Quién está mirando",
    ninguemAinda: "Todavía no entró nadie. Envía el enlace.",
    listaEnche: "La lista se llena a medida que la gente abre el enlace.",
    qualidade: "Calidad de vídeo",
    qualidadeCurta: {
      auto: "Automática",
      "1080p": "1080p",
      "720p": "720p",
      "480p": "480p",
    },
    qualidadeLonga: {
      auto: "Automática",
      "1080p": "1080p (máxima nitidez)",
      "720p": "720p (equilibrada)",
      "480p": "480p (ahorra ancho de banda)",
    },
    qualidadeEAudio: "Calidad y audio",
    enquantoTransmite: "Mientras emites",
    dicaApp1: "El botón {botao} detiene la captura y avisa a quienes miran. El icono de compartir de Windows hace lo mismo.",
    dicaApp2: "Cerrar la aplicación corta la transmisión para todos.",
    dicaWeb1: "La barra del navegador con el botón {botao} termina la transmisión. DanielLive lo nota y avisa.",
    dicaWeb2: "Cerrar esta pestaña corta la transmisión para todos.",
    dicaPausar: "Pausar detiene el envío de verdad, sin gastar ancho de banda.",
    botaoEncerrar: "Terminar",
    botaoPararDeCompartilhar: "Dejar de compartir",
    escolhasValemProxima: "Se aplican al instante y se recuerdan en la próxima transmisión.",
    incluirAudioAba: "Incluir el audio de la pestaña",
    audioSoEmAbaApache:
      "Solo funciona al compartir una pestaña del navegador. Para una pantalla completa, el audio del sistema no se captura.",
    avisoPrimeiraVez:
      "La primera vez, el navegador pregunta qué compartir. Puedes cambiarlo después sin recargar la página.",
    linkCopiar: "Copiar enlace",
    linkApareceQuando: "El enlace aparece aquí en cuanto se cree la sala.",
    criandoSala: "Creando tu sala…",
    espectadoresContagem: {
      zero: "nadie mirando",
      one: "1 mirando",
      other: "{n} mirando",
    },
    espectadoresDe: "{n} de {max} posibles.",
    audio: "Audio",
    resolucao: "Resolución",
    resolucaoDica:
      "Cuanto mayor sea, más nítido y más ancho de banda consume cada persona. En una red mala, bajar a 720p suele resolver el trabado.",
    maisDetalhes: "Más detalles…",
    telaCompartilhada: "Pantalla compartida",
    listaSePreenche: "La lista se llena a medida que las personas abren el enlace.",
    nadaCapturadoAntes: "Nada se captura antes de que confirmes la elección.",
    escolhaNoAplicativo: "Elige qué compartir en la ventana de la aplicación",
    escolhaNoNavegador: "Elige qué compartir en la ventana del navegador",
    semCapturaTexto:
      "Compartir pantalla depende de una API que este navegador no ofrece. Chrome, Edge y Firefox en computadora funcionan; en el celular, solo mirar.",
    semCapturaTitulo: "Este navegador no sabe capturar la pantalla",
    erroTitulo: "No se pudo continuar",
  },
  assistir: {
    titulo: "Mirando",
    entrando: "Entrando a la sala…",
    aguardando: "Esperando a quien transmite…",
    aoVivoAgora: "En vivo ahora",
    transmissaoDe: "Transmisión de {nome}",
    salaDeTransmissao: "Sala de transmisión",
    voltarAoInicio: "Volver al inicio",
    pausada: "Pausada",
    apresentando: "Presentando",
    apresentador: "Presentador",
    ninguemNaSala: "Todavía no hay nadie en la sala.",
    aguardandoApresentador: "Esperando al presentador",
    aindaNaoComecou: "{nome} todavía no empezó",
    conectado: "Conectado",
    transmissaoTerminou: "La transmisión terminó",
    salaNaoEncontrada: "Sala no encontrada",
    salaCheia: "Sala llena",
    naoFoiPossivelConectar: "No se pudo conectar",
    dicaRedeTitulo: "Si la imagen se traba",
    dicaRede1: "Cierra otras pestañas que estén usando la red.",
    dicaRede2: "Prefiere el cable al Wi-Fi cuando puedas.",
    dicaRede3: "Pídele a quien transmite que elija una calidad menor.",
    nestaSala: "En esta sala",
    soVoce: "Solo estás tú.",
    quemTransmiteMarcado: "Quien transmite aparece marcado.",
    quemApresenta: "Quien presenta",
    pausouTransmissao: "{nome} pausó la transmisión",
    paraSaberQuemEntrou: "Para que el presentador sepa quién entró.",
    seuNome: "Tu nombre",
    envieMesmoLink: "Envía el mismo enlace a quien quieras.",
    copiarEsteLink: "Copiar este enlace",
    digaSeuNome: "Di tu nombre",
    convidarMaisGente: "Invitar a más gente",
    pausadaDica: "La imagen queda donde estaba. Cuando se reanude, vuelve sola — no hace falta recargar nada.",
    aguardandoDica: "La página se conecta sola en cuanto empiece la transmisión. Puedes dejarla abierta.",
    naoExisteTitulo: "Esta sala no existe (o ya terminó)",
    naoExisteTexto: "Confirma el enlace con quien lo envió. Las salas dejan de existir cuando el presentador sale y ya nadie está mirando.",
    cheiaTitulo: "La sala está llena",
    cheiaTexto: "El límite es de 32 personas mirando al mismo tiempo. Inténtalo de nuevo en unos minutos.",
    encerradaTitulo: "La transmisión terminó",
    encerradaTexto: "Quien presentaba terminó el uso compartido. Puedes cerrar esta página.",
    erroTitulo: "No se pudo ver el vídeo",
    erroTexto: "La conexión falló.",
    tentarDeNovo: "Intentar de nuevo",
    caiuTitulo: "La conexión se cayó, reconectando",
    caiuTexto: "La imagen vuelve sola cuando se recupere la red.",
    telaCheiaVer: "Ver en pantalla completa",
    telaCheiaSair: "Salir de pantalla completa",
  },
  erro: {
    generico: "No se pudo continuar",
    tentarDeNovo: "Intentar de nuevo",
    paginaNaoEncontrada: "Página no encontrada",
    voltarHome: "Volver al inicio",
    naoEncontradoTitulo: "No encontramos esta página",
    naoEncontradoTexto:
      "Si llegaste por un enlace de transmisión, revisa que se haya copiado completo. El código de una sala de DanielLive tiene 9 caracteres, como {codigo} — y nunca usa 0, O, 1 ni L, justamente para no confundir a quien lo escribe de memoria.",
    conexaoComTurn: "No se pudo conectar. Revisa tu red e inténtalo de nuevo.",
    conexaoSemTurn:
      "No se pudo conectar directo con el anfitrión. Esto suele pasar en redes corporativas o con firewall estricto — un servidor TURN lo resolvería (mira NEXT_PUBLIC_TURN_URL en el README).",
    salaCheia: "La sala alcanzó el límite de espectadores.",
    salaNaoCriada: "No se pudo crear la sala. Inténtalo de nuevo.",
    capturaCancelada: "Cancelaste la selección de pantalla. No se transmitió nada.",
    capturaNaoIniciada: "No se pudo iniciar la captura.",
    naoRespondeuAoAnfitriao: "No se pudo responder al anfitrión.",
    servidorReiniciando: "El servidor se está reiniciando. Recarga la página en un momento.",
    muitasSalas: "Creaste demasiadas transmisiones en poco tiempo. Espera un minuto.",
    operacaoRecusada: "El servidor rechazó la operación. Inténtalo de nuevo.",
    paradaPeloNavegador: "El navegador terminó el uso compartido.",
  },
  rodape: {
    criar: "Crear transmisión",
    comoFunciona: "Cómo funciona",
    sobreWebrtc: "Sobre WebRTC",
    redes: "Redes",
    licencaWeb:
      "Software libre bajo licencia MIT. La imagen viaja directo de un navegador a otro — el servidor solo presenta a las partes y nunca ve el contenido.",
    licencaApp:
      "Software libre bajo licencia MIT. La imagen viaja directo de tu computadora a quienes miran — el servidor solo presenta a las partes y nunca ve el contenido.",
    navRotulo: "Pie de página",
    copyright: "© {ano} DanielLive · v1.0.0",
  },
};

const DICIONARIOS: Record<Idioma, Dicionario> = {
  "pt-BR": ptBR,
  en,
  es,
};

/** O dicionário de um idioma. */
export function dicionario(idioma: Idioma): Dicionario {
  return DICIONARIOS[idioma] ?? DICIONARIOS[IDIOMA_PADRAO];
}

// --------------------------------------------------------------- preferência

function assinar(aoMudar: () => void) {
  window.addEventListener("storage", aoMudar);
  window.addEventListener("daniellive:idioma", aoMudar);
  return () => {
    window.removeEventListener("storage", aoMudar);
    window.removeEventListener("daniellive:idioma", aoMudar);
  };
}

function ler(): Idioma {
  const salvo = window.localStorage.getItem(CHAVE);
  return (IDIOMAS as readonly string[]).includes(salvo ?? "") ? (salvo as Idioma) : detectarDoNavegador();
}

/**
 * O idioma do navegador, quando ninguém escolheu ainda.
 *
 * Só o prefixo é comparado: `pt`, `pt-BR` e `pt-PT` caem todos em português, e
 * `en-GB` cai em inglês. Um idioma não listado cai no padrão — que é português,
 * não inglês, porque é o idioma de quem escreveu o produto.
 */
function detectarDoNavegador(): Idioma {
  if (typeof navigator === "undefined") return IDIOMA_PADRAO;
  for (const bruto of navigator.languages ?? [navigator.language]) {
    const prefixo = bruto.toLowerCase().split("-")[0];
    const achado = IDIOMAS.find((i) => i.toLowerCase().split("-")[0] === prefixo);
    if (achado) return achado;
  }
  return IDIOMA_PADRAO;
}

/** Grava a escolha e avisa quem estiver ouvindo. */
export function definirIdioma(idioma: Idioma) {
  window.localStorage.setItem(CHAVE, idioma);
  window.dispatchEvent(new Event("daniellive:idioma"));
}

/**
 * O idioma em uso, como fonte externa do React.
 *
 * `IDIOMA_PADRAO` é o retrato do servidor: ele não tem `localStorage` nem
 * `navigator`, e inventar um idioma lá faria o HTML divergir do cliente. O
 * valor real chega na primeira renderização do cliente, sem `setState` em
 * efeito e sem renderização em cascata.
 */
export function useIdioma(): Idioma {
  return useSyncExternalStore(assinar, ler, () => IDIOMA_PADRAO);
}

/**
 * O dicionário do idioma em uso.
 *
 * Acompanha um `useSyncExternalStore`, então a troca de idioma re-renderiza
 * tudo que usa o dicionário — sem contexto, sem provider, sem estado global.
 */
export function useTexto(): Dicionario {
  return dicionario(useIdioma());
}

/**
 * Substitui `{marcadores}` no texto.
 *
 * Interpolação por marcador nomeado, e não por concatenação no ponto de uso:
 * a ordem das partes muda entre idiomas, e `"Idioma: " + nome` obrigaria a
 * montar a frase em cada lugar que a mostra.
 */
export function preencher(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (todo, chave: string) =>
    Object.prototype.hasOwnProperty.call(valores, chave) ? valores[chave] : todo,
  );
}
