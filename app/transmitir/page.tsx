import type { Metadata } from "next";
import { HostRoom } from "./HostRoom";

export const metadata: Metadata = {
  title: "Transmitir",
  description:
    "Crie uma sala, escolha o que compartilhar e envie o link. Sem instalar nada e sem criar conta.",
};

export default function TransmitirPage() {
  return <HostRoom />;
}
