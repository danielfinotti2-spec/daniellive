/**
 * Confere que o pacote consegue realmente SERVIR a interface.
 *
 * Existe por causa de um defeito que passou por todos os outros testes: o
 * `asarUnpack` embarcava o servidor e as dependências do Next, mas **não** o
 * `.next`. O aplicativo instalado abria, subia os dois processos filhos e ficava
 * com a janela vazia — porque o `next start` roda como processo Node separado, e
 * um processo Node não enxerga dentro de um asar. O erro só aparecia no log do
 * filho:
 *
 *   Could not find a production build in the '.next' directory.
 *
 * O teste de pacote que já existia conferia o **conteúdo** do asar, e o `.next`
 * estava lá — dentro do asar, onde o Next não consegue ler. Conferir presença não
 * bastava; era preciso executar o caminho de verdade.
 *
 * Aqui o Next é iniciado a partir do pacote, com os mesmos caminhos e o mesmo
 * comando que o `main.cjs` usa, e a interface é pedida por HTTP. Não abre janela,
 * então roda em qualquer ambiente — inclusive num sem sessão gráfica.
 *
 * Uso: node tests/pacote-servir.mjs [caminho-do-win-unpacked]
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const PACOTE = path.resolve(
  process.argv[2] ?? path.resolve(import.meta.dirname, "..", "dist-desktop", "win-unpacked"),
);
const UNPACKED = path.join(PACOTE, "resources", "app.asar.unpacked");
const PORTA = Number(process.env.PORTA_TESTE ?? 3497);

let passou = 0;
const falhas = [];
function conferir(nome, ok, detalhe = "") {
  if (ok) {
    passou++;
    console.log(`  ok    ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  } else {
    falhas.push(nome);
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

if (!existsSync(PACOTE)) {
  console.log(`Pacote não encontrado em ${PACOTE}.`);
  console.log("Gere com: npx electron-builder --win --dir");
  process.exit(2);
}

console.log("=== o pacote tem o que os processos filhos precisam ===");

// O diretório de trabalho dos filhos precisa ser uma pasta real: `app.asar` é um
// arquivo, e o Windows recusa usá-lo como `cwd` — foi o que produzia
// "spawn DanielLive.exe ENOENT" na versão compilada.
conferir("app.asar.unpacked existe", existsSync(UNPACKED));
conferir("o cwd dos filhos não está dentro do asar", !`${path.sep}app.asar${path.sep}`.includes(UNPACKED));

/*
 * O ponto do teste: `.next` precisa estar FORA do asar.
 *
 * Estar dentro não serve, mesmo estando presente — é exatamente a confusão que
 * deixou o defeito passar.
 */
const nextFora = path.join(UNPACKED, ".next", "server");
conferir(
  ".next está FORA do asar (legível por um processo Node)",
  existsSync(nextFora),
  existsSync(nextFora) ? nextFora : "ausente — o Next vai encerrar com 'Could not find a production build'",
);
if (existsSync(path.join(UNPACKED, ".next", "BUILD_ID"))) {
  conferir("BUILD_ID presente", true, readFileSync(path.join(UNPACKED, ".next", "BUILD_ID"), "utf8").trim());
}

const nextBin = path.join(UNPACKED, "node_modules", "next", "dist", "bin", "next");
conferir("entrypoint do Next fora do asar", existsSync(nextBin));
conferir("servidor de sinalização fora do asar", existsSync(path.join(UNPACKED, "server", "index.mjs")));

// ---------------------------------------------------------------- execução real
console.log("\n=== o Next do pacote sobe e serve a interface ===");

let filho = null;
let saida = "";

function pedir(caminho) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: PORTA, path: caminho, timeout: 4000 }, (res) => {
      let corpo = "";
      res.on("data", (c) => (corpo += c));
      res.on("end", () => resolve({ status: res.statusCode, corpo }));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

try {
  filho = spawn(process.execPath, [nextBin, "start", "-p", String(PORTA), "-H", "127.0.0.1"], {
    cwd: UNPACKED,
    env: { ...process.env, NODE_ENV: "production", ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  filho.stdout.on("data", (d) => (saida += String(d)));
  filho.stderr.on("data", (d) => (saida += String(d)));

  let home = null;
  for (let i = 0; i < 100 && !home; i++) {
    await new Promise((s) => setTimeout(s, 400));
    home = await pedir("/");
  }

  if (!home) {
    console.log("\n--- saída do Next ---");
    console.log(saida.slice(0, 2000));
  }
  conferir("a interface responde", Boolean(home), home ? `HTTP ${home.status}` : "sem resposta");

  if (home) {
    conferir("a home responde 200", home.status === 200, String(home.status));
    conferir("o HTML é o do DanielLive", /DanielLive/.test(home.corpo));

    // As rotas que o pacote tem de servir.
    for (const rota of ["/site", "/download", "/como-funciona"]) {
      const r = await pedir(rota);
      conferir(`a rota ${rota} é servida`, r?.status === 200, r ? String(r.status) : "sem resposta");
    }

    // Estáticos: prova que `.next/static` também está acessível.
    const m = /\/_next\/static\/[^"']+\.(css|js)/.exec(home.corpo);
    if (m) {
      const estatico = await pedir(m[0]);
      conferir("os estáticos do Next são servidos", estatico?.status === 200, m[0]);
    } else {
      conferir("os estáticos do Next são servidos", false, "nenhuma referência no HTML");
    }

    // A imagem do mascote precisa chegar à janela.
    const pato = await pedir("/branding/pato.png");
    conferir("a arte do mascote é servida", pato?.status === 200, pato ? String(pato.status) : "sem resposta");
  }
} catch (erro) {
  falhas.push(`exceção: ${erro.message}`);
  console.error("Exceção:", erro);
} finally {
  try {
    filho?.kill();
    setTimeout(() => {
      try {
        filho?.kill("SIGKILL");
      } catch {
        /* já morreu */
      }
    }, 500);
  } catch {
    /* já morreu */
  }
}

console.log(`\n=== ${passou} passaram, ${falhas.length} falharam ===`);
for (const f of falhas) console.log(`  - ${f}`);
process.exit(falhas.length ? 1 : 0);
