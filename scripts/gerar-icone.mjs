/**
 * Gera o ícone do aplicativo para o Windows.
 *
 * Duas origens, nesta ordem:
 *
 *  1. **O mascote** (`public/branding/pato.png`). É a identidade oficial do
 *     DanielLive, então quando o arquivo existe ele manda — é ele que vira
 *     ícone do executável, do instalador e dos atalhos.
 *  2. **O glifo da marca**, desenhado em código. Serve de reserva para quem
 *     clona o repositório sem a arte. Não é um mascote substituto: é o mesmo
 *     símbolo do cabeçalho do site (uma tela com um ponto de transmissão).
 *
 * O mascote é ajustado, nunca distorcido: a imagem é encaixada por proporção
 * (`contain`), centralizada, e o que sobra vira transparência. Assim uma arte
 * quadrada, alta ou larga chega no ícone sem esticar.
 *
 * A transparência original é preservada. O Windows não gosta de ícone sem
 * alfa: em 16 px o recorte fica sujo, e o ícone aparece com um quadrado branco
 * no Explorer e na barra de tarefas. Por isso o PNG de origem com alfa passa
 * direto, e só o glifo de reserva recebe o fundo azul.
 *
 * Saída: `build/icon.png` (1024×1024) e `build/icon.ico` (16 a 256 px), que é o
 * que o electron-builder consome.
 *
 * Executa com: node scripts/gerar-icone.mjs
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SAIDA = "build";
const MASCOTE = "public/branding/pato.png";

/** O azul da marca, o mesmo declarado em app/globals.css. */
const AZUL = "#2563eb";
const AZUL_ESCURO = "#1d4ed8";

/** Tamanhos do .ico: da barra de tarefas (16) ao Explorer em telas grandes (256). */
const TAMANHOS = [16, 24, 32, 48, 64, 128, 256];

/**
 * Desenha o glifo da marca num canvas e devolve um PNG em base64.
 *
 * O traço é proporcional ao lado, não um valor fixo: em 16 px uma espessura
 * fixa sumiria, e em 256 px pareceria um fio.
 */
function desenharGlifo(lado) {
  return `(() => {
    const S = ${lado};
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const g = c.getContext("2d");

    // Fundo arredondado com um leve degradê: dá profundidade sem virar enfeite.
    const raio = S * 0.22;
    const grad = g.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, "${AZUL}");
    grad.addColorStop(1, "${AZUL_ESCURO}");
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(0, 0, S, S, raio);
    g.fill();

    // O glifo ocupa a área central, com folga nas bordas como manda o Windows.
    const escala = S / 24;
    const deslocamento = (S - 24 * escala) / 2;
    g.translate(deslocamento, deslocamento);
    g.scale(escala, escala);

    g.strokeStyle = "#ffffff";
    g.lineWidth = 2.2;
    g.lineCap = "round";
    g.lineJoin = "round";

    // A tela: mesmo retângulo do cabeçalho do site.
    g.beginPath();
    g.roundRect(2.5, 4, 15, 11, 1.6);
    g.stroke();

    // O pedestal.
    g.beginPath();
    g.moveTo(6.5, 19);
    g.lineTo(13.5, 19);
    g.stroke();

    // O ponto de transmissão, preenchido — é o que lê bem em 16 px.
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(19, 17, 2.9, 0, Math.PI * 2);
    g.fill();

    return c.toDataURL("image/png").split(",")[1];
  })()`;
}

/**
 * Encaixa uma imagem de origem num quadrado de `lado`, sem distorcer.
 *
 * O fator é o menor dos dois eixos (`contain`), então a imagem inteira cabe e
 * a sobra fica transparente. Nunca usamos `cover`: cortar um mascote com
 * óculos corta justamente o que o identifica.
 *
 * A origem é passada como data URL porque a página é `about:blank` e não pode
 * buscar arquivos locais sem violar a política de mesma origem.
 */
function encaixarMascote(lado, dataUrl) {
  return `(async () => {
    const S = ${lado};
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const g = c.getContext("2d");

    const img = new Image();
    img.src = ${JSON.stringify(dataUrl)};
    await img.decode();

    // 'contain': preserva a proporção original da arte.
    const fator = Math.min(S / img.naturalWidth, S / img.naturalHeight);
    const largura = img.naturalWidth * fator;
    const altura = img.naturalHeight * fator;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, (S - largura) / 2, (S - altura) / 2, largura, altura);

    return c.toDataURL("image/png").split(",")[1];
  })()`;
}

mkdirSync(SAIDA, { recursive: true });

const temMascote = existsSync(MASCOTE);
const origem = temMascote ? "mascote" : "glifo de reserva";
console.log(`origem do ícone: ${origem}${temMascote ? ` (${MASCOTE})` : ""}`);

// O mascote vai embutido como data URL; o buffer é lido uma vez só.
const mascoteDataUrl = temMascote
  ? `data:image/png;base64,${readFileSync(MASCOTE).toString("base64")}`
  : null;

const navegador = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await (await navegador.newContext()).newPage();
  await page.goto("about:blank");

  const desenhar = (lado) =>
    temMascote ? page.evaluate(encaixarMascote(lado, mascoteDataUrl)) : page.evaluate(desenharGlifo(lado));

  // PNG grande: é o que o electron-builder usa para o ícone do instalador.
  const pngGrande = await desenhar(1024);
  writeFileSync(`${SAIDA}/icon.png`, Buffer.from(pngGrande, "base64"));
  console.log(`${SAIDA}/icon.png  (1024x1024)`);

  // O .ico é montado à mão: o formato aceita vários PNGs embutidos, e assim
  // evitamos depender de uma ferramenta externa de conversão.
  const imagens = [];
  for (const t of TAMANHOS) {
    imagens.push({ tamanho: t, dados: Buffer.from(await desenhar(t), "base64") });
  }

  // Cabeçalho ICONDIR (6 bytes) + uma entrada ICONDIRENTRY (16 bytes) por imagem.
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // tipo 1 = ícone
  cabecalho.writeUInt16LE(imagens.length, 4);

  const entradas = [];
  let deslocamento = 6 + imagens.length * 16;
  for (const img of imagens) {
    const e = Buffer.alloc(16);
    // 256 é gravado como 0 no formato ICO — é a convenção da especificação.
    e.writeUInt8(img.tamanho >= 256 ? 0 : img.tamanho, 0);
    e.writeUInt8(img.tamanho >= 256 ? 0 : img.tamanho, 1);
    e.writeUInt8(0, 2); // paleta
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por pixel
    e.writeUInt32LE(img.dados.length, 8);
    e.writeUInt32LE(deslocamento, 12);
    entradas.push(e);
    deslocamento += img.dados.length;
  }

  const ico = Buffer.concat([cabecalho, ...entradas, ...imagens.map((i) => i.dados)]);
  writeFileSync(`${SAIDA}/icon.ico`, ico);
  console.log(`${SAIDA}/icon.ico  (${TAMANHOS.join(", ")} px) em ${ico.length} bytes`);
} finally {
  await navegador.close();
}
