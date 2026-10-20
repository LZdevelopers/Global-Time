import { test } from "node:test";
import assert from "node:assert/strict";
import { ContagemRegressiva, Cronometro, detalharVoltas } from "../scripts/nucleo/medidores.js";

function relogios() {
  const r = { perf: 0, epoch: Date.UTC(2026, 9, 19, 12) };
  return {
    estado: r,
    avancar(ms) {
      r.perf += ms;
      r.epoch += ms;
    },
    // Simula recarga: performance.now() recomeça, o relógio civil continua.
    recarregar(msFora = 0) {
      r.perf = 0;
      r.epoch += msFora;
    },
    fontes: { perfAgora: () => r.perf, epochAgora: () => r.epoch },
  };
}

test("cronômetro: iniciar, pausar, retomar e zerar", () => {
  const t = relogios();
  const c = new Cronometro(t.fontes);
  c.iniciar();
  t.avancar(1500);
  assert.equal(c.decorrido(), 1500);
  c.pausar();
  t.avancar(10_000);
  assert.equal(c.decorrido(), 1500, "pausado não conta");
  c.iniciar();
  t.avancar(500);
  assert.equal(c.decorrido(), 2000);
  c.zerar();
  assert.equal(c.decorrido(), 0);
  assert.equal(c.status, "parado");
});

test("cronômetro não é afetado por ajuste do relógio civil durante a sessão", () => {
  const t = relogios();
  const c = new Cronometro(t.fontes);
  c.iniciar();
  t.avancar(1000);
  t.estado.epoch -= 3_600_000; // alguém atrasou o relógio do sistema em 1 h
  t.avancar(1000);
  assert.equal(c.decorrido(), 2000);
});

test("cronômetro: voltas, diferenças, melhor e pior", () => {
  const t = relogios();
  const c = new Cronometro(t.fontes);
  assert.equal(c.registrarVolta(), null, "sem rodar não registra");
  c.iniciar();
  for (const duracao of [10_000, 8_000, 12_500, 9_000]) {
    t.avancar(duracao);
    c.registrarVolta();
  }
  t.avancar(3_000);
  assert.equal(c.voltaAtual(), 3_000);
  const voltas = c.voltasDetalhadas();
  assert.deepEqual(voltas.map((v) => v.voltaMs), [10_000, 8_000, 12_500, 9_000]);
  assert.deepEqual(voltas.map((v) => v.totalMs), [10_000, 18_000, 30_500, 39_500]);
  assert.deepEqual(voltas.map((v) => v.diferencaMs), [null, -2_000, 4_500, -3_500]);
  assert.equal(voltas.find((v) => v.melhor).numero, 2);
  assert.equal(voltas.find((v) => v.pior).numero, 3);
});

test("melhor/pior não marcados com uma volta ou voltas iguais", () => {
  assert.equal(detalharVoltas([5000]).some((v) => v.melhor || v.pior), false);
  assert.equal(detalharVoltas([5000, 10_000]).some((v) => v.melhor || v.pior), false);
});

test("cronômetro rodando continua após recarregar a página", () => {
  const t = relogios();
  const c = new Cronometro(t.fontes);
  c.iniciar();
  t.avancar(4_000);
  c.registrarVolta();
  t.avancar(1_000);
  const salvo = JSON.parse(JSON.stringify(c.serializar()));

  t.recarregar(2_500); // 2,5 s com a página recarregando
  const r = Cronometro.restaurar(salvo, t.fontes);
  assert.equal(r.status, "rodando");
  assert.equal(r.decorrido(), 7_500);
  t.avancar(500);
  assert.equal(r.decorrido(), 8_000);
  assert.deepEqual(r.voltas, [4_000]);
});

test("cronômetro pausado é restaurado pausado", () => {
  const t = relogios();
  const c = new Cronometro(t.fontes);
  c.iniciar();
  t.avancar(3_723_456);
  c.pausar();
  t.recarregar(60_000);
  const r = Cronometro.restaurar(c.serializar(), t.fontes);
  assert.equal(r.status, "pausado");
  assert.equal(r.decorrido(), 3_723_456);
});

test("restauração ignora dados corrompidos", () => {
  const t = relogios();
  assert.equal(Cronometro.restaurar(null, t.fontes).status, "parado");
  const r = Cronometro.restaurar({ status: "rodando", acumuladoMs: "x", inicioEpoch: "y", voltas: [5, 3] }, t.fontes);
  assert.equal(r.decorrido(), 0);
  assert.deepEqual(r.voltas, []);
});

test("contagem regressiva calcula pelo instante final, sem deriva", () => {
  const t = relogios();
  const c = new ContagemRegressiva(10_000, t.fontes);
  c.iniciar();
  // Callbacks atrasados e irregulares não acumulam erro.
  for (const passo of [1_270, 990, 3_400, 15]) t.avancar(passo);
  assert.equal(c.restante(), 10_000 - 5_675);
  assert.equal(c.verificar(), false);
  t.avancar(4_325);
  assert.equal(c.verificar(), true);
  assert.equal(c.status, "concluido");
  assert.equal(c.verificar(), false, "só dispara uma vez");
});

test("contagem: pausa, retomada, reinício e ajuste", () => {
  const t = relogios();
  const c = new ContagemRegressiva(60_000, t.fontes);
  c.iniciar();
  t.avancar(20_000);
  c.pausar();
  t.avancar(30_000);
  assert.equal(c.restante(), 40_000);
  c.iniciar();
  t.avancar(10_000);
  assert.equal(c.restante(), 30_000);
  c.ajustar(60_000);
  assert.equal(c.restante(), 90_000);
  c.reiniciar();
  assert.equal(c.restante(), c.duracaoMs);
  assert.equal(c.status, "pronto");
});

test("contagem rodando sobrevive à recarga", () => {
  const t = relogios();
  const c = new ContagemRegressiva(300_000, t.fontes);
  c.iniciar();
  t.avancar(100_000);
  const salvo = c.serializar();
  t.recarregar(20_000);
  const r = ContagemRegressiva.restaurar(salvo, t.fontes);
  assert.equal(r.status, "rodando");
  assert.equal(r.restante(), 180_000);
});

test("contagem que terminou com a página fechada informa o fim", () => {
  const t = relogios();
  const c = new ContagemRegressiva(5_000, t.fontes);
  c.iniciar();
  const salvo = c.serializar();
  const fimEsperado = salvo.fimEpoch;
  t.recarregar(60_000);
  const r = ContagemRegressiva.restaurar(salvo, t.fontes);
  assert.equal(r.status, "concluido");
  assert.equal(r.terminouEm, fimEsperado);
  assert.equal(r.restante(), 0);
});

test("contagem com duração zero fica vazia e não inicia", () => {
  const c = new ContagemRegressiva(0, relogios().fontes);
  assert.equal(c.status, "vazio");
  assert.equal(c.iniciar(), false);
});
