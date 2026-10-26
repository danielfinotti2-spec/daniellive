import type { NextConfig } from "next";

/**
 * A URL pública do servidor de sinalização é exposta ao cliente por
 * NEXT_PUBLIC_SIGNAL_URL. Quando ela não é definida, o cliente deriva o
 * endereço a partir da própria origem (mesmo host, porta 8787), o que é o
 * arranjo padrão em desenvolvimento e em um deploy de máquina única.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O cabeçalho Permissions-Policy é o que permite getDisplayMedia e
  // getUserMedia no domínio: sem `display-capture=(self)` alguns navegadores
  // recusam a captura mesmo com o usuário autorizando.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "display-capture=(self), microphone=(self), camera=(self)",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
