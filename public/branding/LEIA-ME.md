# Mascote do DanielLive

Coloque aqui a arte oficial do mascote (o pato de óculos).

## O que fazer

1. Salve a imagem **neste exato caminho**:

   ```
   public/branding/pato.png
   ```

   O nome precisa ser `pato.png` em minúsculas. O código procura por ele em
   `lib/marca.ts` (`MASCOTE.src`); se o nome mudar, ajuste lá também.

2. Gere o ícone do Windows a partir dela:

   ```bash
   npm run icone
   ```

   Isso reescreve `build/icon.png` e `build/icon.ico`, que são o ícone do
   executável, do instalador e dos atalhos.

3. Regenere o instalador:

   ```bash
   npm run desktop:build
   ```

## Como a arte é usada

- **A página inicial** mostra o mascote ao lado da apresentação, com 88 px.
- **O ícone do aplicativo** encaixa a arte num quadrado de 1024 px.
- **O instalador e os atalhos** usam o mesmo `.ico`.

## Regras que o código já garante

- **Não distorce.** A imagem é encaixada por proporção (`contain`): uma arte
  quadrada, alta ou larga entra inteira, com o que sobra transparente. Nada é
  esticado nem cortado.
- **Preserva a transparência.** Não há fundo forçado. Se o seu PNG tiver canal
  alfa, ele passa direto — o que importa muito em 16 px, onde um fundo branco
  deixaria um quadrado visível na barra de tarefas.
- **Não inventa substituto.** Se este arquivo não existir, a interface mostra o
  glifo da marca (uma tela com um ponto de transmissão), que é o mesmo desenho
  do ícone de reserva. O código nunca desenha um mascote diferente no lugar do
  seu.

## Tamanho recomendado

Pelo menos **512×512 px**, PNG com transparência. O gerador reduz para 1024 px,
então uma arte menor que isso perde nitidez no ícone grande do Explorer.

Se a sua arte for retangular, ajuste a proporção em `components/Mascote.tsx`
(`proporcao`, largura ÷ altura). O padrão é `1` (quadrada).
