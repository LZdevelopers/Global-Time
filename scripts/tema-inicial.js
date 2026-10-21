// Roda antes da primeira pintura (script clássico e síncrono no <head>),
// mantido mínimo de propósito:
//  - aplica o tema salvo, evitando o "piscar" do tema errado;
//  - marca que há JavaScript, para estilos que dependem dele;
//  - nas páginas 404 e offline (as únicas traduzidas no navegador; as demais
//    já vêm traduzidas no HTML), se a interface provavelmente não for em
//    português do Brasil, esconde o conteúdo até scripts/i18n/index.js
//    traduzir (o CSS revela sozinho após alguns segundos caso o script falhe).
(function () {
  var raiz = document.documentElement;
  raiz.classList.add("js");
  try {
    var tema = localStorage.getItem("gt:tema") || localStorage.getItem("brasilTimeTheme");
    if (tema === "dark" || tema === "light") raiz.setAttribute("data-theme", tema);
  } catch (erro) {
    /* armazenamento indisponível: tema claro padrão */
  }
  var pagina = document.querySelector('meta[name="gt:pagina"]');
  if (!pagina || (pagina.content !== "404" && pagina.content !== "offline")) return;
  var prefixo = location.pathname.split("/")[1] || "";
  var idioma = /^[a-z]{2}(-[a-z]{2})?$/i.test(prefixo) ? prefixo : null;
  if (!idioma) {
    try {
      idioma = localStorage.getItem("gt:idioma");
    } catch (erro) {
      /* sem preferência salva */
    }
  }
  if (!idioma) {
    try {
      idioma = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch (erro) {
      idioma = "";
    }
  }
  if (!idioma) idioma = (navigator.languages && navigator.languages[0]) || navigator.language || "";
  if (!/^pt(-BR)?$/i.test(idioma)) raiz.classList.add("i18n-pendente");
})();
