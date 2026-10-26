import type { Metadata } from "next";
import { CodigoInvalido, WatchRoom } from "./WatchRoom";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const normalizado = normalizeRoomCode(code) ?? code;
  return {
    title: `Sala ${normalizado}`,
    description: `Assista à transmissão de tela da sala ${normalizado} no ScreenLive.`,
    // Uma sala é privada por natureza: não deve aparecer em busca.
    robots: { index: false, follow: false },
  };
}

export default async function AssistirPage({ params }: Props) {
  const { code } = await params;
  // Normaliza antes de validar: um link colado costuma trazer minúsculas e
  // espaços, e recusar por isso seria hostil.
  const normalizado = normalizeRoomCode(code) ?? "";

  if (!isValidRoomCode(normalizado)) {
    return <CodigoInvalido code={code} />;
  }

  return <WatchRoom code={normalizado} />;
}
