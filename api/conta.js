// /api/conta — sessão do usuário.
//
//   GET                                  → { disponivel, conta: { email } | null }
//   POST { acao: "cadastrar", email, senha }
//   POST { acao: "entrar", email, senha }
//   POST { acao: "sair" }
//   DELETE { senha }                     → exclui a conta e os eventos
//
// "disponivel" é false quando o armazenamento (Upstash Redis) não está
// configurado na Vercel; a interface então oferece só eventos locais.

import { armazemDisponivel } from "./_lib/armazem.js";
import {
  abrirSessao,
  contaDaSessao,
  criarConta,
  encerrarSessao,
  excluirConta,
  exigirConta,
  limitarTentativas,
  normalizarEmail,
  verificarCredenciais,
} from "./_lib/contas.js";
import { ErroHttp, exigirMesmaOrigem, ipCliente, lerJson, responder, rota } from "./_lib/http.js";

export default rota(async (req, res) => {
  if (req.method === "GET") {
    if (!armazemDisponivel()) return responder(res, 200, { disponivel: false, conta: null });
    const conta = await contaDaSessao(req);
    return responder(res, 200, { disponivel: true, conta: conta ? { email: conta.email } : null });
  }

  if (req.method !== "POST" && req.method !== "DELETE") {
    throw new ErroHttp(405, "metodo-nao-permitido");
  }
  exigirMesmaOrigem(req);
  if (!armazemDisponivel()) throw new ErroHttp(503, "contas-indisponiveis");
  const corpo = await lerJson(req);

  if (req.method === "DELETE") {
    const conta = await exigirConta(req);
    await limitarTentativas(ipCliente(req), conta.email);
    await excluirConta(req, res, conta, corpo.senha);
    return responder(res, 200, { ok: true });
  }

  switch (corpo.acao) {
    case "cadastrar": {
      await limitarTentativas(ipCliente(req), normalizarEmail(corpo.email));
      const conta = await criarConta(corpo.email, corpo.senha);
      await abrirSessao(req, res, conta);
      return responder(res, 201, { conta: { email: conta.email } });
    }
    case "entrar": {
      await limitarTentativas(ipCliente(req), normalizarEmail(corpo.email));
      const conta = await verificarCredenciais(corpo.email, corpo.senha);
      await abrirSessao(req, res, conta);
      return responder(res, 200, { conta: { email: conta.email } });
    }
    case "sair":
      await encerrarSessao(req, res);
      return responder(res, 200, { ok: true });
    default:
      throw new ErroHttp(400, "acao-invalida");
  }
});
