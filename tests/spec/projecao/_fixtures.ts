// Dados e helpers dos testes de projeção. Só dados vindos dos docs (B1 e Caso-de-Teste-17-10).
// Nada aqui importa a implementação. Datas são AAAA-MM-DD; valores em centavos.

export type Conta = { id: string; saldo: number };
export type Previsto = {
  id: string;
  descricao: string;
  data: string;
  valor: number;
  sentido: 'entrada' | 'saida';
  conta?: string;
  reserva?: string;
  estado: 'previsto' | 'pago' | 'realizado' | 'cancelado';
};
export type Fatura = {
  id: string;
  descricao: string;
  vencimento: string;
  valor: number;
  estado: 'pendente' | 'paga';
};
export type Entrada = {
  hoje: string;
  ate?: string;
  de?: string;
  contas: Conta[];
  previstos: Previsto[];
  faturas: Fatura[];
};

export const HOJE = '2026-10-17';

// Caso de 17/10, saldos de partida (Caso-de-Teste-17-10.md, "Entradas do teste").
export function contasCaso(): Conta[] {
  return [
    { id: 'santander', saldo: -16301 },
    { id: 'itau', saldo: 5755 },
    { id: 'picpay', saldo: 0 },
  ];
}

// Previstos do caso de 17/10 (Caso-de-Teste-17-10.md, tabela "Previstos").
// Sem `conta`: o doc diz que a conta de origem não é definida por lançamento.
export function previstosCaso(): Previsto[] {
  const p = (
    id: string,
    descricao: string,
    data: string,
    valor: number,
    sentido: 'entrada' | 'saida',
  ): Previsto => ({ id, descricao, data, valor, sentido, estado: 'previsto' });
  return [
    p('salario-1025', 'salário', '2026-10-25', 160000, 'entrada'),
    p('oculos-1025', 'óculos', '2026-10-25', 20000, 'saida'),
    p('hospedagem-1025', 'hospedagem', '2026-10-25', 8167, 'saida'),
    p('vivo-1025', 'Vivo', '2026-10-25', 9707, 'saida'),
    p('aporte-1025', 'aporte da viagem', '2026-10-25', 45000, 'saida'),
    p('seguro-1109', 'seguro-desemprego', '2026-11-09', 180000, 'entrada'),
    p('faculdade-1109', 'faculdade', '2026-11-09', 95000, 'saida'),
    p('aporte-1109', 'aporte da viagem', '2026-11-09', 45000, 'saida'),
    p('divida-1109', 'dívida da vó', '2026-11-09', 35000, 'saida'),
    p('vivo-1121', 'Vivo', '2026-11-21', 9707, 'saida'),
    p('salario-1125', 'salário', '2026-11-25', 160000, 'entrada'),
    p('oculos-1125', 'óculos', '2026-11-25', 20000, 'saida'),
    p('hospedagem-1125', 'hospedagem', '2026-11-25', 8167, 'saida'),
  ];
}

// Faturas do caso de 17/10 (Caso-de-Teste-17-10.md, "Faturas").
export function faturasCaso(): Fatura[] {
  return [
    { id: 'fatura-santander', descricao: 'Fatura Santander', vencimento: '2026-11-10', valor: 26079, estado: 'pendente' },
    { id: 'fatura-picpay', descricao: 'Fatura PicPay', vencimento: '2026-11-10', valor: 26998, estado: 'pendente' },
  ];
}

// Entrada completa do caso de 17/10 com ate = 2026-11-25 (B1, critério 2).
export function casoCompleto(extra: Partial<Entrada> = {}): Entrada {
  return {
    hoje: HOJE,
    ate: '2026-11-25',
    contas: contasCaso(),
    previstos: previstosCaso(),
    faturas: faturasCaso(),
    ...extra,
  };
}

// Entrada do caso de 17/10 sem `ate` (janela padrão, B1 critério 3).
export function casoSemAte(extra: Partial<Entrada> = {}): Entrada {
  return {
    hoje: HOJE,
    contas: contasCaso(),
    previstos: previstosCaso(),
    faturas: faturasCaso(),
    ...extra,
  };
}

// Entrada mínima: só contas, sem lançamentos, sem `ate`.
export function somenteContas(saldos: number[], extra: Partial<Entrada> = {}): Entrada {
  return {
    hoje: HOJE,
    contas: saldos.map((saldo, i) => ({ id: `conta-${i}`, saldo })),
    previstos: [],
    faturas: [],
    ...extra,
  };
}

// Congela recursivamente: se a função mutar a entrada, o teste quebra (ESM é estrito).
export function congelar<T>(v: T): T {
  if (v !== null && typeof v === 'object') {
    for (const x of Object.values(v)) congelar(x);
    Object.freeze(v);
  }
  return v;
}

// Todos os números presentes numa estrutura (para checar que são inteiros).
export function numerosDe(v: unknown, acc: number[] = []): number[] {
  if (typeof v === 'number') acc.push(v);
  else if (v !== null && typeof v === 'object') for (const x of Object.values(v)) numerosDe(x, acc);
  return acc;
}

// Recorte das linhas nos campos que o B1 (critério 2) compara.
export function resumoLinhas(saida: any): object[] {
  return saida.linhas.map((l: any) => ({
    tipo: l.tipo,
    de: l.de,
    ate: l.ate,
    entra: l.entra,
    sai: l.sai,
    total: l.total,
  }));
}

// Linha `dia` de uma data.
export function diaDe(saida: any, data: string): any {
  return saida.linhas.find((l: any) => l.tipo === 'dia' && l.de === data);
}
