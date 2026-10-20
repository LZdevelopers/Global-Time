// Contas (e-mail e senha) e sessões.
//
//  - Senhas: scrypt (node:crypto) com sal aleatório por conta; comparação em
//    tempo constante. A senha nunca é guardada nem registrada.
//  - Sessão: token aleatório de 256 bits no cookie HttpOnly "gt_sessao"
//    (SameSite=Lax, Secure em HTTPS). No armazém fica só o hash SHA-256 do
//    token, com validade de 30 dias.
//  - Tentativas de login e cadastro são limitadas por IP e por e-mail.
//  - Mensagem única para e-mail inexistente ou senha errada.
//
// Chaves no Redis:
//   conta:email:<e-mail>  → id da conta
//   conta:<id>            → { id, email, sal, hash, criadoEm }
//   sessao:<hash>         → id da conta (expira)
//   eventos:<id>          → hash { idEvento → evento }
//   limite:<tipo>:<chave> → contador (expira)

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { executar } from "./armazem.js";
import { ErroHttp, seguro } from "./http.js";

const scrypt = promisify(scryptCb);

export const COOKIE = "gt_sessao";
const VALIDADE_SESSAO_S = 30 * 24 * 60 * 60;
const JANELA_LIMITE_S = 15 * 60;
const LIMITE_POR_IP = 30;
const LIMITE_POR_EMAIL = 10;
export const SENHA_MINIMA = 8;
const SENHA_MAXIMA = 200;
const RE_EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function normalizarEmail(valor) {
  const email = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  return email.length <= 254 && RE_EMAIL.test(email) ? email : null;
}

function validarSenha(valor) {
  if (typeof valor !== "string") throw new ErroHttp(400, "senha-invalida");
  if (valor.length < SENHA_MINIMA) throw new ErroHttp(400, "senha-curta");
  if (valor.length > SENHA_MAXIMA) throw new ErroHttp(400, "senha-invalida");
  return valor;
}

async function derivar(senha, sal) {
  return scrypt(senha.normalize("NFKC"), sal, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

/** Conta tentativas; recusa com 429 acima do limite na janela. */
async function limitar(tipo, chave, maximo) {
  const nome = `limite:${tipo}:${createHash("sha256").update(chave).digest("hex").slice(0, 32)}`;
  const [contagem] = await executar(["INCR", nome]);
  if (contagem === 1) await executar(["EXPIRE", nome, String(JANELA_LIMITE_S)]);
  if (contagem > maximo) throw new ErroHttp(429, "muitas-tentativas");
}

export async function limitarTentativas(ip, email) {
  await limitar("ip", ip, LIMITE_POR_IP);
  if (email) await limitar("email", email, LIMITE_POR_EMAIL);
}

export async function criarConta(emailBruto, senhaBruta) {
  const email = normalizarEmail(emailBruto);
  if (!email) throw new ErroHttp(400, "email-invalido");
  const senha = validarSenha(senhaBruta);
  const id = randomBytes(12).toString("hex");
  // NX: só cria se o e-mail ainda não estiver em uso (sem condição de corrida).
  const [ok] = await executar(["SET", `conta:email:${email}`, id, "NX"]);
  if (ok !== "OK") throw new ErroHttp(409, "email-em-uso");
  const sal = randomBytes(16);
  const hash = await derivar(senha, sal);
  const conta = { id, email, sal: sal.toString("base64"), hash: hash.toString("base64"), criadoEm: Date.now() };
  await executar(["SET", `conta:${id}`, JSON.stringify(conta)]);
  return { id, email };
}

export async function verificarCredenciais(emailBruto, senhaBruta) {
  const email = normalizarEmail(emailBruto);
  const senha = typeof senhaBruta === "string" ? senhaBruta : "";
  // Mesmo custo de cálculo com ou sem conta, para não revelar quais e-mails existem.
  const [id] = email ? await executar(["GET", `conta:email:${email}`]) : [null];
  const [bruto] = id ? await executar(["GET", `conta:${id}`]) : [null];
  const conta = bruto ? JSON.parse(bruto) : null;
  const sal = conta ? Buffer.from(conta.sal, "base64") : randomBytes(16);
  const calculado = await derivar(senha.slice(0, SENHA_MAXIMA), sal);
  const esperado = conta ? Buffer.from(conta.hash, "base64") : randomBytes(64);
  const igual = calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
  if (!conta || !igual) throw new ErroHttp(401, "credenciais-invalidas");
  return { id: conta.id, email: conta.email };
}

// ---- Sessão (cookie) ------------------------------------------------------------
function lerCookies(req) {
  const saida = {};
  for (const parte of String(req.headers.cookie || "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0) saida[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return saida;
}

function cookieSessao(req, valor, maxAge) {
  const partes = [`${COOKIE}=${valor}`, "Path=/api", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (seguro(req)) partes.push("Secure");
  return partes.join("; ");
}

export async function abrirSessao(req, res, conta) {
  const token = randomBytes(32).toString("base64url");
  await executar(["SET", `sessao:${hashToken(token)}`, conta.id, "EX", String(VALIDADE_SESSAO_S)]);
  res.setHeader("Set-Cookie", cookieSessao(req, token, VALIDADE_SESSAO_S));
}

export async function encerrarSessao(req, res) {
  const token = lerCookies(req)[COOKIE];
  if (token && /^[A-Za-z0-9_-]{20,100}$/.test(token)) await executar(["DEL", `sessao:${hashToken(token)}`]);
  res.setHeader("Set-Cookie", cookieSessao(req, "", 0));
}

/** Conta da sessão atual ({ id, email }) ou null. */
export async function contaDaSessao(req) {
  const token = lerCookies(req)[COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [id] = await executar(["GET", `sessao:${hashToken(token)}`]);
  if (!id) return null;
  const [bruto] = await executar(["GET", `conta:${id}`]);
  if (!bruto) return null;
  const conta = JSON.parse(bruto);
  return { id: conta.id, email: conta.email };
}

export async function exigirConta(req) {
  const conta = await contaDaSessao(req);
  if (!conta) throw new ErroHttp(401, "nao-autenticado");
  return conta;
}

/** Exclui a conta, os eventos e a sessão atual (pede a senha de novo). */
export async function excluirConta(req, res, conta, senha) {
  await verificarCredenciais(conta.email, senha);
  await executar(["DEL", `eventos:${conta.id}`, `conta:${conta.id}`, `conta:email:${conta.email}`]);
  await encerrarSessao(req, res);
}
