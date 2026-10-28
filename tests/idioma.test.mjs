/**
 * Testes do tradutor.
 *
 * O que se testa aqui não é a qualidade da tradução — isso é julgamento humano.
 * É a **integridade do mecanismo**: que os três idiomas cubram o mesmo conjunto
 * de chaves, que os marcadores batam entre idiomas, e que a escolha de idioma
 * se comporte como o esperado. São os defeitos que passariam despercebidos até
 * um usuário estrangeiro abrir o site e ver português no meio.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONTE = readFileSync(path.join(RAIZ, "lib", "idioma.ts"), "utf8");

/**
 * Extrai as chaves de cada dicionário direto do texto do arquivo.
 *
 * Ler o TypeScript como texto, e não importá-lo, evita depender de um runtime
 * de TS neste teste — os outros testes do projeto fazem o mesmo. O que se quer
 * é comparar os três objetos, e para isso basta a estrutura.
 */
function extrairChaves(nomeDoObjeto) {
  const inicio = FONTE.indexOf(`const ${nomeDoObjeto}`);
  assert.ok(inicio >= 0, `não achei o dicionário ${nomeDoObjeto}`);

  // Do início do objeto até o começo do próximo `const`, que é onde ele acaba.
  const resto = FONTE.slice(inicio);
  const proximo = resto.indexOf("\nconst ", 10);
  const corpo = proximo > 0 ? resto.slice(0, proximo) : resto;

  /**
   * Achata chaves aninhadas em caminhos com ponto.
   *
   * A profundidade é fixa em dois níveis (área e chave), que é a forma do
   * dicionário. Um terceiro nível existe em `qualidadeCurta` e
   * `espectadoresContagem`, e é tratado como parte do segundo nível — o que
   * importa é que os três idiomas tenham o mesmo conjunto.
   */
  const chaves = new Set();
  const area = /^\s{2}(\w+):\s*\{/gm;
  let m;
  while ((m = area.exec(corpo)) !== null) {
    const nomeArea = m[1];
    const inicioArea = m.index + m[0].length;
    // O fim da área é o `},` na mesma indentação de dois espaços.
    const fimArea = corpo.indexOf("\n  },", inicioArea);
    const bloco = corpo.slice(inicioArea, fimArea > 0 ? fimArea : corpo.length);

    // Chaves de texto: `chave: "valor"`.
    for (const c of bloco.matchAll(/^\s{4}(\w+):\s*"/gm)) {
      chaves.add(`${nomeArea}.${c[1]}`);
    }
    // Sub-objetos: `chave: {` — as folhas viram `area.chave.sub`.
    for (const c of bloco.matchAll(/^\s{4}(\w+):\s*\{/gm)) {
      const sub = c[1];
      const inicioSub = c.index + c[0].length;
      const fimSub = bloco.indexOf("\n    },", inicioSub);
      const corpoSub = bloco.slice(inicioSub, fimSub > 0 ? fimSub : bloco.length);
      for (const f of corpoSub.matchAll(/^\s{6}(\w+):\s*"/gm)) {
        chaves.add(`${nomeArea}.${sub}.${f[1]}`);
      }
    }
  }
  return chaves;
}

const pt = extrairChaves("ptBR");
const en = extrairChaves("en:");
const es = extrairChaves("es:");

test("tradutor", async (t) => {
  await t.test("o dicionário português não está vazio", () => {
    assert.ok(pt.size > 20, `esperava muitas chaves, achei ${pt.size}`);
  });

  await t.test("o inglês cobre exatamente as mesmas chaves que o português", () => {
    const faltando = [...pt].filter((k) => !en.has(k));
    const sobrando = [...en].filter((k) => !pt.has(k));
    assert.deepEqual(faltando, [], `faltam em inglês: ${faltando.join(", ")}`);
    assert.deepEqual(sobrando, [], `sobram em inglês: ${sobrando.join(", ")}`);
  });

  await t.test("o espanhol cobre exatamente as mesmas chaves que o português", () => {
    const faltando = [...pt].filter((k) => !es.has(k));
    const sobrando = [...es].filter((k) => !pt.has(k));
    assert.deepEqual(faltando, [], `faltam em espanhol: ${faltando.join(", ")}`);
    assert.deepEqual(sobrando, [], `sobram em espanhol: ${sobrando.join(", ")}`);
  });

  await t.test("o tipo do dicionário alarga os valores, não os fixa em literais", () => {
    /*
     * Sem isto, `Dicionario` sairia de `typeof ptBR` com cada string virando um
     * tipo literal — e nenhuma tradução seria atribuível. Foi o erro que o
     * typecheck pegou na primeira versão; aqui ele fica registrado para não
     * voltar por descuido.
     */
    assert.match(FONTE, /type Alargar</, "o tipo Alargar desapareceu");
    assert.match(
      FONTE,
      /export type Dicionario = Alargar<typeof ptBR>/,
      "Dicionario não usa mais Alargar",
    );
    assert.doesNotMatch(
      FONTE,
      /export type Dicionario = typeof ptBR/,
      "Dicionario voltou a fixar os valores como literais",
    );
  });

  await t.test("os marcadores de cada chave batem entre os três idiomas", () => {
    /*
     * `{n}` em português e `{contagem}` em inglês não quebra a compilação — o
     * texto continua sendo string. Mas na tela apareceria "{n}" literal, porque
     * a substituição procura a chave que o chamador passou. É o defeito mais
     * fácil de introduzir e o mais difícil de ver sem falar os três idiomas.
     */
    const marcadores = (corpo) => {
      const achados = new Map();
      for (const m of corpo.matchAll(/^\s{4,6}(\w+):\s*"([^"]*)"/gm)) {
        const nomes = [...m[2].matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();
        if (nomes.length) achados.set(m[1], nomes.join(","));
      }
      return achados;
    };

    const corpos = {
      "pt-BR": FONTE.slice(FONTE.indexOf("const ptBR"), FONTE.indexOf("const en:")),
      en: FONTE.slice(FONTE.indexOf("const en:"), FONTE.indexOf("const es:")),
      es: FONTE.slice(FONTE.indexOf("const es:"), FONTE.indexOf("const DICIONARIOS")),
    };

    const mapas = Object.fromEntries(
      Object.entries(corpos).map(([k, v]) => [k, marcadores(v)]),
    );

    for (const [chave, nomes] of mapas["pt-BR"]) {
      for (const idioma of ["en", "es"]) {
        const outros = mapas[idioma].get(chave);
        if (outros === undefined) continue; // a cobertura já é testada acima
        assert.equal(
          outros,
          nomes,
          `a chave "${chave}" usa {${nomes}} em português e {${outros}} em ${idioma}`,
        );
      }
    }
  });

  await t.test("a detecção do navegador cai no padrão quando não reconhece", () => {
    assert.match(FONTE, /function detectarDoNavegador/, "a detecção sumiu");
    // Um idioma não listado não pode virar inglês por acidente: o padrão é o
    // idioma de quem escreveu o produto.
    assert.match(
      FONTE,
      /return IDIOMA_PADRAO;\s*\n\}/,
      "detectarDoNavegador não devolve o padrão como último recurso",
    );
  });

  await t.test("o português é o idioma padrão", () => {
    assert.match(FONTE, /export const IDIOMA_PADRAO: Idioma = "pt-BR"/);
  });

  await t.test("a preferência é lida de fora do React, sem setState em efeito", () => {
    /*
     * O idioma vive no `localStorage`, que o servidor não tem. Ler num efeito
     * com `setState` causaria renderização em cascata e um piscar de idioma na
     * primeira pintura — o mesmo problema que o tema já resolveu com
     * `useSyncExternalStore`.
     */
    assert.match(FONTE, /useSyncExternalStore/, "o idioma deixou de usar fonte externa");
    assert.doesNotMatch(
      FONTE,
      /useEffect\([^)]*setIdioma/,
      "o idioma passou a ser definido num efeito",
    );
  });

  await t.test("preencher não quebra com marcador desconhecido", () => {
    // A função é pequena, mas o contrato importa: um marcador sem valor deve
    // sair como está, e não como "undefined" na cara do usuário.
    assert.match(FONTE, /export function preencher/, "preencher sumiu");
    assert.match(
      FONTE,
      /hasOwnProperty\.call\(valores, chave\)/,
      "preencher deixou de checar se o valor existe antes de substituir",
    );
  });

  await t.test("nenhum texto visível ficou fora do dicionário", () => {
    /*
     * O typecheck não pega uma string esquecida: `>Copiar<` é sintaticamente
     * válido, e continua aparecendo em português para quem escolheu inglês. A
     * varredura olha o JSX de todos os arquivos e exige que os literais de texto
     * e os rótulos de acessibilidade venham do dicionário.
     *
     * Nomes de produto e trechos técnicos são exceções conhecidas e estão na
     * lista de permissão abaixo.
     */
    const PERMITIDOS = new Set([
      "DanielLive",
      "localhost",
      "https://",
      "NEXT_PUBLIC_ICE_SERVERS",
      "WebRTC",
      "TURN",
      "GitHub",
      "Instagram",
      "Discord",
    ]);

    const arquivos = [];
    const andar = (dir) => {
      for (const e of readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) andar(rel);
        else if (/\.tsx$/.test(e.name)) arquivos.push(rel);
      }
    };
    for (const d of ["app", "components"]) andar(d);

    const ATRIBUTOS = /(?:aria-label|title|rotulo|descricao|legenda|placeholder|dica)\s*=\s*"([^"]{3,})"/g;
    const ENTRE_TAGS = />([^<>{}]*[A-Za-zÀ-ú]{4}[^<>{}]*)</g;
    const suspeitos = [];

    for (const rel of arquivos) {
      const linhas = readFileSync(path.join(RAIZ, rel), "utf8").split("\n");
      linhas.forEach((linha, i) => {
        const s = linha.trim();
        // Comentário, import e declaração de tipo não são texto de tela.
        if (
          s.startsWith("//") ||
          s.startsWith("*") ||
          s.startsWith("/*") ||
          s.startsWith("{/*") ||
          s.startsWith("import ") ||
          /^(export|const|type|interface|function)/.test(s)
        ) {
          return;
        }
        const limpa = linha.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
        const achados = [
          ...[...limpa.matchAll(ATRIBUTOS)].map((m) => m[1]),
          ...[...limpa.matchAll(ENTRE_TAGS)].map((m) => m[1].trim()),
        ];
        for (const txt of achados) {
          if (!txt || txt.startsWith("{")) continue;
          if (PERMITIDOS.has(txt)) continue;
          suspeitos.push(`${rel}:${i + 1} → ${txt.slice(0, 50)}`);
        }
      });
    }

    assert.deepEqual(
      suspeitos,
      [],
      `texto visível fora do dicionário:\n    ${suspeitos.join("\n    ")}`,
    );
  });

  await t.test("o idioma é escrito no html antes da primeira pintura", () => {
    /*
     * O servidor não conhece o idioma escolhido — ele vive no `localStorage`.
     * Sem escrever o `lang` no cliente, um leitor de tela pronunciaria inglês
     * com fonética de português.
     */
    const script = readFileSync(path.join(RAIZ, "components", "ThemeScript.tsx"), "utf8");
    assert.match(script, /setAttribute\("lang"/, "o script deixou de escrever o lang");
    assert.match(script, /daniellive-idioma/, "o script não lê a chave do idioma");

    // A regra de detecção precisa bater com a de `lib/idioma.ts`: as duas
    // decidem o mesmo idioma a partir do mesmo navegador.
    for (const idioma of ["pt-BR", "en", "es"]) {
      assert.ok(script.includes(`"${idioma}"`), `o script não conhece ${idioma}`);
    }
  });
});
