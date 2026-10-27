// Alerta por conta, inteiros em centavos e pureza.
// Fontes: B1-Nucleo-de-Calculo.md ("Critérios de aceitação", 10, 11, 12, 23) e Regras-de-Calculo.md (R7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProjecao } from '../../../api/src/projecao/calcular-projecao.ts';
import { casoCompleto, congelar, HOJE, numerosDe, somenteContas } from './_fixtures.ts';

// B1-10: a segunda conta fica negativa com a saída de 50 (B1, critério 10; R7).
// Exemplo do critério, em centavos (saldos 100 e 0, saída de 50 em 20/10).
test('B1-10: conta que fica negativa aparece em contasNegativas com primeiroDia e menorSaldo', () => {
  const saida = calcularProjecao({
    hoje: HOJE,
    contas: [
      { id: 'primeira', saldo: 100 },
      { id: 'segunda', saldo: 0 },
    ],
    previstos: [{ id: 'p1', descricao: 'Mercado', data: '2026-10-20', valor: 50, sentido: 'saida', conta: 'segunda', estado: 'previsto' }],
    faturas: [],
  });
  assert.deepEqual(saida.contasNegativas, [{ conta: 'segunda', primeiroDia: '2026-10-20', menorSaldo: -50 }]);
});

// B1-10: conta que já começa negativa entra com primeiroDia = hoje e menorSaldo = menor saldo da janela (B1, critério 10).
// Saldo cai para -700 em 20/10 e volta a positivo em 25/10: o menorSaldo é o mínimo, não o último.
test('B1-10: conta que já começa negativa tem primeiroDia = hoje e menorSaldo = menor saldo na janela', () => {
  const saida = calcularProjecao({
    hoje: HOJE,
    contas: [{ id: 'c', saldo: -500 }],
    previstos: [
      { id: 'p1', descricao: 'Mercado', data: '2026-10-20', valor: 200, sentido: 'saida', conta: 'c', estado: 'previsto' },
      { id: 'p2', descricao: 'Reembolso', data: '2026-10-25', valor: 1000, sentido: 'entrada', conta: 'c', estado: 'previsto' },
    ],
    faturas: [],
  });
  assert.deepEqual(saida.contasNegativas, [{ conta: 'c', primeiroDia: HOJE, menorSaldo: -700 }]);
});

// B1-10: caso de 17/10 (B1, critério 10): só o Santander fica negativo, porque os previstos e as faturas do caso não têm conta.
test('B1-10: caso de 17/10 tem só o Santander em contasNegativas, com primeiroDia 17/10 e menorSaldo -16301', () => {
  const saida = calcularProjecao(casoCompleto());
  assert.deepEqual(saida.contasNegativas, [{ conta: 'santander', primeiroDia: '2026-10-17', menorSaldo: -16301 }]);
});

// B1-10: previsto e fatura sem conta não alteram o saldo por conta (B1, critério 10).
// O controle com o mesmo previsto com `conta` garante que a lista não vem vazia por engano.
test('B1-10: previsto e fatura sem conta não entram no saldo por conta', () => {
  const previsto = { id: 'p1', descricao: 'Mercado', data: '2026-10-20', valor: 500, sentido: 'saida', estado: 'previsto' } as const;
  const fatura = { id: 'f1', descricao: 'Fatura Itaú', vencimento: '2026-10-20', valor: 1000, estado: 'pendente' } as const;
  const semConta = calcularProjecao({ hoje: HOJE, contas: [{ id: 'c', saldo: 100 }], previstos: [previsto], faturas: [fatura] });
  assert.deepEqual(semConta.contasNegativas, []);

  const comConta = calcularProjecao({ hoje: HOJE, contas: [{ id: 'c', saldo: 100 }], previstos: [{ ...previsto, conta: 'c' }], faturas: [fatura] });
  assert.deepEqual(comConta.contasNegativas, [{ conta: 'c', primeiroDia: '2026-10-20', menorSaldo: -400 }]);
});

// B1-10: contasNegativas ordenada por primeiroDia e, no empate, por conta (B1, critério 10).
// Entrada com as contas fora de ordem; 'd' já começa negativa (primeiroDia = hoje); 'a' e 'b' empatam em 20/10.
test('B1-10: contasNegativas vem ordenada por primeiroDia e, no empate, por conta', () => {
  const saida = calcularProjecao({
    hoje: HOJE,
    contas: [
      { id: 'b', saldo: 0 },
      { id: 'd', saldo: -5 },
      { id: 'c', saldo: 100 },
      { id: 'a', saldo: 0 },
    ],
    previstos: [
      { id: 'p1', descricao: 'Luz', data: '2026-10-20', valor: 10, sentido: 'saida', conta: 'b', estado: 'previsto' },
      { id: 'p2', descricao: 'Água', data: '2026-10-20', valor: 10, sentido: 'saida', conta: 'a', estado: 'previsto' },
      { id: 'p3', descricao: 'Gás', data: '2026-10-22', valor: 200, sentido: 'saida', conta: 'c', estado: 'previsto' },
    ],
    faturas: [],
  });
  assert.deepEqual(saida.contasNegativas, [
    { conta: 'd', primeiroDia: HOJE, menorSaldo: -5 },
    { conta: 'a', primeiroDia: '2026-10-20', menorSaldo: -10 },
    { conta: 'b', primeiroDia: '2026-10-20', menorSaldo: -10 },
    { conta: 'c', primeiroDia: '2026-10-22', menorSaldo: -100 },
  ]);
});

// B1-10: previsto atrasado com conta entra no saldo da conta a partir de hoje (B1, critérios 9 e 10).
test('B1-10: previsto atrasado com conta entra no saldo da conta em hoje', () => {
  const saida = calcularProjecao({
    hoje: HOJE,
    contas: [{ id: 'c', saldo: 100 }],
    previstos: [{ id: 'atr', descricao: 'Conta atrasada', data: '2026-10-10', valor: 150, sentido: 'saida', conta: 'c', estado: 'previsto' }],
    faturas: [],
  });
  assert.deepEqual(saida.contasNegativas, [{ conta: 'c', primeiroDia: HOJE, menorSaldo: -50 }]);
});

// B1-10: conta que nunca fica abaixo de zero não aparece; saldo exatamente zero não é negativo (B1, critério 10).
test('B1-10: conta que nunca fica abaixo de zero não aparece em contasNegativas', () => {
  const saida = calcularProjecao({
    hoje: HOJE,
    contas: [
      { id: 'positiva', saldo: 500 },
      { id: 'zerada', saldo: 100 },
      { id: 'ruim', saldo: 0 },
    ],
    previstos: [
      { id: 'p1', descricao: 'Zera a conta', data: '2026-10-20', valor: 100, sentido: 'saida', conta: 'zerada', estado: 'previsto' },
      { id: 'p2', descricao: 'Estoura', data: '2026-10-21', valor: 1, sentido: 'saida', conta: 'ruim', estado: 'previsto' },
    ],
    faturas: [],
  });
  assert.deepEqual(saida.contasNegativas, [{ conta: 'ruim', primeiroDia: '2026-10-21', menorSaldo: -1 }]);
});

// B1-11: valores inteiros, sem ponto flutuante na saída (B1, critério 11).
test('B1-11: todo número da saída do caso de 17/10 é inteiro', () => {
  const saida = calcularProjecao(casoCompleto());
  for (const n of numerosDe(saida)) {
    assert.ok(Number.isInteger(n), `número não inteiro na saída: ${n}`);
  }
});

// B1-11: soma de valores grandes não perde centavo. Valores dentro de Number.MAX_SAFE_INTEGER (Convenções, B1).
test('B1-11: soma de valores grandes em centavos é exata', () => {
  const saida = calcularProjecao(
    somenteContas([900000000000001, 1], {
      previstos: [{ id: 'p1', descricao: 'Grande', data: '2026-10-20', valor: 1, sentido: 'saida', estado: 'previsto' }],
    }),
  );
  const dia = saida.linhas.find((l: any) => l.tipo === 'dia' && l.de === '2026-10-20');
  assert.equal(dia.total, 900000000000001);
  for (const n of numerosDe(saida)) assert.ok(Number.isInteger(n));
});

// B1-12: mesma entrada, mesma saída (B1, critério 12).
test('B1-12: chamadas repetidas com a mesma entrada devolvem a mesma saída', () => {
  const primeira = calcularProjecao(casoCompleto());
  const segunda = calcularProjecao(casoCompleto());
  assert.deepEqual(segunda, primeira);
});

// B1-12: a função não altera a entrada (teste com entrada congelada; ESM roda em modo estrito).
test('B1-12: entrada congelada não é alterada e não gera erro', () => {
  const entrada = congelar(casoCompleto());
  const copia = casoCompleto();
  assert.doesNotThrow(() => calcularProjecao(entrada));
  assert.deepEqual(entrada, copia);
});

// B1-23: itens são derivados da entrada e não a alteram (B1, critério 23; critério 12).
test('B1-23: calcular os itens não altera a entrada', () => {
  const entrada = congelar(casoCompleto());
  const copia = casoCompleto();
  const saida = calcularProjecao(entrada);
  assert.ok(saida.linhas.some((l: any) => l.itens.length > 0), 'deveria haver itens para checar');
  assert.deepEqual(entrada, copia);
});
