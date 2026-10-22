// Verificações específicas por página, executadas no navegador pelo
// dev/testar-navegador.mjs. Cada `codigo` é o corpo de uma função assíncrona
// que deve retornar `true`; qualquer outro valor é exibido como falha.

const esperar = (ms) => `await new Promise((r) => setTimeout(r, ${ms}));`;
const clicar = (seletor) => `document.querySelector(${JSON.stringify(seletor)}).click();`;

export const VERIFICACOES = {
  "/": [
    {
      nome: "tela cheia com um clique: só o relógio, e o botão sai",
      codigo: `
        const botao = document.querySelector("#botaoTelaCheia");
        botao.click();
        for (let i = 0; i < 20 && !document.body.classList.contains("inicio-tela-cheia"); i += 1) ${esperar(100)}
        const entrou = document.body.classList.contains("inicio-tela-cheia") && getComputedStyle(document.querySelector(".cabecalho")).display === "none" && botao.getAttribute("aria-pressed") === "true";
        const api = Boolean(document.fullscreenElement);
        botao.click();
        for (let i = 0; i < 20 && document.body.classList.contains("inicio-tela-cheia"); i += 1) ${esperar(100)}
        const saiu = !document.body.classList.contains("inicio-tela-cheia") && !document.fullscreenElement && getComputedStyle(document.querySelector(".cabecalho")).display !== "none";
        return (entrou && saiu) || { entrou, api, saiu };`,
    },
    {
      nome: "resumo do clima leva à página do clima",
      codigo: `const a = document.querySelector("#climaInicio"); return (a && new URL(a.href).pathname === "/clima") || a?.href;`,
    },
    {
      nome: "relógio sincroniza com /api/hora",
      codigo: `${esperar(1200)} const t = document.querySelector("#seloSync").textContent; return t.includes("Sincronizado") || t;`,
    },
    {
      nome: "hora exibida no formato HH:MM:SS",
      codigo: `return /^\\d{2}:\\d{2}:\\d{2}$/.test(document.querySelector("#hora").textContent) || document.querySelector("#hora").textContent;`,
    },
    {
      nome: "hora exibida bate com o servidor (±2 s)",
      codigo: `
        const r = await fetch("/api/hora", { cache: "no-store" });
        const { timestamp } = await r.json();
        const f = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
        const exibida = document.querySelector("#hora").textContent;
        const candidatos = [-2000, -1000, 0, 1000, 2000].map((d) => f.format(new Date(timestamp + d)));
        return candidatos.includes(exibida) || { exibida, servidor: f.format(new Date(timestamp)) };`,
    },
    {
      nome: "API de horário responde com no-store",
      codigo: `const r = await fetch("/api/hora", { cache: "no-store" }); return (r.headers.get("cache-control") || "").includes("no-store") || r.headers.get("cache-control");`,
    },
    {
      nome: "API recusa POST com 405",
      codigo: `const r = await fetch("/api/hora", { method: "POST" }); return r.status === 405 || r.status;`,
    },
    {
      nome: "hora no fuso do aparelho; Brasília aparece só quando o horário difere",
      codigo: `
        const f = (tz) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
        const fusoLocal = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const mesmoHorario = f(fusoLocal) === f("America/Sao_Paulo");
        const linha = document.querySelector("#outroFuso");
        const lugar = document.querySelector("#nomeFuso").textContent;
        return (mesmoHorario ? linha.hidden : !linha.hidden && linha.textContent.startsWith("Brasília:")) && lugar.length > 1 || { fusoLocal, oculto: linha.hidden, texto: linha.textContent, lugar };`,
    },
    {
      nome: "detalhes técnicos ficam no diálogo, não na página",
      codigo: `
        const linhaOculta = document.querySelector("#detalheSync").hidden;
        const naPagina = document.querySelector("main").innerText.includes("Latência");
        document.querySelector("#botaoDetalhes").click();
        const dialogo = document.querySelector("dialog[open]");
        const noDialogo = !!dialogo && dialogo.textContent.includes("Latência");
        dialogo?.close();
        return (linhaOculta && !naPagina && noDialogo) || { linhaOculta, naPagina, noDialogo };`,
    },
    {
      nome: "sem atalhos espalhados; menu com todas as ferramentas e escolha de fuso",
      codigo: `
        const icones = document.querySelectorAll("main nav a, .atalhos-inicio").length;
        document.querySelector("[data-abrir-ferramentas]").click();
        const aberto = !document.querySelector("#painelFerramentas").hidden;
        const todas = document.querySelectorAll("#painelFerramentas a").length;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        document.querySelector("#botaoFuso").click();
        const select = document.querySelector("dialog[open] #selectFusoInicio");
        select.value = "toquio";
        [...document.querySelectorAll("dialog[open] .botao--primario")].pop().click();
        await new Promise((r) => setTimeout(r, 1100));
        const lugar = document.querySelector("#nomeFuso").textContent;
        const salvo = JSON.parse(localStorage.getItem("bt:fuso"));
        const brasilia = !document.querySelector("#outroFuso").hidden;
        document.querySelector("#botaoFuso").click();
        document.querySelector("dialog[open] #selectFusoInicio").value = "";
        [...document.querySelectorAll("dialog[open] .botao--primario")].pop().click();
        const limpo = localStorage.getItem("bt:fuso") === null;
        return (icones === 0 && aberto && todas >= 14 && lugar === "Tóquio" && salvo.fuso === "Asia/Tokyo" && brasilia && limpo) || { icones, aberto, todas, lugar, salvo, brasilia, limpo };`,
    },
    {
      nome: "alternar para analógico",
      codigo: `${clicar("#botaoModo")} ${esperar(1100)}
        const ok = !document.querySelector("#visorAnalogico").hidden && document.querySelector(".analogico__ponteiro--segundo").getAttribute("transform");
        ${clicar("#botaoModo")} return Boolean(ok) || "ponteiros sem transform";`,
    },
    {
      nome: "painel de ferramentas abre e fecha",
      codigo: `${clicar("#botaoMenu")} const aberto = !document.querySelector("#painelFerramentas").hidden;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        return (aberto && document.querySelector("#painelFerramentas").hidden) || "painel não alternou";`,
    },
    {
      nome: "tema escuro alterna",
      // Sem escolha salva, a página abre no tema do sistema: compara com o inicial.
      codigo: `const inicial = document.documentElement.dataset.theme; ${clicar("#botaoTema")} const trocado = document.documentElement.dataset.theme; ${clicar("#botaoTema")}
        return (trocado !== inicial && ["dark", "light"].includes(trocado) && document.documentElement.dataset.theme === inicial) || "tema não alternou";`,
    },
    {
      nome: "próximo feriado é do país do fuso (como no calendário)",
      codigo: `
        const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const quando = () => document.querySelector("#faltaProximoFeriado").textContent;
        if (fuso !== "Europe/Paris") return true;
        for (let i = 0; i < 60 && !quando().includes("França"); i += 1) ${esperar(150)}
        const nome = document.querySelector("#tituloProximoFeriado").textContent;
        const href = new URL(document.querySelector(".proximo-feriado").href).pathname + new URL(document.querySelector(".proximo-feriado").href).search;
        return (quando().includes("França") && nome !== "Finados" && href === "/calendario?pais=FR") || { nome, quando: quando(), href };`,
    },
    {
      nome: "próximo feriado preenchido",
      codigo: `const t = document.querySelector("#tituloProximoFeriado").textContent; return t !== "—" || t;`,
    },
  ],
  "/relogio-mundial": [
    {
      nome: "lista inicial pequena: cidade do seu fuso primeiro, com Brasília",
      codigo: `
        localStorage.removeItem("bt:mundial:cidades");
        document.querySelector("#botaoRestaurar").click();
        const cidades = [...document.querySelectorAll("#listaCidades .cidade")];
        const nomes = cidades.map((c) => c.querySelector(".cidade__nome").textContent);
        const primeira = cidades[0]?.querySelector(".cidade__info").textContent ?? "";
        const ok = nomes.length >= 3 && nomes.length <= 4 && nomes.includes("Brasília") && primeira.includes("seu fuso") && new Set(nomes).size === nomes.length;
        return ok || { nomes, primeira };`,
    },
    {
      nome: "horas das cidades no formato HH:MM:SS",
      codigo: `${esperar(1100)} const h = [...document.querySelectorAll("#listaCidades .visor")].map((e) => e.textContent); return h.every((t) => /^\\d{2}:\\d{2}:\\d{2}$/.test(t)) || h;`,
    },
    {
      nome: "adicionar cidade persiste e remover tira da lista",
      codigo: `
        const select = document.querySelector("#selectCidade");
        select.value = "paris";
        document.querySelector("#formAdicionar").requestSubmit();
        const salvo = JSON.parse(localStorage.getItem("bt:mundial:cidades"));
        const antes = salvo.length - 1;
        const adicionou = document.querySelectorAll("#listaCidades .cidade").length === antes + 1 && salvo.includes("paris");
        const semDuplicata = ![...select.options].some((o) => o.value === "paris");
        document.querySelector('[aria-label="Remover Paris"]').click();
        const removeu = document.querySelectorAll("#listaCidades .cidade").length === antes && !JSON.parse(localStorage.getItem("bt:mundial:cidades")).includes("paris");
        return (adicionou && semDuplicata && removeu) || { adicionou, semDuplicata, removeu };`,
    },
    {
      nome: "Tóquio 12 h à frente do fuso do usuário (Brasília na máquina de teste)",
      codigo: `
        const select = document.querySelector("#selectCidade");
        select.value = "toquio";
        document.querySelector("#formAdicionar").requestSubmit();
        const t = [...document.querySelectorAll("#listaCidades .cidade")].find((c) => c.textContent.includes("Tóquio")).textContent;
        document.querySelector('[aria-label="Remover Tóquio"]').click();
        const sp = Intl.DateTimeFormat().resolvedOptions().timeZone === "America/Sao_Paulo";
        return !sp || t.includes("+12 h em relação a você") || t;`,
    },
    {
      nome: "atalho adiciona os fusos do Brasil sem duplicar",
      codigo: `
        const n0 = document.querySelectorAll("#listaCidades .cidade").length;
        document.querySelector("#botaoFusosBrasil").click();
        document.querySelector("#botaoFusosBrasil").click();
        const nomes = [...document.querySelectorAll("#listaCidades .cidade__nome")].map((e) => e.textContent);
        const ok = nomes.length === n0 + 3 && ["Fernando de Noronha", "Manaus", "Rio Branco"].every((n) => nomes.includes(n));
        const acre = [...document.querySelectorAll("#listaCidades .cidade")].find((c) => c.textContent.includes("Rio Branco")).textContent;
        document.querySelector("#botaoRestaurar").click();
        const sp = Intl.DateTimeFormat().resolvedOptions().timeZone === "America/Sao_Paulo";
        return (ok && (!sp || acre.includes("−2 h em relação a você"))) || { nomes, acre };`,
    },
  ],
  "/conversor": [
    {
      nome: "São Paulo 12:00 → Lisboa 16:00 e Tóquio 00:00 do dia seguinte",
      codigo: `
        const definir = (id, valor, evento) => { const c = document.querySelector(id); c.value = valor; c.dispatchEvent(new Event(evento, { bubbles: true })); };
        definir("#origem", "sao-paulo", "change");
        definir("#destino", "lisboa", "change");
        definir("#data", "2026-07-01", "input");
        definir("#hora", "12:00", "input");
        const lisboa = document.querySelector("#resultado .resultado-grande").textContent;
        definir("#destino", "toquio", "change");
        const toquio = document.querySelector("#resultado .resultado-grande").textContent;
        const seguinte = document.querySelector("#resultado").textContent.includes("dia seguinte");
        return (lisboa === "16:00" && toquio === "00:00" && seguinte) || { lisboa, toquio, seguinte };`,
    },
    {
      nome: "hora ambígua em Lisboa oferece duas ocorrências",
      codigo: `
        const definir = (id, valor, evento) => { const c = document.querySelector(id); c.value = valor; c.dispatchEvent(new Event(evento, { bubbles: true })); };
        definir("#origem", "lisboa", "change");
        definir("#destino", "brasilia", "change");
        definir("#data", "2026-10-25", "input");
        definir("#hora", "01:30", "input");
        const radios = document.querySelectorAll("#escolhaAmbigua input[type=radio]");
        const primeira = document.querySelector("#resultado .resultado-grande").textContent;
        radios[1].click();
        const segunda = document.querySelector("#resultado .resultado-grande").textContent;
        return (!document.querySelector("#escolhaAmbigua").hidden && radios.length === 2 && primeira === "21:30" && segunda === "22:30") || { n: radios.length, primeira, segunda };`,
    },
    {
      nome: "hora inexistente em Lisboa é explicada",
      codigo: `
        const definir = (id, valor, evento) => { const c = document.querySelector(id); c.value = valor; c.dispatchEvent(new Event(evento, { bubbles: true })); };
        definir("#data", "2026-03-29", "input");
        definir("#hora", "01:30", "input");
        const t = document.querySelector("#resultado").textContent;
        return (t.includes("não existe") && document.querySelector("#resultado .resultado-grande").textContent === "22:30") || t;`,
    },
    {
      nome: "fuso IANA personalizado é validado",
      codigo: `
        const definir = (id, valor, evento) => { const c = document.querySelector(id); c.value = valor; c.dispatchEvent(new Event(evento, { bubbles: true })); };
        definir("#destino", "__iana", "change");
        definir("#destinoIana", "Marte/Base", "input");
        const invalido = !document.querySelector("#destinoIanaErro").hidden;
        definir("#destinoIana", "Asia/Kolkata", "input");
        const valido = document.querySelector("#destinoIanaErro").hidden && document.querySelector("#resultado .resultado-grande") !== null;
        definir("#destino", "lisboa", "change");
        return (invalido && valido) || { invalido, valido };`,
    },
    {
      nome: "planejador mostra três cidades e janela em comum",
      codigo: `
        const d = document.querySelector("#dataReuniao"); d.value = "2026-07-01"; d.dispatchEvent(new Event("input"));
        const linhas = document.querySelectorAll("#tabelaReuniao tr").length;
        const resumo = document.querySelector("#resumoReuniao").textContent;
        return (linhas === 4 && resumo.includes("10h–14h")) || { linhas, resumo };`,
    },
  ],
  "/clima": [
    {
      nome: "sem lugar salvo (servidor local, sem IP): pede uma cidade",
      codigo: `${esperar(600)} return (!document.querySelector("#semLugar").hidden && document.querySelector("#painelClima").hidden) || "estado inesperado";`,
    },
    {
      nome: "busca de cidade lista homônimas com estado e país",
      codigo: `
        const campo = document.querySelector("#campoBusca");
        campo.value = "Springfield";
        document.querySelector("#formBusca").requestSubmit();
        for (let i = 0; i < 40 && document.querySelector("#resultadosBusca").hidden; i += 1) ${esperar(250)}
        const itens = [...document.querySelectorAll(".resultado-busca")].map((b) => b.textContent);
        const homonimas = itens.filter((x) => x.startsWith("Springfield"));
        return (homonimas.length >= 3 && new Set(homonimas).size === homonimas.length) || itens;`,
    },
    {
      nome: "escolher cidade carrega atual, 48 horas, dias e detalhes com os dados da API",
      codigo: `
        const campo = document.querySelector("#campoBusca");
        campo.value = "Umuarama";
        document.querySelector("#formBusca").requestSubmit();
        for (let i = 0; i < 40 && !document.querySelector(".resultado-busca strong")?.textContent.includes("Umuarama"); i += 1) ${esperar(250)}
        document.querySelector(".resultado-busca").click();
        for (let i = 0; i < 60 && !document.querySelector(".coluna-hora"); i += 1) ${esperar(250)}
        const salvo = JSON.parse(localStorage.getItem("bt:clima:previsao"));
        const a = salvo.dados.atual;
        const temp = document.querySelector("#tempAgora").textContent;
        const horas = document.querySelectorAll(".coluna-hora").length;
        const primeira = document.querySelector(".coluna-hora").getAttribute("aria-label");
        const dias = document.querySelectorAll(".dia-clima").length;
        const diasApi = salvo.dados.dias.time.length - salvo.dados.dias.time.indexOf(a.time.slice(0, 10));
        const detalhes = document.querySelectorAll(".clima-detalhes__item").length;
        const titulo = document.querySelector("#tituloLugar").textContent;
        const ok = temp === Math.round(a.temperature_2m) + "°" && horas === 48 && dias === diasApi && dias >= 7 && detalhes >= 8 && titulo === "Umuarama" && primeira.startsWith("Agora");
        return ok || { temp, api: a.temperature_2m, horas, dias, diasApi, detalhes, titulo, primeira };`,
    },
    {
      nome: "tema do painel segue a condição real e o dia/noite do lugar",
      codigo: `
        const a = JSON.parse(localStorage.getItem("bt:clima:previsao")).dados.atual;
        const c = a.weather_code;
        const esperado = c === 0 || c === 1 ? "limpo" : c === 2 ? "parcial" : c === 3 ? "nublado" : c < 50 ? "neblina" : c >= 95 ? "tempestade" : [71, 73, 75, 77, 85, 86].includes(c) ? "neve" : "chuva";
        const s = document.querySelector("#agora");
        return (s.dataset.tema === esperado && s.dataset.periodo === (a.is_day ? "dia" : "noite")) || { tema: s.dataset.tema, esperado, periodo: s.dataset.periodo, is_day: a.is_day };`,
    },
    {
      nome: "horários no fuso do lugar (hora local e coluna \"Agora\")",
      codigo: `
        const d = JSON.parse(localStorage.getItem("bt:clima:previsao")).dados;
        const local = new Intl.DateTimeFormat("en-GB", { timeZone: d.fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
        const exibida = document.querySelector("#horaLocal").textContent;
        const [h, m] = local.split(":").map(Number); const [eh, em] = exibida.split(":").map(Number);
        const diferenca = Math.abs(h * 60 + m - (eh * 60 + em));
        return (diferenca <= 1 || diferenca >= 1439) || { local, exibida, fuso: d.fuso };`,
    },
    {
      nome: "abrir um dia mostra os detalhes; chuva tem resumo",
      codigo: `
        const dia = document.querySelectorAll(".dia-clima")[1];
        dia.querySelector("summary").click();
        const linhas = dia.querySelectorAll(".lista-dados > div").length;
        const chuva = document.querySelector("#resumoChuva").textContent.trim();
        return (dia.open && linhas >= 5 && chuva.length > 10) || { aberto: dia.open, linhas, chuva };`,
    },
    {
      nome: "falha da API mantém os últimos dados e avisa",
      codigo: `
        // Previsão salva "vencida" e a consulta nova falhando: escolher a mesma
        // cidade de novo deve mostrar a cópia salva com o aviso.
        const original = window.fetch;
        window.fetch = (url, ...r) => String(url).startsWith("/api/clima?lat=") ? Promise.reject(new TypeError("rede")) : original(url, ...r);
        const salvo = JSON.parse(localStorage.getItem("bt:clima:previsao"));
        salvo.recebidoEm -= 11 * 60 * 1000;
        localStorage.setItem("bt:clima:previsao", JSON.stringify(salvo));
        document.querySelector("#campoBusca").value = "Umuarama";
        document.querySelector("#formBusca").requestSubmit();
        for (let i = 0; i < 40 && document.querySelector("#resultadosBusca").hidden; i += 1) ${esperar(250)}
        document.querySelector(".resultado-busca").click();
        ${esperar(800)}
        window.fetch = original;
        const estado = document.querySelector("#estadoDados").textContent;
        const temp = document.querySelector("#tempAgora").textContent;
        return (/desatualizados/.test(estado) && /\\d°$/.test(temp) && !!document.querySelector("#estadoDados button")) || { estado, temp };`,
    },
  ],
  "/cronometro": [
    {
      nome: "iniciar, voltas, melhor/pior e diferença",
      codigo: `
        localStorage.removeItem("bt:cronometro");
        document.querySelector("#botaoIniciar").click();
        ${esperar(400)} document.querySelector("#botaoVolta").click();
        ${esperar(150)} document.querySelector("#botaoVolta").click();
        ${esperar(300)} document.querySelector("#botaoVolta").click();
        const linhas = [...document.querySelectorAll("#corpoVoltas tr")];
        const textos = linhas.map((l) => l.textContent);
        const melhor = linhas.some((l) => l.textContent.includes("Melhor"));
        const pior = linhas.some((l) => l.textContent.includes("Pior"));
        const diferenca = /[+−]\\d+,\\d{2} s/.test(textos[0]);
        const rodando = document.querySelector("#estado").textContent === "Rodando";
        return (linhas.length === 3 && melhor && pior && diferenca && rodando) || { n: linhas.length, melhor, pior, diferenca, textos };`,
    },
    {
      nome: "pausar congela o visor e o título mostra o tempo",
      codigo: `
        document.querySelector("#botaoIniciar").click();
        const a = document.querySelector("#visor").textContent;
        ${esperar(250)}
        const b = document.querySelector("#visor").textContent;
        const estado = document.querySelector("#estado").textContent;
        return (a === b && estado === "Pausado" && document.title.startsWith("00:0")) || { a, b, estado, titulo: document.title };`,
    },
    {
      nome: "estado salvo e restaurável (pausado e rodando)",
      codigo: `
        const { Cronometro } = await import("/scripts/nucleo/medidores.js");
        const pausado = JSON.parse(localStorage.getItem("bt:cronometro"));
        const r1 = Cronometro.restaurar(pausado);
        const okPausado = pausado.status === "pausado" && r1.voltas.length === 3 && r1.decorrido() === pausado.acumuladoMs;
        document.querySelector("#botaoIniciar").click();
        const rodando = JSON.parse(localStorage.getItem("bt:cronometro"));
        const r2 = Cronometro.restaurar(rodando, { epochAgora: () => rodando.inicioEpoch + 5000 });
        const okRodando = rodando.status === "rodando" && r2.rodando && Math.abs(r2.decorrido() - (rodando.acumuladoMs + 5000)) < 50;
        document.querySelector("#botaoIniciar").click();
        return (okPausado && okRodando) || { pausado, rodando };`,
    },
    {
      nome: "CSV com BOM, cabeçalho e uma linha por volta",
      codigo: `
        const { csvVoltas } = await import("/scripts/nucleo/voltas.js");
        const dados = JSON.parse(localStorage.getItem("bt:cronometro"));
        const csv = csvVoltas(dados.voltas, dados.acumuladoMs);
        const linhas = csv.slice(1).trim().split("\\r\\n");
        document.querySelector("#botaoCsv").click();
        return (csv.charCodeAt(0) === 0xfeff && linhas[0].startsWith("Volta;Tempo da volta") && linhas.length === 5 && !document.querySelector("#botaoCsv").disabled) || linhas;`,
    },
    {
      nome: "zerar pede confirmação e limpa voltas",
      codigo: `
        document.querySelector("#botaoZerar").click();
        ${esperar(100)}
        const dialogo = document.querySelector("dialog[open]");
        if (!dialogo) return "sem diálogo de confirmação";
        dialogo.querySelector(".botao--perigo").click();
        ${esperar(100)}
        const visor = document.querySelector("#visor").textContent;
        const voltas = document.querySelectorAll("#corpoVoltas tr").length;
        return (visor === "00:00,00" && voltas === 0 && document.querySelector("#secaoVoltas").hidden) || { visor, voltas };`,
    },
    {
      nome: "atalho Espaço inicia e pausa; L registra volta",
      codigo: `
        const tecla = (key) => document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        tecla(" "); ${esperar(200)} tecla("l");
        const rodando = document.querySelector("#estado").textContent === "Rodando";
        const voltas = document.querySelectorAll("#corpoVoltas tr").length;
        tecla(" ");
        const pausado = document.querySelector("#estado").textContent === "Pausado";
        localStorage.removeItem("bt:cronometro");
        return (rodando && voltas === 1 && pausado) || { rodando, voltas, pausado };`,
    },
  ],
  "/temporizador": [
    {
      nome: "contagem de 2 s: título, pausa/continuação e alarme ao fim",
      codigo: `
        const definir = (id, v) => { const c = document.querySelector(id); c.value = v; c.dispatchEvent(new Event("input", { bubbles: true })); };
        definir("#horas", "0"); definir("#minutos", "0"); definir("#segundos", "2");
        document.querySelector("#botaoIniciar").click();
        ${esperar(400)}
        const titulo = document.title;
        document.querySelector("#botaoIniciar").click();
        const pausado = document.querySelector("#estado").textContent === "Pausado";
        const visorPausado = document.querySelector("#visor").textContent;
        ${esperar(600)}
        const congelado = document.querySelector("#visor").textContent === visorPausado;
        document.querySelector("#botaoIniciar").click();
        ${esperar(2300)}
        const dialogo = document.querySelector("dialog.dialogo--alarme[open]");
        const fim = document.querySelector("#estado").textContent;
        const tituloFim = document.title;
        dialogo?.querySelector(".botao--primario").click();
        ${esperar(100)}
        const fechou = !document.querySelector("dialog.dialogo--alarme[open]");
        return (titulo.startsWith("00:02") && pausado && congelado && Boolean(dialogo) && fim === "Tempo esgotado" && tituloFim.startsWith("Tempo esgotado") && fechou)
          || { titulo, pausado, congelado, dialogo: Boolean(dialogo), fim, tituloFim, fechou };`,
    },
    {
      nome: "estado e preferências persistidos",
      codigo: `
        const estado = JSON.parse(localStorage.getItem("bt:temporizador:estado"));
        const som = document.querySelector("#som");
        som.value = "sino"; som.dispatchEvent(new Event("change"));
        const config = JSON.parse(localStorage.getItem("bt:temporizador:config"));
        som.value = "bipe"; som.dispatchEvent(new Event("change"));
        return (estado.status === "concluido" && estado.duracaoMs === 2000 && config.som === "sino") || { estado, config };`,
    },
    {
      nome: "contagem que terminou com a página fechada é restaurada como concluída",
      codigo: `
        const { ContagemRegressiva } = await import("/scripts/nucleo/medidores.js");
        const fimEpoch = Date.now() - 60000;
        const c = ContagemRegressiva.restaurar({ status: "rodando", duracaoMs: 300000, restanteMs: 300000, fimEpoch });
        const ainda = ContagemRegressiva.restaurar({ status: "rodando", duracaoMs: 300000, restanteMs: 300000, fimEpoch: Date.now() + 120000 });
        return (c.status === "concluido" && c.terminouEm === fimEpoch && ainda.rodando && ainda.restante() > 110000) || { s: c.status, t: c.terminouEm };`,
    },
    {
      nome: "+1 min como soneca, reiniciar, presets e estados de notificação/tela",
      codigo: `
        document.querySelector("#botaoMaisUm").click();
        const soneca = document.querySelector("#estado").textContent === "Rodando" && document.querySelector("#visor").textContent === "01:00";
        document.querySelector("#botaoReiniciar").click();
        const reiniciou = document.querySelector("#estado").textContent === "Pronto";
        document.querySelector("[data-preset='300']").click();
        const preset = document.querySelector("#visor").textContent === "05:00";
        const notif = document.querySelector("#estadoNotificacao").textContent.trim().length > 10;
        const tela = document.querySelector("#estadoTela").textContent.trim().length > 10;
        localStorage.removeItem("bt:temporizador:estado");
        return (soneca && reiniciou && preset && notif && tela) || { soneca, reiniciou, preset, notif, tela, visor: document.querySelector("#visor").textContent };`,
    },
  ],
  "/pomodoro": [
    {
      nome: "pular avança foco → pausa curta → foco e conta o ciclo",
      codigo: `
        const fase = () => document.querySelector("[data-fase][aria-pressed='true']").dataset.fase;
        const inicial = fase();
        document.querySelector("#botaoPular").click(); ${esperar(50)}
        const depois = fase();
        const visorPausa = document.querySelector("#visor").textContent;
        document.querySelector("#botaoPular").click(); ${esperar(50)}
        const volta = fase();
        const salvo = JSON.parse(localStorage.getItem("bt:pomodoro:estado"));
        const rotulo = document.querySelector("#rotulo").textContent;
        return (inicial === "foco" && depois === "curta" && visorPausa === "05:00" && volta === "foco" && salvo.focosConcluidos === 1 && rotulo.includes("ciclo 2 de 4"))
          || { inicial, depois, visorPausa, volta, salvo, rotulo };`,
    },
    {
      nome: "iniciar mostra a etapa no título; pausar mantém",
      codigo: `
        document.querySelector("#botaoIniciar").click();
        ${esperar(1100)}
        const titulo = document.title;
        document.querySelector("#botaoIniciar").click();
        const pausado = document.querySelector("#rotulo").textContent.includes("pausado");
        const salvo = JSON.parse(localStorage.getItem("bt:pomodoro:estado"));
        return (titulo.includes("Foco") && /^2[45]:\\d{2}/.test(titulo) && pausado && salvo.contagem.status === "pausado") || { titulo, pausado, salvo };`,
    },
    {
      nome: "ajustes alteram a duração da etapa que ainda não começou",
      codigo: `
        document.querySelector("#botaoReiniciar").click(); ${esperar(50)}
        const foco = document.querySelector("#cfgFoco");
        foco.value = "50"; foco.dispatchEvent(new Event("change"));
        const visor = document.querySelector("#visor").textContent;
        const config = JSON.parse(localStorage.getItem("bt:pomodoro:config"));
        foco.value = "25"; foco.dispatchEvent(new Event("change"));
        localStorage.removeItem("bt:pomodoro:estado");
        return (visor === "50:00" && config.foco === 50 && document.querySelector("#marcadoresCiclo").children.length === 4) || { visor, config };`,
    },
  ],
  "/feriados": [
    {
      nome: "lista nacional com feriados e facultativos separados",
      codigo: `
        localStorage.removeItem("bt:feriados:selecao");
        const uf = document.querySelector("#selectUf"); uf.value = ""; uf.dispatchEvent(new Event("change"));
        const fichas = [...document.querySelectorAll("#filtros .ficha")].map((f) => f.textContent.replace(/\\s+/g, " ").trim());
        const itens = document.querySelectorAll("#listaMeses .evento").length;
        return (itens > 15 && fichas.some((f) => /^Pontos facultativos \\d+$/.test(f)) && fichas.some((f) => /^Feriados \\d+$/.test(f))) || { itens, fichas };`,
    },
    {
      nome: "trocar UF para SP inclui 09/07 e habilita a capital",
      codigo: `
        const uf = document.querySelector("#selectUf"); uf.value = "SP"; uf.dispatchEvent(new Event("change"));
        const temSp = document.querySelector("#listaMeses").textContent.includes("Revolução Constitucionalista");
        const mun = document.querySelector("#selectMunicipio");
        const habilitado = !mun.disabled;
        mun.value = "São Paulo"; mun.dispatchEvent(new Event("change"));
        const temCapital = document.querySelector("#listaMeses").textContent.includes("Aniversário da Cidade de São Paulo");
        const salvo = JSON.parse(localStorage.getItem("bt:feriados:selecao"));
        return (temSp && habilitado && temCapital && salvo.uf === "SP" && salvo.municipio === "São Paulo" && location.search.includes("uf=SP")) || { temSp, habilitado, temCapital, salvo, busca: location.search };`,
    },
    {
      nome: "UF sem dados municipais desabilita município",
      codigo: `
        const uf = document.querySelector("#selectUf"); uf.value = "GO"; uf.dispatchEvent(new Event("change"));
        const ok = document.querySelector("#selectMunicipio").disabled && document.querySelector("#textoCobertura").textContent.includes("Goiânia");
        uf.value = ""; uf.dispatchEvent(new Event("change"));
        return ok || document.querySelector("#textoCobertura").textContent;`,
    },
    {
      nome: "filtro de pontos facultativos mostra só facultativos",
      codigo: `
        document.querySelector('#filtros [data-filtro="facultativos"]').click();
        const selos = [...document.querySelectorAll("#listaMeses .evento .selo:not(.selo--sem-ponto)")].map((s) => s.textContent);
        const ok = selos.length > 0 && selos.every((t) => t === "Ponto facultativo") && document.querySelector('#filtros [data-filtro="facultativos"]').getAttribute("aria-pressed") === "true";
        document.querySelector('#filtros [data-filtro="todos"]').click();
        return ok || selos;`,
    },
    {
      nome: "navegar de ano atualiza título e URL",
      codigo: `
        const antes = Number(document.querySelector("#anoAtual").textContent);
        document.querySelector("#anoProximo").click();
        const depois = Number(document.querySelector("#anoAtual").textContent);
        const ok = depois === antes + 1 && document.querySelector("#tituloAno").textContent === "Feriados de " + depois && location.search.includes("ano=" + depois);
        document.querySelector("#anoAnterior").click();
        return ok || { antes, depois, busca: location.search };`,
    },
    {
      nome: "exportar ano gera arquivo .ics válido",
      codigo: `
        const original = URL.createObjectURL; let blob = null;
        URL.createObjectURL = (b) => { blob = b; return original.call(URL, b); };
        document.querySelector("#botaoExportar").click();
        URL.createObjectURL = original;
        const texto = blob ? await blob.text() : "";
        return (texto.startsWith("BEGIN:VCALENDAR\\r\\n") && texto.includes("DTSTART;VALUE=DATE:") && blob.type.startsWith("text/calendar")) || texto.slice(0, 80);`,
    },
    {
      nome: "próximo feriado e emenda de Tiradentes",
      codigo: `
        const uf = document.querySelector("#selectUf"); uf.value = ""; uf.dispatchEvent(new Event("change"));
        const proximo = document.querySelector("#tituloProximo").textContent;
        const lista = document.querySelector("#listaMeses").textContent;
        const ano = document.querySelector("#anoAtual").textContent;
        const emenda = ano !== "2026" || lista.includes("Emenda possível: segunda-feira 20/04 → 4 dias");
        return (proximo !== "—" && emenda) || { proximo, emenda };`,
    },
    {
      nome: "calendário lateral: clique em dia mostra detalhes",
      codigo: `
        const celula = [...document.querySelectorAll("#areaCalendario [role=gridcell]")].find((c) => !c.classList.contains("calendario__dia--fora"));
        celula.click();
        return (celula.getAttribute("aria-selected") === "true" && document.querySelector("#tituloDia").textContent.length > 10) || document.querySelector("#tituloDia").textContent;`,
    },
  ],
  "/calendario": [
    {
      nome: "outro país: feriados da API marcados e nomeados; voltar ao Brasil",
      codigo: `
        const select = document.querySelector("#selectPais");
        for (let i = 0; i < 100 && !select.querySelector("option[value=DE]"); i += 1) ${esperar(150)}
        select.value = "DE"; select.dispatchEvent(new Event("change"));
        for (let i = 0; i < 100 && !document.querySelector(".calendario__dia--feriado"); i += 1) ${esperar(150)}
        const ano = Number(document.querySelector(".calendario__titulo").textContent);
        const anoNovo = document.querySelector("[data-juliano]:not(.calendario__dia--fora)")?.getAttribute("aria-label") ?? "";
        const feriados = document.querySelectorAll(".calendario__dia--feriado").length;
        const regionais = document.querySelectorAll(".calendario__dia--regional").length;
        const ufOculta = document.querySelector("#selectUf").closest("label").hidden;
        const fonte = document.querySelector("#estadoFeriados").textContent;
        select.value = "BR"; select.dispatchEvent(new Event("change"));
        const brasil = !document.querySelector("#selectUf").closest("label").hidden && document.querySelector("#estadoFeriados").hidden;
        const ok = feriados >= 8 && regionais >= 1 && /Neujahr/.test(anoNovo) && ufOculta && fonte.includes("Nager.Date") && brasil && ano > 2000;
        return ok || { feriados, regionais, anoNovo, ufOculta, fonte, brasil };`,
    },
    {
      nome: "feriado de outro país fica na data civil certa (sem efeito de fuso)",
      codigo: `
        const select = document.querySelector("#selectPais");
        select.value = "JP"; select.dispatchEvent(new Event("change"));
        for (let i = 0; i < 100 && !document.querySelector(".calendario__dia--feriado"); i += 1) ${esperar(150)}
        const ano = document.querySelector(".calendario__titulo").textContent;
        const r = await fetch("/api/feriados?pais=JP&ano=" + ano).then((x) => x.json());
        const primeiro = r.feriados[0];
        const [a, m, d] = primeiro.data.split("-").map(Number);
        const rotulo = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, d)));
        const celula = [...document.querySelectorAll("[data-juliano]")].find((c) => c.getAttribute("aria-label").includes(primeiro.nome));
        select.value = "BR"; select.dispatchEvent(new Event("change"));
        return (celula && celula.getAttribute("aria-label").includes(rotulo)) || { rotulo, celula: celula?.getAttribute("aria-label") };`,
    },
    {
      nome: "abre na visão anual com 12 meses e hoje selecionado",
      codigo: `
        const cal = document.querySelector(".calendario");
        const hoje = document.querySelector(".calendario__dia--hoje");
        const meses = document.querySelectorAll(".calendario__mes").length;
        const linhasOk = [...document.querySelectorAll("[role=grid] [role=row]")].every((l) => l.children.length === 7);
        return (cal.dataset.visao === "ano" && meses === 12 && hoje && hoje.getAttribute("aria-selected") === "true" && hoje.tabIndex === 0 && hoje.getAttribute("aria-label").includes("hoje") && linhasOk) || { visao: cal.dataset.visao, meses, hoje: !!hoje, linhasOk };`,
    },
    {
      nome: "teclado: setas, PageDown e Home",
      codigo: `
        const tecla = (key) => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        document.querySelector(".calendario__dia--hoje").focus();
        const inicio = Number(document.activeElement.dataset.juliano);
        tecla("ArrowRight"); const direita = Number(document.activeElement.dataset.juliano);
        tecla("ArrowDown"); const baixo = Number(document.activeElement.dataset.juliano);
        const titulo1 = document.querySelector(".calendario__titulo").textContent;
        tecla("PageDown"); const titulo2 = document.querySelector(".calendario__titulo").textContent;
        tecla("Home"); const volta = Number(document.activeElement.dataset.juliano);
        return (direita === inicio + 1 && baixo === inicio + 8 && titulo1 !== titulo2 && volta === inicio) || { inicio, direita, baixo, titulo1, titulo2, volta };`,
    },
    {
      nome: "trocar entre ano, mês e semana preserva a data",
      codigo: `
        const sel = () => Number(document.querySelector("[role=gridcell][aria-selected=true]").dataset.juliano);
        const hoje = Number(document.querySelector(".calendario__dia--hoje").dataset.juliano);
        document.querySelector("[data-juliano='" + (hoje + 3) + "']").click();
        document.querySelector('[data-visao="mes"]').click();
        const noMes = sel();
        const temSetaMes = !!document.querySelector('[aria-label="Próximo mês"]');
        document.querySelector('[data-visao="semana"]').click();
        const naSemana = sel();
        const diasSemana = document.querySelectorAll(".calendario__linha--semana [role=gridcell]").length;
        document.querySelector('[data-visao="ano"]').click();
        const noAno = sel();
        const salvo = JSON.parse(localStorage.getItem("bt:calendario:visao"));
        const dados = document.querySelector("#dadosDia").textContent;
        return (noMes === hoje + 3 && naSemana === hoje + 3 && noAno === hoje + 3 && temSetaMes && diasSemana === 7 && salvo === "ano" && dados.includes("Semana (ISO 8601)")) || { noMes, naSemana, noAno, temSetaMes, diasSemana, salvo };`,
    },
    {
      nome: "contagens salvas aparecem no calendário (dados inválidos ignorados)",
      codigo: `
        const ano = document.querySelector(".calendario__titulo").textContent;
        localStorage.setItem("bt:contagem:lista", JSON.stringify([{ id: "t1", titulo: "Teste do calendário", data: ano + "-12-25", hora: "10:00", fuso: "America/Sao_Paulo" }, { id: "ruim", titulo: "<img>", data: "2026-13-40" }]));
        window.dispatchEvent(new StorageEvent("storage", { key: "bt:contagem:lista", newValue: localStorage.getItem("bt:contagem:lista") }));
        const natal = [...document.querySelectorAll("[role=gridcell]")].find((c) => (c.getAttribute("aria-label") || "").includes("25 de dezembro de " + ano));
        const rotulo = natal?.getAttribute("aria-label") || "";
        const ok = rotulo.includes("sua contagem regressiva: Teste do calendário") && rotulo.includes("feriado nacional: Natal") && natal.classList.contains("calendario__dia--com-eventos") && !document.body.textContent.includes("<img>");
        localStorage.removeItem("bt:contagem:lista");
        window.dispatchEvent(new StorageEvent("storage", { key: "bt:contagem:lista", newValue: null }));
        return ok || rotulo;`,
    },
    {
      nome: "criar, editar e excluir evento pessoal neste navegador",
      codigo: `
        const espera = (ms) => new Promise((r) => setTimeout(r, ms));
        localStorage.removeItem("bt:eventos");
        const ano = document.querySelector(".calendario__titulo").textContent;
        const data = ano + "-03-14";
        document.querySelector("#botaoNovoEvento").click();
        document.querySelector("#eventoTitulo").value = "Aniversário <b>Ana</b>";
        document.querySelector("#eventoData").value = data;
        document.querySelector("#eventoHora").value = "19:30";
        document.querySelector("#eventoAnual").checked = true;
        document.querySelector("#formEvento").requestSubmit();
        await espera(200);
        const salvo = JSON.parse(localStorage.getItem("bt:eventos") || "[]");
        const celula = [...document.querySelectorAll("[role=gridcell]")].find((c) => (c.getAttribute("aria-label") || "").includes("14 de março de " + ano));
        const marcado = celula?.classList.contains("calendario__dia--pessoal");
        const noPainel = document.querySelector("#eventosDia").textContent.includes("Aniversário <b>Ana</b> às 19:30");
        [...document.querySelectorAll("#eventosDia .link-botao")].find((b) => b.textContent === "Editar").click();
        document.querySelector("#eventoTitulo").value = "Aniversário da Ana";
        document.querySelector("#formEvento").requestSubmit();
        await espera(200);
        const editado = JSON.parse(localStorage.getItem("bt:eventos"))[0]?.titulo;
        [...document.querySelectorAll("#eventosDia .link-botao")].find((b) => b.textContent === "Excluir").click();
        await espera(100);
        document.querySelector("dialog[open] .botao--perigo").click();
        await espera(200);
        const restante = localStorage.getItem("bt:eventos");
        return (salvo.length === 1 && salvo[0].anual && marcado && noPainel && editado === "Aniversário da Ana" && restante === null) || { salvo, marcado, noPainel, editado, restante };`,
    },
    {
      nome: "cadastro, evento na conta e saída",
      codigo: `
        const espera = (ms) => new Promise((r) => setTimeout(r, ms));
        for (let i = 0; i < 20 && !document.querySelector("#botaoEntrar"); i += 1) await espera(100);
        if (!document.querySelector("#botaoEntrar")) return document.querySelector("#contaTexto").textContent;
        const email = "teste" + Date.now() + "@exemplo.com";
        document.querySelector("#botaoEntrar").click();
        document.querySelector('[data-modo="cadastrar"]').click();
        document.querySelector("#contaEmail").value = email;
        document.querySelector("#contaSenha").value = "senha-de-teste-1";
        document.querySelector("#formConta").requestSubmit();
        for (let i = 0; i < 30 && !document.querySelector("#contaTexto").textContent.includes(email); i += 1) await espera(100);
        const conectado = document.querySelector("#contaTexto").textContent.includes(email);
        document.querySelector("#botaoNovoEvento").click();
        document.querySelector("#eventoTitulo").value = "Na conta";
        document.querySelector("#formEvento").requestSubmit();
        await espera(400);
        const naConta = (await (await fetch("/api/eventos")).json()).eventos?.length;
        const local = localStorage.getItem("bt:eventos");
        [...document.querySelectorAll("#contaAcoes .link-botao")].find((b) => b.textContent === "Sair").click();
        for (let i = 0; i < 30 && !document.querySelector("#botaoEntrar"); i += 1) await espera(100);
        const saiu = !!document.querySelector("#botaoEntrar");
        const semSessao = (await fetch("/api/eventos")).status === 401;
        return (conectado && naConta === 1 && local === null && saiu && semSessao) || { conectado, naConta, local, saiu, semSessao };`,
    },
  ],
  "/calculadoras": [
    {
      nome: "abas mostram uma calculadora por vez e seguem o endereço",
      codigo: `
        const visiveis = () => [...document.querySelectorAll("[role=tabpanel]")].filter((p) => !p.hidden).map((p) => p.id);
        const inicio = visiveis();
        document.querySelector("#abaDuracao").click();
        const depois = visiveis();
        const endereco = location.hash;
        document.querySelector("#abaDiferenca").click();
        return (inicio.join() === "diferenca" && depois.join() === "duracao" && endereco === "#duracao") || { inicio, depois, endereco };`,
    },
    {
      nome: "diferença entre datas com dias úteis (Consciência Negra)",
      codigo: `
        const definir = (id, valor) => { const c = document.querySelector(id); c.value = valor; c.dispatchEvent(new Event("input", { bubbles: true })); };
        definir("#difInicio", "2026-11-16");
        definir("#difFim", "2026-11-20");
        const total = document.querySelector("#difResultado").textContent;
        const detalhes = document.querySelector("#difDetalhes").textContent;
        return (total === "4 dias" && detalhes.includes("4 dias úteis")) || { total, detalhes };`,
    },
    {
      nome: "somar 1 dia útil pula feriado",
      codigo: `
        const definir = (id, valor, ev = "input") => { const c = document.querySelector(id); c.value = valor; c.dispatchEvent(new Event(ev, { bubbles: true })); };
        definir("#somData", "2026-11-19");
        definir("#somQuantidade", "1");
        definir("#somTipo", "uteis", "change");
        const r = document.querySelector("#somResultado").textContent;
        return r === "Segunda-feira, 23 de novembro de 2026" || r;`,
    },
    {
      nome: "duração passando da meia-noite",
      codigo: `
        const definir = (id, valor) => { const c = document.querySelector(id); c.value = valor; c.dispatchEvent(new Event("input", { bubbles: true })); };
        definir("#durInicio", "22:00");
        definir("#durFim", "06:30");
        definir("#durPausa", "0");
        const r = document.querySelector("#durResultado").textContent;
        return (r === "8:30 h" && document.querySelector("#durDetalhes").textContent.includes("dia seguinte")) || r;`,
    },
    {
      nome: "conversão de unidades e validação",
      codigo: `
        const c = document.querySelector("#uniValor");
        c.value = "1,5"; document.querySelector("#uniDe").value = "horas"; c.dispatchEvent(new Event("input"));
        const ok = document.querySelector("#uniResultado").textContent === "90 minutos";
        c.value = "abc"; c.dispatchEvent(new Event("input"));
        const erro = !document.querySelector("#uniErro").hidden && c.getAttribute("aria-invalid") === "true";
        c.value = "90"; document.querySelector("#uniDe").value = "minutos"; c.dispatchEvent(new Event("input"));
        return (ok && erro) || { ok, erro };`,
    },
  ],
  "/timestamp": [
    {
      nome: "timestamp atual vem do relógio sincronizado",
      codigo: `${esperar(400)}
        const s = Number(document.querySelector("#agoraSegundos").textContent);
        const { timestamp } = await (await fetch("/api/hora", { cache: "no-store" })).json();
        return Math.abs(s - Math.floor(timestamp / 1000)) <= 2 || { exibido: s, servidor: timestamp };`,
    },
    {
      nome: "converte segundos e detecta milissegundos",
      codigo: `
        const c = document.querySelector("#tsEntrada");
        c.value = "1760900000"; c.dispatchEvent(new Event("input"));
        const iso = document.querySelector("#tsDetalhes").textContent.includes("2025-10-19T18:53:20.000Z");
        c.value = "1760900000000"; c.dispatchEvent(new Event("input"));
        const ms = document.querySelector("#tsDetalhes").textContent.includes("Milissegundos (detectada)");
        c.value = "12x"; c.dispatchEvent(new Event("input"));
        const erro = !document.querySelector("#tsErro").hidden;
        return (iso && ms && erro) || { iso, ms, erro };`,
    },
    {
      nome: "data de Brasília para timestamp",
      codigo: `
        const definir = (id, valor) => { const c = document.querySelector(id); c.value = valor; c.dispatchEvent(new Event("input", { bubbles: true })); };
        definir("#dtFuso", "fuso:America/Sao_Paulo");
        definir("#dtData", "2026-10-19");
        definir("#dtHora", "17:00:00");
        const r = document.querySelector("#dtResultado").textContent;
        return r === String(Date.UTC(2026, 9, 19, 20) / 1000) || r;`,
    },
    {
      nome: "cada formato tem botão de copiar com nome acessível",
      codigo: `
        const linhas = [...document.querySelectorAll("#tsDetalhes > div, #dtDetalhes > div")];
        const semBotao = linhas.filter((l) => !l.querySelector("dd button[data-valor][aria-label]")).length;
        return (linhas.length >= 4 && semBotao === 0) || { linhas: linhas.length, semBotao };`,
    },
  ],
  "/docs": [
    {
      nome: "índice lateral com todas as seções e âncoras existentes",
      codigo: `
        const links = [...document.querySelectorAll("#docsIndice a")];
        const quebrados = links.filter((a) => !document.querySelector(a.getAttribute("href"))).map((a) => a.getAttribute("href"));
        const ids = ["sincronizacao", "precisao", "eventos-e-conta", "offline", "atalhos", "privacidade", "implantacao", "api"];
        const faltando = ids.filter((id) => !document.getElementById(id));
        return (links.length >= 20 && quebrados.length === 0 && faltando.length === 0) || { n: links.length, quebrados, faltando };`,
    },
    {
      nome: "busca filtra seções e só uma versão de idioma fica visível",
      codigo: `
        const busca = document.querySelector("#docsBusca");
        busca.value = "upstash"; busca.dispatchEvent(new Event("input"));
        const visiveis = [...document.querySelectorAll("#docsIndice li")].filter((li) => !li.hidden).map((li) => li.textContent);
        busca.value = ""; busca.dispatchEvent(new Event("input"));
        const artigos = [...document.querySelectorAll("[data-docs-idioma]")].filter((a) => !a.hidden).length;
        const copiar = document.querySelectorAll("article:not([hidden]) pre .docs__copiar").length;
        return (visiveis.length >= 1 && visiveis.length <= 3 && artigos === 1 && copiar >= 4) || { visiveis, artigos, copiar };`,
    },
  ],
  "/404": [
    {
      nome: "endereço inexistente responde 404 com página própria",
      codigo: `const r = await fetch("/rota-que-nao-existe", { cache: "no-store" }); const t = await r.text(); return (r.status === 404 && t.includes("Esta página se perdeu no tempo") && document.querySelector("h1").textContent.includes("se perdeu")) || r.status;`,
    },
    {
      nome: "links da 404 levam a páginas existentes",
      codigo: `
        const links = [...document.querySelectorAll("main a")].map((a) => a.getAttribute("href"));
        const status = await Promise.all(links.map(async (h) => [h, (await fetch(h, { cache: "no-store" })).status]));
        const ruins = status.filter(([, s]) => s !== 200);
        return (links.length >= 1 && ruins.length === 0) || { links, ruins };`,
    },
  ],
  "/offline": [
    {
      nome: "botão tentar novamente e links offline",
      codigo: `return (document.querySelector("#botaoTentar") !== null && document.querySelectorAll("main .ficha").length >= 4) || "faltando elementos";`,
    },
  ],
  "/despertador": [
    {
      nome: "alarme no passado é recusado",
      codigo: `
        const f = (o) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", ...o });
        const antes = Date.now() - 3 * 60 * 1000;
        document.querySelector('[data-modo="unico"]').click();
        document.querySelector("#campoFuso").value = "brasilia";
        document.querySelector("#campoData").value = f({ year: "numeric", month: "2-digit", day: "2-digit" }).format(antes);
        document.querySelector("#campoHora").value = f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(antes);
        document.querySelector("#formAlarme").requestSubmit();
        const erro = document.querySelector("#erroHora");
        return (!erro.hidden && erro.textContent.includes("já passou") && document.querySelectorAll("#listaAlarmes .alarme").length === 0) || erro.textContent;`,
    },
    {
      nome: "repetição semanal exige pelo menos um dia",
      codigo: `
        document.querySelector('[data-modo="semanal"]').click();
        document.querySelector("#formAlarme").requestSubmit();
        const erro = document.querySelector("#erroDias");
        document.querySelector('[data-modo="unico"]').click();
        return (!erro.hidden && document.querySelectorAll("#listaAlarmes .alarme").length === 0) || erro.textContent;`,
    },
    {
      nome: "alarme do próximo minuto toca e é desligado",
      codigo: `
        const f = (o) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", ...o });
        const alvo = Date.now() + 60 * 1000;
        document.querySelector("#campoFuso").value = "brasilia";
        document.querySelector("#campoData").value = f({ year: "numeric", month: "2-digit", day: "2-digit" }).format(alvo);
        document.querySelector("#campoHora").value = f({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(alvo);
        document.querySelector("#campoRotulo").value = "Teste <b>automático</b>";
        document.querySelector("#formAlarme").requestSubmit();
        const criado = document.querySelectorAll("#listaAlarmes .alarme").length === 1;
        const salvo = JSON.parse(localStorage.getItem("bt:despertador:alarmes") || "[]").length === 1;
        const proximo = document.querySelector("#proximoAlarme").textContent;
        let dialogo = null;
        for (let i = 0; i < 140 && !dialogo; i += 1) { await new Promise((r) => setTimeout(r, 500)); dialogo = document.querySelector("#dialogoAlarme[open]"); }
        if (!dialogo) return { criado, salvo, proximo, tocou: false };
        const titulo = dialogo.querySelector("h2").textContent;
        [...dialogo.querySelectorAll("button")].find((b) => b.textContent === "Desligar").click();
        await new Promise((r) => setTimeout(r, 100));
        const desativado = !document.querySelector("#listaAlarmes .interruptor").checked;
        const fechado = !document.querySelector("#dialogoAlarme");
        localStorage.removeItem("bt:despertador:alarmes");
        return (criado && salvo && titulo === "Teste <b>automático</b>" && desativado && fechado) || { criado, salvo, titulo, desativado, fechado };`,
    },
  ],
  "/contagem": [
    {
      nome: "padrão é o Natal com blocos numéricos",
      codigo: `${esperar(1100)}
        const t = document.querySelector("#tituloContagem").textContent;
        const dias = document.querySelector("#blocoDias").textContent;
        return (t.startsWith("Natal") && /^\\d+$/.test(dias) && /^\\d{2}$/.test(document.querySelector("#blocoSegundos").textContent)) || { t, dias };`,
    },
    {
      nome: "link com título hostil é exibido como texto",
      codigo: `
        const hostil = '<img src=x onerror="window.__xss=1">';
        const a = document.createElement("a");
        a.href = "?titulo=" + encodeURIComponent(hostil) + "&data=2030-01-01&hora=10:00&fuso=Europe/Lisbon";
        a.textContent = "x";
        document.querySelector("#listaSalvas").append(a);
        a.click();
        await new Promise((r) => setTimeout(r, 200));
        const titulo = document.querySelector("#tituloContagem").textContent;
        const semImg = !document.querySelector("#tituloContagem img") && !window.__xss;
        const url = new URLSearchParams(location.search);
        a.remove();
        return (titulo === hostil && semImg && url.get("fuso") === "Europe/Lisbon" && document.querySelector("#alvoContagem").textContent.includes("Lisboa")) || { titulo, semImg };`,
    },
    {
      nome: "data passada conta para cima",
      codigo: `
        document.querySelector("#campoData").value = "2020-01-01";
        document.querySelector("#campoHora").value = "00:00";
        document.querySelector("#formContagem").requestSubmit();
        const t = document.querySelector("#estadoContagem").textContent;
        return t.includes("já passou") || t;`,
    },
    {
      nome: "data inválida mostra erro",
      codigo: `
        document.querySelector("#campoData").value = "";
        document.querySelector("#formContagem").requestSubmit();
        const erro = document.querySelector("#erroForm");
        return !erro.hidden || "sem erro";`,
    },
    {
      nome: "salvar grava no formato compartilhado com o calendário",
      codigo: `
        localStorage.removeItem("bt:contagem:lista");
        document.querySelector("#campoFuso").value = "brasilia";
        document.querySelector('[data-preset="ano-novo"]').click();
        document.querySelector("#botaoSalvar").click();
        const lista = JSON.parse(localStorage.getItem("bt:contagem:lista"));
        const item = lista?.[0];
        const ok = lista.length === 1 && /^\\d{4}-01-01$/.test(item.data) && item.hora === "00:00" && item.fuso === "America/Sao_Paulo" && item.titulo.startsWith("Ano Novo") && item.id;
        const naLista = document.querySelectorAll("#listaSalvas li").length === 1;
        document.querySelector("#listaSalvas li button").click();
        const removido = JSON.parse(localStorage.getItem("bt:contagem:lista")).length === 0;
        return (Boolean(ok) && naLista && removido) || { lista, naLista, removido };`,
    },
  ],
  "/sol": [
    {
      nome: "horários de Brasília e tabela de 7 dias",
      codigo: `
        const n = document.querySelector("#valorNascer").textContent;
        const p = document.querySelector("#valorPor").textContent;
        return (/^\\d{2}:\\d{2}$/.test(n) && /^\\d{2}:\\d{2}$/.test(p) && document.querySelectorAll("#tabelaSemana tr").length === 7 && document.querySelector("#localResultado").textContent.includes("15,794° S")) || { n, p, local: document.querySelector("#localResultado").textContent };`,
    },
    {
      nome: "Brasília em 21/06/2026: ~06:37 e ~17:49",
      codigo: `
        const c = document.querySelector("#campoData"); c.value = "2026-06-21"; c.dispatchEvent(new Event("change"));
        const n = document.querySelector("#valorNascer").textContent, p = document.querySelector("#valorPor").textContent;
        return (["06:35","06:36","06:37","06:38"].includes(n) && ["17:47","17:48","17:49","17:50"].includes(p)) || { n, p };`,
    },
    {
      nome: "Tromsø em junho mostra dia polar",
      codigo: `
        const s = document.querySelector("#campoCidade"); s.value = "tromso"; s.dispatchEvent(new Event("change"));
        const visivel = !document.querySelector("#avisoPolar").hidden && document.querySelector("#textoPolar").textContent.includes("não se põe");
        s.value = "brasilia"; s.dispatchEvent(new Event("change"));
        return (visivel && document.querySelector("#avisoPolar").hidden) || "aviso polar ausente";`,
    },
    {
      nome: "coordenadas inválidas são recusadas",
      codigo: `
        document.querySelector('[data-origem="coordenadas"]').click();
        const lat = document.querySelector("#campoLat"); lat.value = "100"; lat.dispatchEvent(new Event("input"));
        const erro = !document.querySelector("#erroCoordenadas").hidden;
        lat.value = "-23.55"; lat.dispatchEvent(new Event("input"));
        const ok = document.querySelector("#erroCoordenadas").hidden;
        document.querySelector('[data-origem="cidade"]').click();
        localStorage.removeItem("bt:sol:config");
        return (erro && ok) || { erro, ok };`,
    },
  ],
};
