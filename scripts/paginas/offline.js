// Página exibida pelo service worker quando não há rede nem cópia da página.
// Recarrega ao clicar e também sozinha quando a conexão volta.

import "../i18n/index.js";
import { t } from "../i18n/estado.js";

const botao = document.getElementById("botaoTentar");
const estado = document.getElementById("estadoConexao");

function mostrarEstado() {
  estado.textContent = t(navigator.onLine ? "offline.voltou" : "offline.semConexao");
}

botao.addEventListener("click", () => {
  botao.setAttribute("aria-busy", "true");
  location.reload();
});

window.addEventListener("online", () => {
  mostrarEstado();
  location.reload();
});
window.addEventListener("offline", mostrarEstado);
mostrarEstado();
