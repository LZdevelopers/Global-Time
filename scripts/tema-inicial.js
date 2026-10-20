// Roda antes da primeira pintura (script clássico e síncrono no <head>),
// mantido mínimo de propósito:
//  - aplica o tema salvo, evitando o "piscar" do tema errado;
//  - marca que há JavaScript, para estilos que dependem dele;
//  - se a interface provavelmente não for em português do Brasil, esconde o
//    conteúdo até scripts/i18n/index.js traduzir (o CSS revela sozinho após
//    alguns segundos caso o script falhe), evitando a troca visível de idioma.
(function () {
  var raiz = document.documentElement;
  raiz.classList.add("js");
  try {
    var tema = localStorage.getItem("gt:tema") || localStorage.getItem("brasilTimeTheme");
    if (tema === "dark" || tema === "light") raiz.setAttribute("data-theme", tema);
  } catch (erro) {
    /* armazenamento indisponível: tema claro padrão */
  }
  var idioma = null;
  try {
    idioma = localStorage.getItem("gt:idioma");
  } catch (erro) {
    /* sem preferência salva */
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
