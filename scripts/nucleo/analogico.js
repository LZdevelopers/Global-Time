// Relógio analógico em SVG. Os ponteiros recebem a hora já convertida para o
// fuso desejado (partesNoFuso), então ele mostra exatamente o mesmo horário do
// relógio digital sincronizado.

import { t } from "../i18n/estado.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(tag, atributos = {}) {
  const elemento = document.createElementNS(SVG_NS, tag);
  for (const [chave, valor] of Object.entries(atributos)) elemento.setAttribute(chave, String(valor));
  return elemento;
}

export function criarRelogioAnalogico({ rotulo = t("analogico.rotulo"), numeros = true } = {}) {
  const raiz = svg("svg", { viewBox: "-110 -110 220 220", class: "analogico", role: "img", "aria-label": rotulo });
  raiz.append(svg("circle", { class: "analogico__aro", r: 104 }));

  for (let i = 0; i < 60; i += 1) {
    const hora = i % 5 === 0;
    const angulo = (i * Math.PI) / 30;
    const r1 = hora ? 84 : 90;
    const r2 = 96;
    raiz.append(
      svg("line", {
        class: `analogico__marca${hora ? " analogico__marca--hora" : ""}`,
        x1: (Math.sin(angulo) * r1).toFixed(2),
        y1: (-Math.cos(angulo) * r1).toFixed(2),
        x2: (Math.sin(angulo) * r2).toFixed(2),
        y2: (-Math.cos(angulo) * r2).toFixed(2),
      }),
    );
  }

  if (numeros) {
    for (let h = 1; h <= 12; h += 1) {
      const angulo = (h * Math.PI) / 6;
      const texto = svg("text", {
        class: "analogico__numero",
        x: (Math.sin(angulo) * 70).toFixed(2),
        y: (-Math.cos(angulo) * 70).toFixed(2),
        "aria-hidden": "true",
      });
      texto.textContent = String(h);
      raiz.append(texto);
    }
  }

  const ponteiro = (classe, comprimento, cauda) =>
    svg("line", { class: `analogico__ponteiro analogico__ponteiro--${classe}`, x1: 0, y1: cauda, x2: 0, y2: -comprimento });

  const hora = ponteiro("hora", 50, 10);
  const minuto = ponteiro("minuto", 76, 12);
  const segundo = ponteiro("segundo", 86, 18);
  raiz.append(hora, minuto, segundo, svg("circle", { class: "analogico__centro", r: 4.5 }));

  let ultimoRotulo = "";

  return {
    elemento: raiz,
    /** partes: { hora, minuto, segundo } já no fuso desejado. */
    atualizar({ hora: h, minuto: m, segundo: s }) {
      hora.setAttribute("transform", `rotate(${((h % 12) + m / 60) * 30})`);
      minuto.setAttribute("transform", `rotate(${(m + s / 60) * 6})`);
      segundo.setAttribute("transform", `rotate(${s * 6})`);
      // O rótulo acessível muda só a cada minuto, para não poluir leitores de tela.
      const novo = `${rotulo}: ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (novo !== ultimoRotulo) {
        raiz.setAttribute("aria-label", novo);
        ultimoRotulo = novo;
      }
    },
  };
}
