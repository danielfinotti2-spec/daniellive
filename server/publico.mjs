/**
 * DanielLive — servidor PÚBLICO: Next e sinalização na MESMA porta.
 *
 * Por que ele existe: hospedagens tipo Render/Railway expõem **uma** porta
 * HTTP. O desenho clássico do projeto (site na 3000 + WebSocket na 8787)
 * só funciona com duas portas públicas. Aqui o WebSocket sobe pendurado no
 * mesmo servidor HTTP do Next, atendendo upgrades no caminho `/ws` —
 * o cliente mira automaticamente `wss://seu-dominio/ws` (ver
 * `lib/signaling.ts`), então nenhuma variável de build precisa mudar.
 *
 * Local e desktop continuam como sempre: `npm start` segue subindo os dois
 * processos em portas separadas; este arquivo só entra em cena no servidor
 * de verdade.
 *
 * Execução: `node server/publico.mjs` (a porta vem de `PORT`, que o Render
 * injeta; cai em 3000 fora dele).
 */

import { createServer } from "node:http";
import next from "next";
import { criarSinal } from "./index.mjs";

const PORTA = Number(process.env.PORT ?? 3000);
const HOSPEDEIRO = process.env.HOST ?? "0.0.0.0";

// O Next servido embutido: dev:false lê o .next já compilado (o buildCommand
// da hospedagem roda `npm run build` antes de subir este arquivo).
const app = next({ dev: false, dir: process.cwd() });
const handle = app.getRequestHandler();

await app.prepare().catch((erro) => {
  console.error("[daniellive] falha ao preparar o Next:", erro);
  process.exit(1);
});

const servidor = createServer((req, res) => {
  // Saúde/metrics vivem AQUI também: o Render conferir "a porta responde"
  // não deve passar pela pipeline inteira do Next.
  if (req.url === "/health" || req.url === "/healthz") {
    const body = JSON.stringify({
      ok: true,
      rooms: registry.size,
      uptime: Math.round(process.uptime()),
    });
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(body);
    return;
  }
  if (req.url === "/metrics") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(`daniellive_rooms ${registry.size}\n`);
    return;
  }
  handle(req, res).catch((erro) => {
    console.error("[daniellive] erro no pedido HTTP:", erro);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("erro interno");
    }
  });
});

// Modo embutido: o upgrade de `/ws` vira WebSocket; tudo mais vai para o
// Next acima. O `criarSinal` é a mesma fábrica que o modo clássico usa —
// a lógica de salas, chat e limites não se duplica.
const { registry } = criarSinal({ httpServer: servidor, caminhoWs: "/ws" });

servidor.listen(PORTA, HOSPEDEIRO, () => {
  console.log(`[daniellive] site + sinalização ouvindo em :${PORTA} (WS em /ws)`);
});
