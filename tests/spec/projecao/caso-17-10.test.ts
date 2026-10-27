// Caso de 17/10: teste central. Fontes: B1-Nucleo-de-Calculo.md ("Critérios de aceitação")
// e Caso-de-Teste-17-10.md ("Resultado esperado", "Teto").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProjecao } from '../../../api/src/projecao/calcular-projecao.ts';
import { casoCompleto, casoSemAte, diaDe, resumoLinhas } from './_fixtures.ts';

// B1-2: caso de 17/10, linhas exatas (B1, critério 2; Caso-de-Teste-17-10, "Resultado esperado").
test('B1-2: caso de 17/10 gera as 10 linhas exatas (tipo, de, ate, entra, sai, total)', () => {
  const saida = calcularProjecao(casoCompleto());
  assert.deepEqual(resumoLinhas(saida), [
    { tipo: 'dia', de: '2026-10-17', ate: '2026-10-17', entra: 0, sai: 0, total: -10546 },
    { tipo: 'faixa', de: '2026-10-18', ate: '2026-10-24', entra: 0, sai: 0, total: -10546 },
    { tipo: 'dia', de: '2026-10-25', ate: '2026-10-25', entra: 160000, sai: 82874, total: 66580 },
    { tipo: 'faixa', de: '2026-10-26', ate: '2026-11-08', entra: 0, sai: 0, total: 66580 },
    { tipo: 'dia', de: '2026-11-09', ate: '2026-11-09', entra: 180000, sai: 175000, total: 71580 },
    { tipo: 'dia', de: '2026-11-10', ate: '2026-11-10', entra: 0, sai: 53077, total: 18503 },
    { tipo: 'faixa', de: '2026-11-11', ate: '2026-11-20', entra: 0, sai: 0, total: 18503 },
    { tipo: 'dia', de: '2026-11-21', ate: '2026-11-21', entra: 0, sai: 9707, total: 8796 },
    { tipo: 'faixa', de: '2026-11-22', ate: '2026-11-24', entra: 0, sai: 0, total: 8796 },
    { tipo: 'dia', de: '2026-11-25', ate: '2026-11-25', entra: 160000, sai: 28167, total: 140629 },
  ]);
});

// B1-3: janela padrão = hoje + 30 dias, teto zero (B1, critério 3; Caso-de-Teste-17-10, "Teto").
test('B1-3: sem ate, tetoValidoAte = hoje + 30 dias e teto = 0 no caso de 17/10', () => {
  const saida = calcularProjecao(casoSemAte());
  assert.equal(saida.tetoValidoAte, '2026-11-16');
  assert.equal(saida.teto, 0);
});

// B1-3: a regra "hoje + 30 dias" (D37, citada no B1 critério 3) vale em outros meses e anos.
test('B1-3: janela padrão cruza fim de ano (2026-12-15 + 30 = 2027-01-14)', () => {
  const saida = calcularProjecao(casoSemAte({ hoje: '2026-12-15', contas: [{ id: 'c', saldo: 0 }], previstos: [], faturas: [] }));
  assert.equal(saida.tetoValidoAte, '2027-01-14');
});

// B1-3: ano bissexto (fevereiro de 2028 tem 29 dias).
test('B1-3: janela padrão em ano bissexto (2028-02-10 + 30 = 2028-03-11)', () => {
  const saida = calcularProjecao(casoSemAte({ hoje: '2028-02-10', contas: [{ id: 'c', saldo: 0 }], previstos: [], faturas: [] }));
  assert.equal(saida.tetoValidoAte, '2028-03-11');
});

// B1-4: teto filtrado por `de` (B1, critério 4; Caso-de-Teste-17-10, "Teto", linha 26/10 a 24/11).
test('B1-4: com de = 26/10 e ate = 24/11, teto = 8796 e os totais partem do saldo de hoje', () => {
  const saida = calcularProjecao(casoCompleto({ de: '2026-10-26', ate: '2026-11-24' }));
  assert.equal(saida.teto, 8796);
  assert.deepEqual(resumoLinhas(saida), [
    { tipo: 'faixa', de: '2026-10-26', ate: '2026-11-08', entra: 0, sai: 0, total: 66580 },
    { tipo: 'dia', de: '2026-11-09', ate: '2026-11-09', entra: 180000, sai: 175000, total: 71580 },
    { tipo: 'dia', de: '2026-11-10', ate: '2026-11-10', entra: 0, sai: 53077, total: 18503 },
    { tipo: 'faixa', de: '2026-11-11', ate: '2026-11-20', entra: 0, sai: 0, total: 18503 },
    { tipo: 'dia', de: '2026-11-21', ate: '2026-11-21', entra: 0, sai: 9707, total: 8796 },
    { tipo: 'faixa', de: '2026-11-22', ate: '2026-11-24', entra: 0, sai: 0, total: 8796 },
  ]);
});

// B1-17: itens do dia 25/10 (B1, critério 17; Caso-de-Teste-17-10, "Previstos").
test('B1-17: dia 25/10 tem 5 itens com origem, sentido, valor e atrasado = false', () => {
  const dia = diaDe(calcularProjecao(casoCompleto()), '2026-10-25');
  assert.equal(dia.itens.length, 5);
  const esperados = [
    { descricao: 'salário', sentido: 'entrada', valor: 160000 },
    { descricao: 'óculos', sentido: 'saida', valor: 20000 },
    { descricao: 'hospedagem', sentido: 'saida', valor: 8167 },
    { descricao: 'Vivo', sentido: 'saida', valor: 9707 },
    { descricao: 'aporte da viagem', sentido: 'saida', valor: 45000 },
  ];
  for (const e of esperados) {
    const item = dia.itens.find((i: any) => i.descricao === e.descricao);
    assert.ok(item, `item "${e.descricao}" ausente`);
    assert.equal(item.origem, 'previsto');
    assert.equal(item.sentido, e.sentido);
    assert.equal(item.valor, e.valor);
    assert.equal(item.atrasado, false);
    assert.equal(item.dataOriginal, '2026-10-25');
  }
  // Soma dos itens bate com entra e sai da linha.
  const soma = (s: string) => dia.itens.filter((i: any) => i.sentido === s).reduce((a: number, i: any) => a + i.valor, 0);
  assert.equal(soma('entrada'), dia.entra);
  assert.equal(soma('saida'), dia.sai);
});

// B1-18: itens do dia 10/11 são as duas faturas (B1, critério 18; Caso-de-Teste-17-10, "Faturas").
test('B1-18: dia 10/11 tem 2 itens de fatura: Fatura Santander (26079) e Fatura PicPay (26998)', () => {
  const dia = diaDe(calcularProjecao(casoCompleto()), '2026-11-10');
  assert.equal(dia.itens.length, 2);
  const santander = dia.itens.find((i: any) => i.descricao === 'Fatura Santander');
  const picpay = dia.itens.find((i: any) => i.descricao === 'Fatura PicPay');
  assert.ok(santander && picpay);
  for (const item of [santander, picpay]) {
    assert.equal(item.origem, 'fatura');
    assert.equal(item.sentido, 'saida');
    assert.equal(item.atrasado, false);
    assert.equal(item.dataOriginal, '2026-11-10');
  }
  assert.equal(santander.valor, 26079);
  assert.equal(picpay.valor, 26998);
});

// B1-19: linha faixa sem itens; em todo dia, a soma dos itens bate com entra e sai (B1, critério 19).
test('B1-19: faixas têm itens vazios e, em todo dia, a soma dos itens bate com entra e sai', () => {
  const saida = calcularProjecao(casoCompleto());
  for (const l of saida.linhas) {
    if (l.tipo === 'faixa') {
      assert.deepEqual(l.itens, []);
      continue;
    }
    const entradas = l.itens.filter((i: any) => i.sentido === 'entrada').reduce((a: number, i: any) => a + i.valor, 0);
    const saidas = l.itens.filter((i: any) => i.sentido === 'saida').reduce((a: number, i: any) => a + i.valor, 0);
    assert.equal(entradas, l.entra, `entra do dia ${l.de}`);
    assert.equal(saidas, l.sai, `sai do dia ${l.de}`);
  }
});
