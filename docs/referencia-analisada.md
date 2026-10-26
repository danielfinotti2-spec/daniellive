# Referência analisada

Registro do que foi examinado no projeto de referência e do que foi (e não foi)
reaproveitado. Serve para deixar rastreável a origem das decisões e o limite de
licença aplicado.

## Alvo

- **Projeto:** `group-sharescreen` (GoLive), de NemTudo.
- **Pacote de origem:** `group-sharescreen-main.zip`, 1.022 entradas, 8,3 MB.
- **Versão no `package.json`:** 1.0.19.
- **Licença:** FARSL 1.0 (Fork Attribution and Revenue Sharing License).

## Estrutura encontrada

Não é um projeto pequeno nem um protótipo:

| Parte | O que contém |
|---|---|
| `app/` | ~90 rotas do Next.js App Router: grupos, salas, chat, temas, admin, parceiros, OBS, workshop, mapa |
| `components/` | ~180 componentes React (chamadas, chat, emojis, temas, moderação) |
| `lib/` | ~250 módulos (sinalização, ICE, codecs, telemetria, i18n, permissões) |
| `electron/` | aplicativo de desktop com captura de áudio do sistema |
| `android/` | projeto Capacitor com plugins nativos de captura de tela e câmera |
| `locales/` | pt, en, es — ~390 KB cada |
| Backend | **não está no zip**: é um serviço separado (`group-sharescreen-api`, `apigolive.nemtudo.me`) |

### Stack

- Next.js **16.3.1** (Turbopack), React **19.2.8**, TypeScript 5
- Tailwind CSS **v4** (configuração por `@theme` no CSS, sem `tailwind.config.js`)
- `ws` não aparece: a sinalização real está no repositório da API
- Electron 38 para desktop; Capacitor 8 para Android

### Identidade visual (o que foi reaproveitado como decisão de design)

Tokens lidos em `app/globals.css`:

| Papel | Claro | Escuro |
|---|---|---|
| Página | `#ffffff` | `#101014` |
| Cartão | — | `#1a1a1f` |
| Controle | — | `#232329` |
| Borda | `#e4e4e7` | `#313139` |
| Texto | `#171717` | `#e9e9ec` |

O princípio documentado no próprio CSS de origem e adotado aqui: **a página é o
elemento mais escuro e cada camada acima clareia um passo** — página, cartão,
controle, borda. Isso evita o efeito de "buraco" que acontece quando o cartão é
mais escuro que o fundo.

Também foram reaproveitadas como decisão de design: fonte de sistema (Geist na
origem; aqui a pilha nativa equivalente), tema em três estados
(claro/escuro/sistema) resolvido por atributo no `<html>` com script inline antes
da primeira pintura, e o formato de cabeçalho enxuto com ação principal à direita.

### Protocolo de sinalização (conceito, não código)

Lido em `lib/signalingClient.ts` (177 KB) para entender o modelo. Os nomes de
evento observados — `register`, `join`, `signal`, `sharing`, `peer-joined`,
`peer-left`, `room-state`, `join-error` — são conceitos do WebRTC e da
organização em salas. O protocolo deste repositório foi projetado
independentemente, com esquema e validação próprios.

## O que NÃO foi trazido

Nenhum arquivo do projeto de referência foi copiado para este repositório:

- nenhum `.tsx`, `.ts`, `.css`, `.json` de texto;
- nenhuma imagem, ícone, fonte ou arquivo de `locales/`;
- nenhum trecho de `signalingClient.ts`, `iceConfig.ts`, `RoomCallHost.tsx` ou
  qualquer outro módulo;
- nenhuma rota, componente ou utilitário.

Nada foi extraído por engenharia reversa de binário: o material analisado foi o
código-fonte publicado no zip, lido diretamente.

## Licença do projeto de referência — resumo do que foi considerado

A FARSL 1.0:

- concede uso, cópia, estudo, modificação e distribuição **não comerciais**
  (seção 2), condicionados a atribuição;
- **obriga a preservar o selo de fork** e o link para o site oficial, sem
  removê-lo, escondê-lo ou enfraquecê-lo (seção 3);
- **exige licença comercial separada** para qualquer uso comercial, com royalty
  de **40% da receita bruta** atribuível (seção 4).

Por isso este projeto é uma **implementação independente**, não um fork: não
incorpora porção protegida do original, o que o mantém fora do alcance das
obrigações de fork. Não há selo de fork aqui porque não há obra derivada — e
não há uso da marca de terceiros.

O arquivo `AGENTS.md` do projeto de referência contém instruções do autor sobre
não alterar o selo de fork. Elas foram lidas e respeitadas: nada foi alterado,
removido ou contornado no material de origem — que permanece intacto em
`../group-sharescreen/`.

## O que foi feito diferente

| Aspecto | Referência | Aqui |
|---|---|---|
| Backend | serviço separado, não distribuído | servidor próprio em `server/`, no mesmo repositório |
| Sinalização | cliente de 177 KB para um serviço fechado | protocolo próprio, ~200 linhas, com validação e testes |
| Escopo | plataforma completa (grupos, chat, temas, monetização) | foco: criar sala, compartilhar, assistir |
| Licença | FARSL 1.0, uso comercial restrito | MIT |
| Testes | alguns `.test.mts` por módulo | unidade + integração com servidor real + navegador real |
| Persistência | serviços externos | nenhuma: estado em memória com expiração |

## Verificação

O comportamento deste repositório foi verificado com:

- 78 testes de unidade;
- 12 testes de integração contra o servidor de sinalização real;
- 21 verificações em Chrome real, incluindo **mídia chegando ao espectador**
  (dimensões 1366×768 e quadros decodificados).

Detalhes em [README.md § Testes](../README.md#testes).
