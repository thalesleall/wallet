// Janela, ordem de entrada, ordem dos itens e dataOriginal.
// Fontes: B1-Nucleo-de-Calculo.md ("Critérios de aceitação", 13, 14, 20, 21) e Regras-de-Calculo.md (R5, R6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProjecao } from '../../../api/src/projecao/calcular-projecao.ts';
import { casoCompleto, casoSemAte, diaDe, somenteContas } from './_fixtures.ts';

// B1-13: data depois de `ate` não entra em linhas nem no teto (B1, critério 13).
test('B1-13: lançamento depois de ate não altera linhas nem teto', () => {
  const base = calcularProjecao(casoCompleto());
  const saida = calcularProjecao(
    casoCompleto({
      previstos: [
        ...casoCompleto().previstos,
        { id: 'fora-1201', descricao: 'Fora da janela', data: '2026-12-01', valor: 9999999, sentido: 'saida', estado: 'previsto' },
      ],
    }),
  );
  assert.deepEqual(saida.linhas, base.linhas);
  assert.equal(saida.teto, base.teto);
  for (const l of saida.linhas) assert.ok(l.ate <= '2026-11-25', `linha depois de ate: ${l.ate}`);
});

// B1-13: na janela padrão, a Vivo de 21/11 (fora de 16/11) não altera teto nem linhas (Caso-de-Teste-17-10, "Teto").
test('B1-13: na janela padrão, lançamento depois de 16/11 não altera linhas nem teto', () => {
  const base = calcularProjecao(casoSemAte({ previstos: casoSemAte().previstos.filter((p) => p.data <= '2026-11-16') }));
  const saida = calcularProjecao(casoSemAte());
  assert.equal(saida.tetoValidoAte, '2026-11-16');
  assert.deepEqual(saida.linhas, base.linhas);
  assert.equal(saida.teto, base.teto);
});

// B1-14: previstos e faturas fora de ordem geram a mesma saída (B1, critério 14).
test('B1-14: previstos e faturas em ordem invertida geram a mesma saída', () => {
  const ordenada = calcularProjecao(casoCompleto());
  const invertida = calcularProjecao(
    casoCompleto({
      previstos: [...casoCompleto().previstos].reverse(),
      faturas: [...casoCompleto().faturas].reverse(),
    }),
  );
  assert.deepEqual(invertida, ordenada);
});

const idsDoDia = (saida: any) => diaDe(saida, '2026-10-20').itens.map((i: any) => i.id);

// B1-20: ordem fixa dos itens: entradas antes de saídas, depois descricao, depois id (B1, critério 20; R5a).
// Descrição repetida ("banana") desempata por id.
test('B1-20: itens do dia seguem entradas antes de saídas, depois descricao e id', () => {
  const entrada = somenteContas([10000], {
    previstos: [
      { id: 'e-2', descricao: 'zebra', data: '2026-10-20', valor: 100, sentido: 'entrada', estado: 'previsto' },
      { id: 'e-1', descricao: 'abacaxi', data: '2026-10-20', valor: 200, sentido: 'entrada', estado: 'previsto' },
      { id: 's-3', descricao: 'caju', data: '2026-10-20', valor: 300, sentido: 'saida', estado: 'previsto' },
      { id: 's-2', descricao: 'banana', data: '2026-10-20', valor: 400, sentido: 'saida', estado: 'previsto' },
      { id: 's-1', descricao: 'banana', data: '2026-10-20', valor: 500, sentido: 'saida', estado: 'previsto' },
    ],
  });
  const esperado = ['e-1', 'e-2', 's-1', 's-2', 's-3'];
  assert.deepEqual(idsDoDia(calcularProjecao(entrada)), esperado);
  // Mesma entrada em ordem invertida: mesma lista de itens.
  const invertida = { ...entrada, previstos: [...entrada.previstos].reverse() };
  assert.deepEqual(idsDoDia(calcularProjecao(invertida)), esperado);
});

// B1-20: ordem pt-BR sem diferenciar maiúsculas e acentos, entradas antes de saídas (B1, critério 20; Convenções).
// Em ordem de código, "Bônus" e "Salário" viriam antes de "aluguel", e "Vivo" antes de "óculos".
test('B1-20: descrições com maiúsculas e acentos misturados seguem a colação pt-BR (base)', () => {
  const previstos = [
    { id: 'e-1', descricao: 'Salário', data: '2026-10-20', valor: 100, sentido: 'entrada', estado: 'previsto' },
    { id: 'e-2', descricao: 'aluguel', data: '2026-10-20', valor: 200, sentido: 'entrada', estado: 'previsto' },
    { id: 'e-3', descricao: 'Bônus', data: '2026-10-20', valor: 300, sentido: 'entrada', estado: 'previsto' },
    { id: 's-1', descricao: 'Vivo', data: '2026-10-20', valor: 400, sentido: 'saida', estado: 'previsto' },
    { id: 's-2', descricao: 'óculos', data: '2026-10-20', valor: 500, sentido: 'saida', estado: 'previsto' },
    { id: 's-3', descricao: 'hospedagem', data: '2026-10-20', valor: 600, sentido: 'saida', estado: 'previsto' },
    { id: 's-4', descricao: 'aporte da viagem', data: '2026-10-20', valor: 700, sentido: 'saida', estado: 'previsto' },
  ];
  const entrada = somenteContas([10000], { previstos });
  const esperado = ['e-2', 'e-3', 'e-1', 's-4', 's-3', 's-2', 's-1'];
  assert.deepEqual(idsDoDia(calcularProjecao(entrada)), esperado);
  const invertida = { ...entrada, previstos: [...previstos].reverse() };
  assert.deepEqual(idsDoDia(calcularProjecao(invertida)), esperado);
});

// B1-21: atrasado tem atrasado = true e dataOriginal vencida; não atrasado tem dataOriginal = data do dia.
test('B1-21: itens atrasados marcam atrasado = true com dataOriginal vencida; os demais, dataOriginal = data do dia', () => {
  const saida = calcularProjecao(
    somenteContas([10000], {
      previstos: [
        { id: 'atr', descricao: 'Atrasado', data: '2026-10-10', valor: 1000, sentido: 'saida', estado: 'previsto' },
        { id: 'normal', descricao: 'Normal', data: '2026-10-25', valor: 2000, sentido: 'saida', estado: 'previsto' },
      ],
      faturas: [{ id: 'fat-atr', descricao: 'Fatura Itaú', vencimento: '2026-10-12', valor: 3000, estado: 'pendente' }],
    }),
  );
  const hoje = diaDe(saida, '2026-10-17');
  const atr = hoje.itens.find((i: any) => i.id === 'atr');
  const fat = hoje.itens.find((i: any) => i.id === 'fat-atr');
  assert.equal(atr.atrasado, true);
  assert.equal(atr.dataOriginal, '2026-10-10');
  assert.equal(fat.atrasado, true);
  assert.equal(fat.dataOriginal, '2026-10-12');
  assert.equal(fat.origem, 'fatura');

  const normal = diaDe(saida, '2026-10-25').itens.find((i: any) => i.id === 'normal');
  assert.equal(normal.atrasado, false);
  assert.equal(normal.dataOriginal, '2026-10-25');
});
