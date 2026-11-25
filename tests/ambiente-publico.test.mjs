import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { configurarAmbientePublico } from "../server/ambiente.mjs";

describe("ambiente do servidor público", () => {
  test("usa porta 3000 e escuta todas as interfaces por padrão", () => {
    assert.deepEqual(configurarAmbientePublico({}), { porta: 3000, hospedeiro: "0.0.0.0" });
  });

  test("respeita PORT e HOST", () => {
    assert.deepEqual(configurarAmbientePublico({ PORT: "8080", HOST: " 127.0.0.1 " }), {
      porta: 8080,
      hospedeiro: "127.0.0.1",
    });
  });

  test("usa SERVER_PORT nos servidores tradicionais da Altare", () => {
    assert.equal(configurarAmbientePublico({ SERVER_PORT: "30001" }).porta, 30001);
  });

  test("PORT tem precedência sobre SERVER_PORT", () => {
    assert.equal(configurarAmbientePublico({ PORT: "8080", SERVER_PORT: "30001" }).porta, 8080);
  });

  test("HOST vazio mantém a interface pública", () => {
    assert.equal(configurarAmbientePublico({ HOST: " " }).hospedeiro, "0.0.0.0");
  });

  for (const porta of ["", "0", "-1", "65536", "3.5", "abc", "Infinity"]) {
    test(`recusa porta inválida: ${JSON.stringify(porta)}`, () => {
      assert.throws(() => configurarAmbientePublico({ PORT: porta }), /PORT\/SERVER_PORT/);
    });
  }

  test("ALTARE_URL autoriza somente a origem, sem caminho nem barra final", () => {
    const ambiente = { ALTARE_URL: " https://daniellive.go.altare.global/pagina/ " };
    configurarAmbientePublico(ambiente);
    assert.equal(ambiente.ALLOWED_ORIGINS, "https://daniellive.go.altare.global");
  });

  test("mantém o fallback do Render", () => {
    const ambiente = { RENDER_EXTERNAL_URL: "https://daniellive.onrender.com/" };
    configurarAmbientePublico(ambiente);
    assert.equal(ambiente.ALLOWED_ORIGINS, "https://daniellive.onrender.com");
  });

  test("a lista do operador não é sobrescrita", () => {
    const ambiente = {
      ALLOWED_ORIGINS: "https://exemplo.com,https://www.exemplo.com",
      ALTARE_URL: "https://daniellive.go.altare.global",
    };
    configurarAmbientePublico(ambiente);
    assert.equal(ambiente.ALLOWED_ORIGINS, "https://exemplo.com,https://www.exemplo.com");
  });

  test("lista em branco recebe a origem da plataforma", () => {
    const ambiente = { ALLOWED_ORIGINS: "  ", ALTARE_URL: "https://daniellive.go.altare.global" };
    configurarAmbientePublico(ambiente);
    assert.equal(ambiente.ALLOWED_ORIGINS, "https://daniellive.go.altare.global");
  });

  test("não libera origens quando nenhuma URL foi configurada", () => {
    const ambiente = {};
    configurarAmbientePublico(ambiente);
    assert.equal(ambiente.ALLOWED_ORIGINS, undefined);
  });

  test("não interfere na URL pública explícita do operador", () => {
    const ambiente = { ALLOWED_ORIGINS: "https://exemplo.com", ALTARE_URL: "inválida" };
    assert.doesNotThrow(() => configurarAmbientePublico(ambiente));
  });

  for (const url of ["inválida", "ftp://exemplo.com", "https://senha:secreta@exemplo.com"]) {
    test(`recusa URL de plataforma inválida: ${url}`, () => {
      assert.throws(() => configurarAmbientePublico({ ALTARE_URL: url }), /URL HTTP\(S\)/);
    });
  }
});
