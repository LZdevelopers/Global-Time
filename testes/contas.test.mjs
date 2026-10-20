import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { Readable } from "node:stream";

process.env.GT_ARMAZEM = "memoria";
const { default: conta } = await import("../api/conta.js");
const { default: eventos } = await import("../api/eventos.js");
const { limparMemoria } = await import("../api/_lib/armazem.js");

const ORIGEM = "https://globaltime.test";

/** Simula um pedido às funções: devolve { status, corpo, cookie }. */
async function pedir(handler, { metodo = "GET", url = "/api/x", corpo, cookie, origem = ORIGEM, tipo = "application/json" } = {}) {
  const texto = corpo === undefined ? "" : typeof corpo === "string" ? corpo : JSON.stringify(corpo);
  const req = Readable.from(texto ? [Buffer.from(texto)] : []);
  req.method = metodo;
  req.url = url;
  req.headers = { host: "globaltime.test", "x-forwarded-proto": "https", "content-type": tipo };
  if (origem) req.headers.origin = origem;
  if (cookie) req.headers.cookie = cookie;
  const cabecalhos = {};
  let saida = "";
  const res = {
    statusCode: 200,
    setHeader: (n, v) => (cabecalhos[n.toLowerCase()] = v),
    end: (t) => (saida = t ?? ""),
  };
  await handler(req, res);
  const setCookie = cabecalhos["set-cookie"];
  return {
    status: res.statusCode,
    corpo: saida ? JSON.parse(saida) : null,
    cookie: setCookie ? setCookie.split(";")[0] : null,
    setCookie,
    cabecalhos,
  };
}

const cadastrar = (email = "ana@exemplo.com", senha = "senha-segura-1") =>
  pedir(conta, { metodo: "POST", corpo: { acao: "cadastrar", email, senha } });

beforeEach(() => limparMemoria());

test("cadastro abre sessão com cookie HttpOnly, Secure e SameSite", async () => {
  const r = await cadastrar();
  assert.equal(r.status, 201);
  assert.equal(r.corpo.conta.email, "ana@exemplo.com");
  assert.match(r.setCookie, /^gt_sessao=[\w-]{40,}; Path=\/api; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure$/);
  assert.equal(r.cabecalhos["cache-control"].includes("no-store"), true);
  const sessao = await pedir(conta, { cookie: r.cookie });
  assert.deepEqual(sessao.corpo, { disponivel: true, conta: { email: "ana@exemplo.com" } });
});

test("cadastro valida e-mail, senha e e-mail repetido", async () => {
  assert.equal((await cadastrar("invalido", "senha-segura-1")).corpo.erro, "email-invalido");
  assert.equal((await cadastrar("b@exemplo.com", "curta")).corpo.erro, "senha-curta");
  await cadastrar("c@exemplo.com");
  const repetido = await cadastrar("C@Exemplo.com");
  assert.equal(repetido.status, 409);
  assert.equal(repetido.corpo.erro, "email-em-uso");
});

test("login com senha errada ou e-mail inexistente dá a mesma resposta", async () => {
  await cadastrar();
  const errada = await pedir(conta, { metodo: "POST", corpo: { acao: "entrar", email: "ana@exemplo.com", senha: "outra-senha" } });
  const inexistente = await pedir(conta, { metodo: "POST", corpo: { acao: "entrar", email: "zeca@exemplo.com", senha: "outra-senha" } });
  assert.equal(errada.status, 401);
  assert.deepEqual(errada.corpo, inexistente.corpo);
  const certa = await pedir(conta, { metodo: "POST", corpo: { acao: "entrar", email: "ANA@exemplo.com", senha: "senha-segura-1" } });
  assert.equal(certa.status, 200);
  assert.ok(certa.cookie);
});

test("sair invalida a sessão", async () => {
  const { cookie } = await cadastrar();
  const saida = await pedir(conta, { metodo: "POST", corpo: { acao: "sair" }, cookie });
  assert.match(saida.setCookie, /Max-Age=0/);
  assert.equal((await pedir(conta, { cookie })).corpo.conta, null);
});

test("pedidos de outra origem, sem Origin ou sem JSON são recusados", async () => {
  assert.equal((await pedir(conta, { metodo: "POST", corpo: { acao: "sair" }, origem: "https://malicioso.test" })).status, 403);
  assert.equal((await pedir(conta, { metodo: "POST", corpo: { acao: "sair" }, origem: null })).status, 403);
  assert.equal((await pedir(conta, { metodo: "POST", corpo: "acao=sair", tipo: "application/x-www-form-urlencoded" })).status, 415);
  assert.equal((await pedir(conta, { metodo: "POST", corpo: "{quebrado" })).status, 400);
});

test("tentativas de login são limitadas por e-mail", async () => {
  await cadastrar();
  let ultima;
  for (let i = 0; i < 12; i += 1) {
    ultima = await pedir(conta, { metodo: "POST", corpo: { acao: "entrar", email: "ana@exemplo.com", senha: "errada-123" } });
  }
  assert.equal(ultima.status, 429);
});

test("eventos exigem sessão", async () => {
  assert.equal((await pedir(eventos)).status, 401);
});

test("criar, listar, editar e excluir eventos da própria conta", async () => {
  const { cookie } = await cadastrar();
  const criado = await pedir(eventos, {
    metodo: "POST",
    cookie,
    corpo: { titulo: "  Aniversário da Ana ", data: "2026-03-14", hora: "19:30", descricao: "Levar bolo", anual: true },
  });
  assert.equal(criado.status, 201);
  const { evento } = criado.corpo;
  assert.equal(evento.titulo, "Aniversário da Ana");
  assert.equal(evento.anual, true);

  const lista = await pedir(eventos, { cookie });
  assert.equal(lista.corpo.eventos.length, 1);

  const editado = await pedir(eventos, { metodo: "PUT", url: `/api/eventos?id=${evento.id}`, cookie, corpo: { ...evento, titulo: "Aniversário", hora: "" } });
  assert.equal(editado.status, 200);
  assert.equal(editado.corpo.evento.titulo, "Aniversário");
  assert.equal(editado.corpo.evento.hora, null);
  assert.equal(editado.corpo.evento.criadoEm, evento.criadoEm);

  const excluido = await pedir(eventos, { metodo: "DELETE", url: `/api/eventos?id=${evento.id}`, cookie });
  assert.equal(excluido.status, 200);
  assert.equal((await pedir(eventos, { cookie })).corpo.eventos.length, 0);
});

test("uma conta não vê nem altera eventos de outra", async () => {
  const ana = (await cadastrar("ana@exemplo.com")).cookie;
  const bia = (await cadastrar("bia@exemplo.com")).cookie;
  const { evento } = (await pedir(eventos, { metodo: "POST", cookie: ana, corpo: { titulo: "Privado", data: "2026-05-01" } })).corpo;
  assert.equal((await pedir(eventos, { cookie: bia })).corpo.eventos.length, 0);
  const tentativa = await pedir(eventos, { metodo: "PUT", url: `/api/eventos?id=${evento.id}`, cookie: bia, corpo: { titulo: "Invadido", data: "2026-05-01" } });
  assert.equal(tentativa.status, 404);
  await pedir(eventos, { metodo: "DELETE", url: `/api/eventos?id=${evento.id}`, cookie: bia });
  assert.equal((await pedir(eventos, { cookie: ana })).corpo.eventos[0].titulo, "Privado");
});

test("evento inválido devolve os campos com erro", async () => {
  const { cookie } = await cadastrar();
  const r = await pedir(eventos, { metodo: "POST", cookie, corpo: { titulo: "", data: "2026-02-30", hora: "25:00" } });
  assert.equal(r.status, 400);
  assert.deepEqual(r.corpo.campos, { titulo: "obrigatorio", data: "invalida", hora: "invalida" });
});

test("excluir a conta pede a senha e apaga os eventos", async () => {
  const { cookie } = await cadastrar();
  await pedir(eventos, { metodo: "POST", cookie, corpo: { titulo: "X", data: "2026-01-01" } });
  assert.equal((await pedir(conta, { metodo: "DELETE", cookie, corpo: { senha: "errada-123" } })).status, 401);
  assert.equal((await pedir(conta, { metodo: "DELETE", cookie, corpo: { senha: "senha-segura-1" } })).status, 200);
  assert.equal((await pedir(eventos, { cookie })).status, 401);
  assert.equal((await cadastrar()).status, 201);
});

test("sem armazenamento configurado, contas ficam indisponíveis", async () => {
  delete process.env.GT_ARMAZEM;
  try {
    assert.deepEqual((await pedir(conta)).corpo, { disponivel: false, conta: null });
    assert.equal((await cadastrar()).status, 503);
  } finally {
    process.env.GT_ARMAZEM = "memoria";
  }
});
