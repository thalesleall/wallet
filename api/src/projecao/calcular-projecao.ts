export type Conta = {
  id: string;
  saldo: number;
};

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

export type EntradaProjecao = {
  hoje: string;
  ate?: string;
  de?: string;
  contas: Conta[];
  previstos: Previsto[];
  faturas: Fatura[];
};

export type ItemProjecao = {
  origem: 'previsto' | 'fatura';
  id: string;
  descricao: string;
  valor: number;
  sentido: 'entrada' | 'saida';
  atrasado: boolean;
  dataOriginal: string;
};

export type LinhaProjecao = {
  tipo: 'dia' | 'faixa';
  de: string;
  ate: string;
  entra: number;
  sai: number;
  total: number;
  itens: ItemProjecao[];
};

export type AtrasadoProjecao = {
  tipo: 'previsto' | 'fatura' | 'reserva';
  id: string;
  descricao: string;
  valor: number;
  sentido: 'entrada' | 'saida';
  dataOriginal: string;
};

export type ContaNegativa = {
  conta: string;
  primeiroDia: string;
  menorSaldo: number;
};

export type SaidaProjecao = {
  linhas: LinhaProjecao[];
  teto: number;
  tetoValidoAte: string;
  atrasados: AtrasadoProjecao[];
  contasNegativas: ContaNegativa[];
};

function adicionarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

function compararItens(a: ItemProjecao, b: ItemProjecao): number {
  if (a.sentido !== b.sentido) {
    return a.sentido === 'entrada' ? -1 : 1;
  }
  const compDesc = a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' });
  if (compDesc !== 0) return compDesc;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function calcularProjecao(entrada: EntradaProjecao): SaidaProjecao {
  const fimJanela = entrada.ate ?? adicionarDias(entrada.hoje, 30);

  // 1. Atrasados
  const atrasados: AtrasadoProjecao[] = [];
  for (const p of entrada.previstos) {
    if (p.estado !== 'previsto') continue;
    if (p.data < entrada.hoje) {
      const isReserva = Boolean(p.reserva && p.reserva.trim() !== '');
      atrasados.push({
        tipo: isReserva ? 'reserva' : 'previsto',
        id: p.id,
        descricao: p.descricao,
        valor: p.valor,
        sentido: p.sentido,
        dataOriginal: p.data,
      });
    }
  }
  for (const f of entrada.faturas) {
    if (f.estado !== 'pendente') continue;
    if (f.vencimento < entrada.hoje) {
      atrasados.push({
        tipo: 'fatura',
        id: f.id,
        descricao: f.descricao,
        valor: f.valor,
        sentido: 'saida',
        dataOriginal: f.vencimento,
      });
    }
  }
  atrasados.sort((a, b) => {
    if (a.dataOriginal !== b.dataOriginal) {
      return a.dataOriginal < b.dataOriginal ? -1 : 1;
    }
    const cmpDesc = a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' });
    if (cmpDesc !== 0) return cmpDesc;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  // 2. Alerta por conta (contasNegativas)
  const deltasPorConta = new Map<string, Map<string, number>>();
  for (const p of entrada.previstos) {
    if (p.estado !== 'previsto') continue;
    if (p.reserva && p.reserva.trim() !== '') continue;
    if (!p.conta) continue;

    const dataEfetiva = p.data < entrada.hoje ? entrada.hoje : p.data;
    if (dataEfetiva > fimJanela) continue;

    let contaMap = deltasPorConta.get(p.conta);
    if (!contaMap) {
      contaMap = new Map<string, number>();
      deltasPorConta.set(p.conta, contaMap);
    }

    const delta = p.sentido === 'entrada' ? p.valor : -p.valor;
    contaMap.set(dataEfetiva, (contaMap.get(dataEfetiva) ?? 0) + delta);
  }

  const contasNegativas: ContaNegativa[] = [];
  for (const c of entrada.contas) {
    let saldo = c.saldo;
    let menorSaldo = saldo;
    let primeiroDia: string | null = null;

    if (saldo < 0) {
      primeiroDia = entrada.hoje;
    }

    const contaMap = deltasPorConta.get(c.id);

    if (contaMap && contaMap.has(entrada.hoje)) {
      saldo += contaMap.get(entrada.hoje)!;
    }
    if (saldo < 0) {
      if (primeiroDia === null) {
        primeiroDia = entrada.hoje;
      }
      menorSaldo = Math.min(menorSaldo, saldo);
    }

    if (contaMap) {
      const datas = Array.from(contaMap.keys())
        .filter((d) => d > entrada.hoje && d <= fimJanela)
        .sort();

      for (const d of datas) {
        saldo += contaMap.get(d)!;
        if (saldo < 0) {
          if (primeiroDia === null) {
            primeiroDia = d;
          }
          menorSaldo = Math.min(menorSaldo, saldo);
        }
      }
    }

    if (primeiroDia !== null) {
      contasNegativas.push({
        conta: c.id,
        primeiroDia,
        menorSaldo,
      });
    }
  }

  contasNegativas.sort((a, b) => {
    if (a.primeiroDia !== b.primeiroDia) {
      return a.primeiroDia < b.primeiroDia ? -1 : 1;
    }
    const cmp = a.conta.localeCompare(b.conta, 'pt-BR', { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    if (a.conta < b.conta) return -1;
    if (a.conta > b.conta) return 1;
    return 0;
  });

  // 3. Projeção de caixa (linhas e teto)
  const itensPorData = new Map<string, ItemProjecao[]>();

  for (const p of entrada.previstos) {
    if (p.estado !== 'previsto') continue;
    if (p.reserva && p.reserva.trim() !== '') continue;

    const atrasado = p.data < entrada.hoje;
    const dataEfetiva = atrasado ? entrada.hoje : p.data;
    if (dataEfetiva > fimJanela) continue;

    let list = itensPorData.get(dataEfetiva);
    if (!list) {
      list = [];
      itensPorData.set(dataEfetiva, list);
    }
    list.push({
      origem: 'previsto',
      id: p.id,
      descricao: p.descricao,
      valor: p.valor,
      sentido: p.sentido,
      atrasado,
      dataOriginal: p.data,
    });
  }

  for (const f of entrada.faturas) {
    if (f.estado !== 'pendente') continue;

    const atrasado = f.vencimento < entrada.hoje;
    const dataEfetiva = atrasado ? entrada.hoje : f.vencimento;
    if (dataEfetiva > fimJanela) continue;

    let list = itensPorData.get(dataEfetiva);
    if (!list) {
      list = [];
      itensPorData.set(dataEfetiva, list);
    }
    list.push({
      origem: 'fatura',
      id: f.id,
      descricao: f.descricao,
      valor: f.valor,
      sentido: 'saida',
      atrasado,
      dataOriginal: f.vencimento,
    });
  }

  for (const list of itensPorData.values()) {
    list.sort(compararItens);
  }

  let saldoAcumulado = 0;
  for (const c of entrada.contas) {
    saldoAcumulado += c.saldo;
  }

  const itensHoje = itensPorData.get(entrada.hoje) ?? [];
  let entraHoje = 0;
  let saiHoje = 0;
  for (const item of itensHoje) {
    if (item.sentido === 'entrada') entraHoje += item.valor;
    else saiHoje += item.valor;
  }
  saldoAcumulado += entraHoje - saiHoje;

  const linhasCompletas: LinhaProjecao[] = [
    {
      tipo: 'dia',
      de: entrada.hoje,
      ate: entrada.hoje,
      entra: entraHoje,
      sai: saiHoje,
      total: saldoAcumulado,
      itens: itensHoje,
    },
  ];

  const outrasDatas = Array.from(itensPorData.keys())
    .filter((d) => d > entrada.hoje && d <= fimJanela)
    .sort();

  let ultimaDataProcessada = entrada.hoje;

  for (const dataMovimento of outrasDatas) {
    const faixaInicio = adicionarDias(ultimaDataProcessada, 1);
    const faixaFim = adicionarDias(dataMovimento, -1);
    if (faixaInicio <= faixaFim) {
      linhasCompletas.push({
        tipo: 'faixa',
        de: faixaInicio,
        ate: faixaFim,
        entra: 0,
        sai: 0,
        total: saldoAcumulado,
        itens: [],
      });
    }

    const itensDoDia = itensPorData.get(dataMovimento)!;
    let entra = 0;
    let sai = 0;
    for (const item of itensDoDia) {
      if (item.sentido === 'entrada') entra += item.valor;
      else sai += item.valor;
    }
    saldoAcumulado += entra - sai;

    linhasCompletas.push({
      tipo: 'dia',
      de: dataMovimento,
      ate: dataMovimento,
      entra,
      sai,
      total: saldoAcumulado,
      itens: itensDoDia,
    });

    ultimaDataProcessada = dataMovimento;
  }

  const faixaFinalInicio = adicionarDias(ultimaDataProcessada, 1);
  if (faixaFinalInicio <= fimJanela) {
    linhasCompletas.push({
      tipo: 'faixa',
      de: faixaFinalInicio,
      ate: fimJanela,
      entra: 0,
      sai: 0,
      total: saldoAcumulado,
      itens: [],
    });
  }

  let linhas: LinhaProjecao[] = [];
  const deFiltro = entrada.de;

  if (deFiltro && deFiltro > entrada.hoje) {
    for (const l of linhasCompletas) {
      if (l.ate < deFiltro) {
        continue;
      }
      if (l.de < deFiltro) {
        linhas.push({
          ...l,
          de: deFiltro,
        });
      } else {
        linhas.push(l);
      }
    }
  } else {
    linhas = linhasCompletas;
  }

  let menorTotal = Number.POSITIVE_INFINITY;
  for (const l of linhas) {
    if (l.total < menorTotal) {
      menorTotal = l.total;
    }
  }
  const teto = menorTotal <= 0 ? 0 : menorTotal;

  return {
    linhas,
    teto,
    tetoValidoAte: fimJanela,
    atrasados,
    contasNegativas,
  };
}
