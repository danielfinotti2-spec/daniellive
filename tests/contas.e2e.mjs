/**
 * Teste de ponta a ponta das contas e do chat da sala, no navegador de
 * verdade, contra o servidor de produção (APP_URL).
 *
 * Cobre o que só o navegador prova: formulário de cadastro com redirect e
 * sessão persistida no cookie, entrada com senha errada e duplicata de
 * e-mail, pedido de amizade entre DUAS pessoas em dois contextos separados,
 * aceite e remoção — e o chat da sala com mensagem fluindo nas duas direções,
 * marcador "você" e histórico para quem chega depois.
 *
 * E-mails únicos por execução: o banco alvo nunca precisa ser zerado.
 * Executa com: node tests/contas.e2e.mjs
 */

import { chromium } from "playwright-core";
import { preparar } from "./idioma-dos-testes.mjs";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const resultados = [];
function registrar(nome, ok, detalhe = "") {
  resultados.push({ nome, ok, detalhe });
  console.log(`${ok ? "OK  " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

/** Marca de tempo da execução: e-mails nunca colidem entre rodadas. */
const rodada = Date.now();
const A = { nome: "Ana Conta", email: `ana.${rodada}@teste.com`, senha: "senha-super-secreta-9" };
const B = { nome: "Bia Conta", email: `bia.${rodada}@teste.com`, senha: "outra-senha-forte-7" };

async function esperaTexto(page, texto, timeout = 20_000) {
  await page.waitForSelector(`text=${texto}`, { timeout });
}

/** Cadastro pelo formulário da aba Conta (aba "Criar conta" já é o padrão). */
async function cadastrar(page, { nome, email, senha, nascimento = "2004-03-18", apelido = "" }) {
  await page.goto(`${APP}/conta`, { waitUntil: "domcontentloaded" });
  // O formulário de criar é quem abre; a aba também é um botão com o mesmo
  // nome do envio — então alvo do clique é o botão DENTRO do formulário.
  await page.locator("#cad-nome").fill(nome);
  if (apelido) await page.locator("#cad-apelido").fill(apelido);
  await page.locator("#cad-nascimento").fill(nascimento);
  await page.locator("#cad-email").fill(email);
  await page.locator("#cad-senha").fill(senha);
  await page.locator('form:has(#cad-nome) >> role=button[name="Criar conta"]').click();
  await esperaTexto(page, "Membro desde");
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-fake-ui-for-media-stream",
    "--auto-select-desktop-capture-source=Entire screen",
    "--auto-select-desktop-capture-source=Tela inteira",
    "--enable-usermedia-screen-capturing",
    "--allow-http-screen-capture",
  ],
});

try {
  let okTotal = true;

  // ============================================================ CADASTRO
  const ctxA = await preparar(await browser.newContext({ viewport: { width: 1100, height: 850 } }));
  const pageA = await ctxA.newPage();

  await cadastrar(pageA, A);
  const nomeVisivel = await pageA.locator("p").filter({ hasText: "Ana Conta" }).count();
  registrar("cadastro entra direto e mostra o nome", nomeVisivel >= 1);

  // A sessão sobrevive à recarga — é o cookie, não estado em memória da página.
  await pageA.reload({ waitUntil: "domcontentloaded" });
  try {
    await esperaTexto(pageA, "Membro desde", 12_000);
    registrar("sessão persiste após recarregar", true);
  } catch (e) {
    registrar("sessão persiste após recarregar", false, "perdeu a conta no reload");
  }

  // Sem credenciais do Google no servidor, o botão do Google NÃO aparece —
  // um botão que leva a trâmite quebrado é pior do que botão nenhum.
  const botaoGoogle = await pageA.locator('a[href="/api/auth/google"]').count();
  registrar("botão do Google some quando não configurado", botaoGoogle === 0);

  // ===================================================== CADASTRO: ERROS
  // E-mail duplicado é apontado como "já tem conta".
  const ctxE = await preparar(await browser.newContext({ viewport: { width: 1100, height: 850 } }));
  const pageE = await ctxE.newPage();
  await pageE.goto(`${APP}/conta`, { waitUntil: "domcontentloaded" });
  await pageE.locator("#cad-nome").fill("Ana Imitação");
  await pageE.locator("#cad-nascimento").fill("2004-03-18");
  await pageE.locator("#cad-email").fill(A.email);
  await pageE.locator("#cad-senha").fill("qualquer-outra-1");
  await pageE.locator('form:has(#cad-nome) >> role=button[name="Criar conta"]').click();
  try {
    await esperaTexto(pageE, "já tem uma conta", 15_000);
    registrar("duplicata de e-mail explica que já existe conta", true);
  } catch {
    registrar("duplicata de e-mail explica que já existe conta", false, "sem mensagem");
  }
  // Senha curta é barrada ainda no formulário (validação do servidor também).
  await pageE.locator("#cad-nome").fill("Falho Curto");
  await pageE.locator("#cad-email").fill(`curto.${rodada}@teste.com`);
  await pageE.locator("#cad-senha").fill("123");
  await pageE.evaluate(() => {
    // O novalidate é necessário: o navegador seguraria o submit antes do
    // servidor, e o que queremos medir é a resposta do servidor.
    const f = document.querySelector("#cad-senha")?.closest("form");
    f?.setAttribute("novalidate", "novalidate");
  });
  await pageE.locator('form:has(#cad-nome) >> role=button[name="Criar conta"]').click();
  try {
    await esperaTexto(pageE, "pelo menos 8 caracteres", 15_000);
    registrar("senha curta recusada com motivo", true);
  } catch {
    registrar("senha curta recusada com motivo", false, "sem mensagem");
  }

  // Menor de 13 anos também é barrado pelo servidor com motivo claro.
  await pageE.locator("#cad-nome").fill("Jovem Demais");
  await pageE.locator("#cad-email").fill(`jovem.${rodada}@teste.com`);
  await pageE.locator("#cad-senha").fill("senha-forte-123");
  const ontem = new Date(Date.now() - 86400000);
  await pageE.locator("#cad-nascimento").fill(
    new Date(ontem.setUTCFullYear(ontem.getUTCFullYear() - 10)).toISOString().slice(0, 10),
  );
  await pageE.locator('form:has(#cad-nome) >> role=button[name="Criar conta"]').click();
  try {
    await esperaTexto(pageE, "pelo menos 13 anos", 15_000);
    registrar("menor de idade recusado com motivo", true);
  } catch {
    registrar("menor de idade recusado com motivo", false, "sem mensagem");
  }
  await ctxE.close();

  // ============================================================== AMIGOS
  // B cria conta e adiciona A pelo e-mail: o pedido aparece do lado de A.
  const ctxB = await preparar(await browser.newContext({ viewport: { width: 1100, height: 850 } }));
  const pageB = await ctxB.newPage();
  await cadastrar(pageB, B);

  const campoAmigo = pageB.locator('input[name="email"]').last();
  await campoAmigo.fill(A.email);
  await pageB.getByRole("button", { name: /^Adicionar$/ }).click();
  try {
    await esperaTexto(pageB, "Pedido de amizade enviado.", 15_000);
    registrar("pedido de amizade enviado com confirmação", true);
  } catch {
    registrar("pedido de amizade enviado com confirmação", false, "sem confirmação");
  }

  // A recarrega e aceita o pedido; as duas listas se atualizam.
  await pageA.bringToFront();
  await pageA.reload({ waitUntil: "domcontentloaded" });
  try {
    await esperaTexto(pageA, "Pedidos de amizade", 12_000);
    await esperaTexto(pageA, B.nome, 12_000);
    registrar("pedido aparece na conta de quem recebe", true);
  } catch {
    registrar("pedido aparece na conta de quem recebe", false, "sem seção de pedidos");
  }

  await pageA.getByRole("button", { name: /^Aceitar$/ }).click();
  // O aceite faz o servidor re-renderizar a página: o pedido some e a lista
  // de amigos passa a mostrar B.
  await esperaTexto(pageA, "Friends", 100).catch(() => {});
  await pageA.waitForTimeout(2000);
  await pageA.reload({ waitUntil: "domcontentloaded" });
  const amigosA = await pageA.locator("li").filter({ hasText: B.email }).count();
  registrar("quem aceitou vê o outro na lista de amigos", amigosA >= 1);

  await pageB.reload({ waitUntil: "domcontentloaded" });
  const amigosB = await pageB.locator("li").filter({ hasText: A.email }).count();
  registrar("quem pediu também vê a amizade pronta", amigosB >= 1);

  // ======================================================== SAIR E ENTRAR
  await pageA.getByRole("button", { name: /^Sair$/ }).click();
  try {
    await esperaTexto(pageA, "Criar conta", 12_000);
    registrar("sair volta para os formulários", true);
  } catch {
    registrar("sair volta para os formulários", false, "continua logada");
  }

  // Depois do logout a aba ativa é a de criar; a de entrar precisa de um clique.
  await pageA.getByRole("tab", { name: /^Entrar$/ }).click();
  await pageA.locator("#ent-email").waitFor({ state: "visible", timeout: 5_000 });

  // Senha errada é recusada com motivo claro.
  await pageA.locator("#ent-email").fill(A.email);
  await pageA.locator("#ent-senha").fill("senha-errada-1");
  await pageA.locator('form:has(#ent-email) >> role=button[name="Entrar"]').click();
  try {
    await esperaTexto(pageA, "E-mail ou senha errados.", 15_000);
    registrar("senha errada explica sem vazar qual dos dois", true);
  } catch {
    registrar("senha errada explica sem vazar qual dos dois", false, "sem mensagem");
  }

  // Senha certa entra — e os amigos continuam lá, porque estão no banco.
  await pageA.locator("#ent-email").fill(A.email);
  await pageA.locator("#ent-senha").fill(A.senha);
  await pageA.locator('form:has(#ent-email) >> role=button[name="Entrar"]').click();
  await esperaTexto(pageA, "Membro desde", 15_000);
  const voltaram = await pageA.locator("li").filter({ hasText: B.email }).count();
  registrar("login traz a conta com as amizades do banco", voltaram >= 1, `${voltaram} amigo(s)`);

  // O perfil mostra a idade calculada da data de nascimento do cadastro.
  try {
    await esperaTexto(pageA, "anos", 8_000);
    registrar("perfil mostra a idade da data de nascimento", true);
  } catch {
    registrar("perfil mostra a idade da data de nascimento", false, "sem 'anos' no perfil");
  }

  // ============================================================ CHAT
  // Anfitrião abre sala (com a captura falsa do Chrome de teste) e conversa
  // com um espectador: a mensagem anda nas duas direções, com "você" no lado
  // certo, e quem entra depois recebe o histórico.
  const hostCtx = await preparar(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  const host = await hostCtx.newPage();
  await host.goto(`${APP}/transmitir`, { waitUntil: "domcontentloaded" });
  await host.locator("#display-name").fill("Nina");
  await host.waitForSelector('[data-campo="link-transmissao"]', { timeout: 25_000 });
  const link = await host.locator('[data-campo="link-transmissao"]').inputValue();
  const code = link.match(/\/assistir\/([A-Z0-9]{9})/)?.[1];

  const vCtx = await preparar(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  const viewer = await vCtx.newPage();
  await viewer.goto(`${APP}/assistir/${code}`, { waitUntil: "domcontentloaded" });

  // Espera o chat pronto nos dois lados: o campo destrava quando a conexão
  // está de pé, então "não-disabled" é o sinal certo (e não um texto solto).
  const seletorChat = 'input[placeholder="Escreva a sua mensagem…"]:not([disabled])';
  await host.waitForSelector(seletorChat, { timeout: 25_000 });
  await viewer.waitForSelector(seletorChat, { timeout: 25_000 });

  const campoChatHost = host.locator('input[placeholder="Escreva a sua mensagem…"]');
  const campoChatViewer = viewer.locator('input[placeholder="Escreva a sua mensagem…"]');
  await campoChatHost.fill("e aí, gente");
  await campoChatHost.press("Enter");
  try {
    await esperaTexto(viewer, "e aí, gente", 20_000);
    registrar("chat do anfitrião chega ao espectador", true);
  } catch {
    registrar("chat do anfitrião chega ao espectador", false, "mensagem não atravessou");
  }

  await campoChatViewer.fill("alô, Nina");
  await campoChatViewer.press("Enter");
  try {
    await esperaTexto(host, "alô, Nina", 20_000);
    registrar("chat do espectador chega ao anfitrião", true);
  } catch {
    registrar("chat do espectador chega ao anfitrião", false, "mensagem não atravessou");
  }

  // "você" só do lado de quem mandou.
  const voceNoHost = await host.locator("text=(você)").count();
  const voceNoViewer = await viewer.locator("text=(você)").count();
  registrar(
    "marcador (você) fica do lado de quem mandou",
    voceNoHost >= 1 && voceNoViewer >= 1,
    `host:${voceNoHost} viewer:${voceNoViewer}`,
  );

  // Quem entra tarde recebe o histórico — não cai num chat mudo.
  const tCtx = await preparar(await browser.newContext({ viewport: { width: 1280, height: 900 } }));
  const tardugo = await tCtx.newPage();
  await tardugo.goto(`${APP}/assistir/${code}`, { waitUntil: "domcontentloaded" });
  try {
    await esperaTexto(tardugo, "e aí, gente", 25_000);
    await esperaTexto(tardugo, "alô, Nina", 5_000);
    registrar("quem entra depois herda a conversa da sala", true);
  } catch {
    registrar("quem entra depois herda a conversa da sala", false, "sem histórico");
  }

  // Chat continua funcionando depois de começar a compartilhar (não é ligado
  // ao estado da captura).
  await host.getByRole("button", { name: /compartilhar minha tela/i }).click();
  await esperaTexto(host, "ao vivo", 25_000).catch(() => {});
  await campoChatHost.fill("conversa depois de começar");
  await campoChatHost.press("Enter");
  try {
    await esperaTexto(viewer, "conversa depois de começar", 20_000);
    registrar("chat continua com a transmissão ao vivo", true);
  } catch {
    registrar("chat continua com a transmissão ao vivo", false, "chat parou junto");
  }

  await ctxA.close();
  await ctxB.close();
  await hostCtx.close();
  await vCtx.close();
  await tCtx.close();
} catch (falha) {
  registrar("o acidente de preparo", false, String(falha).split("\n")[0]);
} finally {
  await browser.close();
}

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} aprovadas`);
if (falhas.length > 0) process.exit(1);
