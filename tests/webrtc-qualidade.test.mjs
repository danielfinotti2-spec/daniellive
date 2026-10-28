/**
 * Testes da qualidade aplicada com a transmissão em curso.
 * Executa com: npm test
 *
 * Cobrem `aplicarQualidadeAoVivo`: a troca de qualidade no meio da transmissão
 * precisa chegar à faixa e aos transmissores imediatamente — foi a ausência
 * dessa aplicação que fez a opção "Automática" parecer quebrada por dentro do
 * aplicativo (a escolha valia só para a próxima captura).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { aplicarQualidadeAoVivo } from "../lib/qualidade.ts";

/** Faixa falsa que só registra o que foi pedido. */
function faixaFalsa() {
  const chamadas = [];
  return {
    contentHint: "",
    applyConstraints: (c) => {
      chamadas.push(c);
      return Promise.resolve();
    },
    chamadas,
  };
}

/** Transmissor falso: guarda o último `setParameters` recebido. */
function senderFalso(kind, paramsIniciais = { encodings: [{}] }) {
  return {
    track: { kind },
    parametros: paramsIniciais,
    aplicados: [],
    getParameters() {
      return this.parametros;
    },
    setParameters(p) {
      this.aplicados.push(p);
      this.parametros = p;
      return Promise.resolve();
    },
  };
}

function parFalso(senders) {
  return { pc: { getSenders: () => senders, onicecandidate: null, close() {} } };
}

describe("aplicarQualidadeAoVivo", () => {
  test("720p ajusta a faixa e fecha o teto de banda dos transmissores", async () => {
    const faixa = faixaFalsa();
    const video = senderFalso("video");
    aplicarQualidadeAoVivo({ videoTrack: faixa }, [parFalso([video])], "720p");

    assert.deepEqual(faixa.chamadas, [
      { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    ]);
    assert.equal(video.aplicados.length, 1);
    assert.equal(video.aplicados[0].encodings[0].maxBitrate, 4_000_000);
  });

  test("480p aperta a banda para o degrau baixo", () => {
    const faixa = faixaFalsa();
    const video = senderFalso("video");
    aplicarQualidadeAoVivo({ videoTrack: faixa }, [parFalso([video])], "480p");
    assert.equal(video.aplicados[0].encodings[0].maxBitrate, 1_500_000);
  });

  test("automática não toca na faixa e solta o teto de banda", () => {
    const faixa = faixaFalsa();
    const video = senderFalso("video", { encodings: [{ maxBitrate: 4_000_000 }] });
    aplicarQualidadeAoVivo({ videoTrack: faixa }, [parFalso([video])], "auto");

    assert.equal(faixa.chamadas.length, 0, "automática não renegocia a captura");
    assert.equal(video.aplicados.length, 1);
    assert.ok(
      !("maxBitrate" in video.aplicados[0].encodings[0]),
      "o teto sai — o navegador volta a ajustar sozinho",
    );
  });

  test("só transmissores de vídeo recebem o teto", () => {
    const faixa = faixaFalsa();
    const video = senderFalso("video");
    const audio = senderFalso("audio");
    aplicarQualidadeAoVivo({ videoTrack: faixa }, [parFalso([video, audio])], "720p");

    assert.equal(video.aplicados.length, 1);
    assert.equal(audio.aplicados.length, 0, "faixa de áudio não é tocada");
  });

  test("navegador que recusa applyConstraints não derruba a troca", async () => {
    const faixa = faixaFalsa();
    faixa.applyConstraints = () => Promise.reject(new Error("recusado"));
    const video = senderFalso("video");
    // Não pode lançar nem deixar promessa rejeitada sem dono.
    aplicarQualidadeAoVivo({ videoTrack: faixa }, [parFalso([video])], "720p");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(video.aplicados.length, 1, "o teto de banda ainda assim se aplica");
  });

  test("transmissor sem encodings expostos ainda recebe o teto", () => {
    const faixa = faixaFalsa();
    const video = senderFalso("video", {});
    aplicarQualidadeAoVivo({ videoTrack: faixa }, [parFalso([video])], "1080p");
    assert.equal(video.aplicados[0].encodings[0].maxBitrate, 6_000_000);
  });
});
