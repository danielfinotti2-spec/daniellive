/**
 * Idade a partir de uma data de nascimento em `AAAA-MM-DD`.
 *
 * Módulo-folha puro (sem import de nada): vale para as duas pontas — a
 * validação do servidor no cadastro e a exibição no perfil do cliente
 * calculam o mesmo número, sem risco de divergir regra.
 */

export function idadeDe(nascimento: string | null | undefined, em: Date = new Date()): number | null {
  if (!nascimento) return null;
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento);
  if (!partes) return null;
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  let idade = em.getUTCFullYear() - ano;
  const jaFez = em.getUTCMonth() + 1 > mes || (em.getUTCMonth() + 1 === mes && em.getUTCDate() >= dia);
  if (!jaFez) idade -= 1;
  return idade >= 0 && idade <= 150 ? idade : null;
}

/** Formata a data de nascimento no idioma da interface (18/03/2004 etc.). */
export function formatoDeNascimento(nascimento: string | null | undefined, idioma: string): string | null {
  if (!nascimento) return null;
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento);
  if (!partes) return null;
  const data = new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])));
  if (Number.isNaN(data.getTime())) return null;
  return new Intl.DateTimeFormat(idioma, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(data);
}
