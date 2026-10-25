# Design de Interface e Experiência Mobile-First

> Sources: Documento de Design — Hub Financeiro Mobile-First, 2026-10-25
> Raw: [DDI](../../raw/hub-financeiro/2026-10-25-ddi-design-mobile-first.md)
> Updated: 2026-10-25

## Overview

O design da interface adota uma abordagem estritamente mobile-first (largura base de 360–430 px), priorizando visualização progressiva de detalhes, clareza sobre o fluxo de caixa familiar e distinção inequívoca entre os contextos Casa e Pessoal.

## Princípios de Experiência

1. **Visão Antes de Detalhe:** Apresentar primeiro os números consolidados de saldo disponível, entradas x saídas do mês e faturas abertas; o detalhamento é acessado sob demanda.
2. **Separação Casa vs. Pessoal:** O seletor de contexto no topo altera dinamicamente todos os totais, gráficos e filtros sem misturar despesas compartilhadas com gastos individuais.
3. **Regra de Cartão de Crédito:**
   - Compra no cartão é despesa na data do lançamento.
   - Pagamento de fatura é liquidação financeira, não gerando despesa duplicada.
4. **Estados de Interface Obrigatórios:**
   - Carregando com skeleton.
   - Sucesso com dados completos.
   - Dados parciais (sinalizando ausência de campos da instituição sem substituir por zero).
   - Erro de sincronização (preservando o último dado válido e alertando a data da última atualização).

## See Also
- [Visão Geral e Arquitetura](visao-geral-arquitetura.md)
- [Status do Projeto e Próximos Passos](status-e-proximos-passos.md)
