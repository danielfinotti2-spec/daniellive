/**
 * A qualidade da captura — os degraus e como aplicá-los.
 *
 * Separada de `webrtc.ts` de propósito: nada aqui depende de rede, sinalização
 * ou navegador completo, só de `MediaStreamTrack` e `RTCRtpSender`. É o que
 * deixa a lógica testável em Node puro e reutilizável nos dois caminhos —
 * captura nova (`webrtc.ts`) e transmissão em curso (`useHost.ts`).
 */

/** Os degraus que o menu de qualidade oferece. */
export type CaptureQuality = "auto" | "1080p" | "720p" | "480p";

/** Limites da faixa por degrau. "Automática" não limita nada. */
export const QUALITY_CONSTRAINTS: Record<CaptureQuality, MediaTrackConstraints> = {
  auto: {},
  "1080p": { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
  "720p": { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  "480p": { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
};

/**
 * Teto de banda por degrau, em bits por segundo.
 *
 * A resolução da captura dá o tamanho do quadro; o teto dá o peso dele na rede.
 * Sem teto, um quadro 1080p continua caro mesmo quando a pessoa escolheu 480p
 * depois de começar — e um teto apertado num quadro 1080p deixa a imagem
 * borrada mesmo antes de a captura convergir para o degrau novo. Os dois
 * controles trabalham juntos.
 *
 * "Automática" não tem número: o ajuste contínuo é justamente o comportamento
 * que se pede ao navegador, e um teto inventado o estragaria.
 */
export const BANDA_POR_QUALIDADE: Record<CaptureQuality, number | null> = {
  auto: null,
  "1080p": 6_000_000,
  "720p": 4_000_000,
  "480p": 1_500_000,
};

/**
 * O pedaço mínimo de uma captura local que a aplicação ao vivo precisa tocar.
 */
export type CapturaQueTroca = { videoTrack: MediaStreamTrack };

/**
 * O pedaço mínimo de uma conexão com espectador: os transmissores.
 */
export type ParQueTroca = { pc: Pick<RTCPeerConnection, "getSenders"> };

/**
 * Aplica a qualidade escolhida à transmissão em andamento.
 *
 * Antes daqui a qualidade só valia na próxima captura — mudá-la durante a
 * transmissão parecia não fazer nada, porque de fato não fazia. Agora:
 *
 *  1. a faixa recebe os limites novos com `applyConstraints`, que negocia a
 *     resolução da captura sem pedir a tela de novo (no Chromium de captura de
 *     tela é melhor esforço: se recusar, a banda ainda muda no passo 2);
 *  2. cada transmissor recebe o teto de banda do degrau, que entra em vigor no
 *     mesmo segundo e é o que realmente alivia uma rede ruim.
 *
 * Em "Automática" não se toca na faixa — os limites do degrau anterior ficam, e
 * tirá-los exigiria uma captura nova — mas o teto de banda sai, devolvendo o
 * ajuste livre ao navegador.
 */
export function aplicarQualidadeAoVivo(
  capture: CapturaQueTroca,
  peers: readonly ParQueTroca[],
  quality: CaptureQuality,
): void {
  if (quality !== "auto") {
    const limites = QUALITY_CONSTRAINTS[quality];
    void capture.videoTrack
      .applyConstraints({
        width: limites.width,
        height: limites.height,
        frameRate: limites.frameRate,
      })
      .catch(() => {
        /* faixa sem negociação de tamanho: o teto de banda continua valendo */
      });
  }

  for (const peer of peers) {
    for (const sender of peer.pc.getSenders()) {
      if (sender.track?.kind !== "video") continue;
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        for (const encoding of params.encodings) {
          const teto = BANDA_POR_QUALIDADE[quality];
          if (teto === null) delete encoding.maxBitrate;
          else encoding.maxBitrate = teto;
        }
        void sender.setParameters(params).catch(() => {
          /* parâmetro recusado: a próxima captura já sai com o degrau novo */
        });
      } catch {
        /* `getParameters` indisponível neste navegador */
      }
    }
  }
}
