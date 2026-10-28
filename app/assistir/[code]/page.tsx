import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchRoom } from "./WatchRoom";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const normalizado = normalizeRoomCode(code) ?? code;
  return {
    title: `Sala ${normalizado}`,
    description: `Assista à transmissão de tela da sala ${normalizado} no DanielLive.`,
    // Uma sala é privada por natureza: não deve aparecer em busca.
    robots: { index: false, follow: false },
  };
}

export default async function AssistirPage({ params }: Props) {
  const { code } = await params;
  // Normaliza antes de validar: um link colado costuma trazer minúsculas e
  // espaços, e recusar por isso seria hostil.
  const normalizado = normalizeRoomCode(code) ?? "";

  // Um código com formato impossível é um endereço que não existe, não uma
  // página que existe e está vazia — daí o 404. A página de "não encontrado"
  // explica o formato esperado em vez de só recusar.
  if (!isValidRoomCode(normalizado)) notFound();

  return <WatchRoom code={normalizado} />;
}
