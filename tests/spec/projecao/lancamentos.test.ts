// Regras de lançamento: previstos, faturas, reserva e atrasados.
// Fontes: B1-Nucleo-de-Calculo.md ("Critérios de aceitação") e Regras-de-Calculo.md (R2, R3, R6b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProjecao } from '../../../api/src/projecao/calcular-projecao.ts';
import { casoCompleto, diaDe, somenteContas, HOJE } from './_fixtures.ts';

// `reserva` é texto (Convenções, B1); "preenchida" = texto não vazio.
const RESERVA = 'reserva-emergencia';

// B1-1: sem previstos nem faturas, uma linha dia em hoje com total = soma dos saldos (B1, critério 1).
test('B1-1: sem lançamentos, linha dia em hoje com total = soma dos saldos e teto = max(0, total)', () => {
  const saida = calcularProjecao(somenteContas([10000, 0]));
  const dias = saida.linhas.filter((l: any) => l.tipo === 'dia');
  assert.equal(dias.length, 1);
  assert.equal(dias[0].de, HOJE);
  assert.equal(dias[0].total, 10000);
  assert.equal(saida.teto, 10000);
});

// B1-1: total negativo derruba o teto para zero (B1, critério 1 e R6).
test('B1-1: sem lançamentos e saldo total negativo, teto = 0', () => {
  const saida = calcularProjecao(somenteContas([-16301, 5755]));
  const dia = diaDe(saida, HOJE);
  assert.equal(dia.total, -10546);
  assert.equal(saida.teto, 0);
});

// B1-5: fatura pendente entra como saída no dia do vencimento (B1, critério 5).
test('B1-5: fatura pendente vira saída única no dia do vencimento', () => {
  const saida = calcularProjecao(
    somenteContas([100000], {
      faturas: [{ id: 'f1', descricao: 'Fatura Santander', vencimento: '2026-11-10', valor: 26079, estado: 'pendente' }],
    }),
  );
  const dia = diaDe(saida, '2026-11-10');
  assert.ok(dia, 'deveria haver linha dia em 10/11');
  assert.equal(dia.entra, 0);
  assert.equal(dia.sai, 26079);
  assert.equal(dia.total, 100000 - 26079);
});

// B1-5: fatura paga não entra em nenhuma linha (B1, critério 5; D48, D49).
test('B1-5: fatura paga não altera as linhas', () => {
  const semFatura = calcularProjecao(somenteContas([100000]));
  const comPaga = calcularProjecao(
    somenteContas([100000], {
      faturas: [{ id: 'f1', descricao: 'Fatura Santander', vencimento: '2026-11-10', valor: 26079, estado: 'paga' }],
    }),
  );
  assert.deepEqual(comPaga.linhas, semFatura.linhas);
  assert.equal(comPaga.teto, semFatura.teto);
});

// B1-6: só `previsto` entra; pago, realizado e cancelado ficam de fora (B1, critério 6; D20, D44).
for (const estado of ['pago', 'realizado', 'cancelado'] as const) {
  test(`B1-6: previsto com estado "${estado}" não altera as linhas`, () => {
    const base = calcularProjecao(somenteContas([100000]));
    const saida = calcularProjecao(
      somenteContas([100000], {
        previstos: [{ id: 'p1', descricao: 'Mercado', data: '2026-10-20', valor: 3000, sentido: 'saida', estado }],
      }),
    );
    assert.deepEqual(saida.linhas, base.linhas);
    assert.equal(saida.teto, base.teto);
  });
}

// B1-6: controle, previsto com estado "previsto" entra (senão o teste acima seria vazio).
test('B1-6: previsto com estado "previsto" entra na projeção', () => {
  const saida = calcularProjecao(
    somenteContas([100000], {
      previstos: [{ id: 'p1', descricao: 'Mercado', data: '2026-10-20', valor: 3000, sentido: 'saida', estado: 'previsto' }],
    }),
  );
  assert.equal(diaDe(saida, '2026-10-20').total, 97000);
});

// B1-7: previsto com reserva preenchida não entra em total nem teto (B1, critério 7; D23).
test('B1-7: previsto com reserva não altera linhas nem teto', () => {
  const base = calcularProjecao(casoCompleto());
  const saida = calcularProjecao(
    casoCompleto({
      previstos: [
        ...casoCompleto().previstos,
        { id: 'reserva-1025', descricao: 'Aporte reserva', data: '2026-10-25', valor: 5000, sentido: 'saida', reserva: RESERVA, estado: 'previsto' },
      ],
    }),
  );
  assert.deepEqual(saida.linhas, base.linhas);
  assert.equal(saida.teto, base.teto);
});

// B1-8: entrada e saída no mesmo dia somam no mesmo dia (B1, critério 8).
test('B1-8: entrada e saída no mesmo dia aparecem juntas em entra, sai e total', () => {
  const saida = calcularProjecao(
    somenteContas([10000], {
      previstos: [
        { id: 'e1', descricao: 'Pix recebido', data: '2026-10-20', valor: 5000, sentido: 'entrada', estado: 'previsto' },
        { id: 's1', descricao: 'Padaria', data: '2026-10-20', valor: 2000, sentido: 'saida', estado: 'previsto' },
      ],
    }),
  );
  const dia = diaDe(saida, '2026-10-20');
  assert.equal(dia.entra, 5000);
  assert.equal(dia.sai, 2000);
  assert.equal(dia.total, 13000);
});

// B1-9: previsto atrasado entra no dia de hoje com o sentido original e aparece em atrasados (B1, critério 9; D38).
test('B1-9: previsto de saída atrasado entra em hoje como saída e aparece em atrasados', () => {
  const saida = calcularProjecao(
    somenteContas([10000], {
      previstos: [{ id: 'atr-s', descricao: 'Conta de luz', data: '2026-10-10', valor: 2000, sentido: 'saida', estado: 'previsto' }],
    }),
  );
  const dia = diaDe(saida, HOJE);
  assert.equal(dia.sai, 2000);
  assert.equal(dia.total, 8000);
  assert.deepEqual(
    saida.atrasados.map((a: any) => ({ tipo: a.tipo, id: a.id, descricao: a.descricao, valor: a.valor, sentido: a.sentido, dataOriginal: a.dataOriginal })),
    [{ tipo: 'previsto', id: 'atr-s', descricao: 'Conta de luz', valor: 2000, sentido: 'saida', dataOriginal: '2026-10-10' }],
  );
});

// B1-9: previsto de entrada atrasado entra em hoje como entrada (sentido original).
test('B1-9: previsto de entrada atrasado entra em hoje como entrada', () => {
  const saida = calcularProjecao(
    somenteContas([10000], {
      previstos: [{ id: 'atr-e', descricao: 'Reembolso', data: '2026-10-10', valor: 1500, sentido: 'entrada', estado: 'previsto' }],
    }),
  );
  const dia = diaDe(saida, HOJE);
  assert.equal(dia.entra, 1500);
  assert.equal(dia.sai, 0);
  assert.equal(dia.total, 11500);
});

// B1-15: fatura pendente com vencimento passado entra em hoje e aparece em atrasados (B1, critério 15; D47).
test('B1-15: fatura pendente vencida entra em hoje como saída e aparece em atrasados com tipo fatura', () => {
  const saida = calcularProjecao(
    somenteContas([10000], {
      faturas: [{ id: 'f-venc', descricao: 'Fatura Santander', vencimento: '2026-10-10', valor: 26079, estado: 'pendente' }],
    }),
  );
  const dia = diaDe(saida, HOJE);
  assert.equal(dia.sai, 26079);
  assert.equal(dia.total, 10000 - 26079);
  assert.deepEqual(
    saida.atrasados.map((a: any) => ({ tipo: a.tipo, id: a.id, valor: a.valor, sentido: a.sentido, dataOriginal: a.dataOriginal })),
    [{ tipo: 'fatura', id: 'f-venc', valor: 26079, sentido: 'saida', dataOriginal: '2026-10-10' }],
  );
});

// B1-15: fatura paga com vencimento passado não entra em nada.
test('B1-15: fatura paga com vencimento passado não entra nas linhas nem em atrasados', () => {
  const base = calcularProjecao(somenteContas([10000]));
  const saida = calcularProjecao(
    somenteContas([10000], {
      faturas: [{ id: 'f-paga', descricao: 'Fatura PicPay', vencimento: '2026-10-10', valor: 26998, estado: 'paga' }],
    }),
  );
  assert.deepEqual(saida.linhas, base.linhas);
  assert.deepEqual(saida.atrasados, []);
});

// B1-16: previsto de reserva vencido aparece em atrasados com tipo reserva e não soma (B1, critério 16; D53).
test('B1-16: reserva atrasada aparece em atrasados como tipo reserva, sem somar em linhas nem teto', () => {
  const base = calcularProjecao(somenteContas([10000]));
  const saida = calcularProjecao(
    somenteContas([10000], {
      previstos: [{ id: 'res-atr', descricao: 'Aporte reserva', data: '2026-10-10', valor: 5000, sentido: 'saida', reserva: RESERVA, estado: 'previsto' }],
    }),
  );
  assert.deepEqual(saida.linhas, base.linhas);
  assert.equal(saida.teto, base.teto);
  const atrasado = saida.atrasados.find((a: any) => a.id === 'res-atr');
  assert.ok(atrasado, 'reserva atrasada deveria estar em atrasados');
  assert.equal(atrasado.tipo, 'reserva');
  assert.equal(atrasado.dataOriginal, '2026-10-10');
});

// B1-22: reserva nunca é item de dia; só aparece em atrasados quando vencida (B1, critério 22).
test('B1-22: reserva futura não é item de nenhum dia nem aparece em atrasados', () => {
  const saida = calcularProjecao(
    casoCompleto({
      previstos: [
        ...casoCompleto().previstos,
        { id: 'res-futura', descricao: 'Aporte futuro', data: '2026-10-25', valor: 5000, sentido: 'saida', reserva: RESERVA, estado: 'previsto' },
      ],
    }),
  );
  for (const l of saida.linhas) {
    assert.ok(!l.itens.some((i: any) => i.id === 'res-futura'), `reserva futura apareceu em itens de ${l.de}`);
  }
  assert.ok(!saida.atrasados.some((a: any) => a.id === 'res-futura'));
});

// B1-22: reserva vencida tampouco vira item do dia de hoje (só fica em atrasados).
test('B1-22: reserva vencida fica em atrasados e não vira item de nenhum dia', () => {
  const saida = calcularProjecao(
    somenteContas([10000], {
      previstos: [{ id: 'res-venc', descricao: 'Aporte vencido', data: '2026-10-10', valor: 5000, sentido: 'saida', reserva: RESERVA, estado: 'previsto' }],
    }),
  );
  for (const l of saida.linhas) {
    assert.ok(!l.itens.some((i: any) => i.id === 'res-venc'), `reserva vencida apareceu em itens de ${l.de}`);
  }
  assert.ok(saida.atrasados.some((a: any) => a.id === 'res-venc' && a.tipo === 'reserva'));
});
