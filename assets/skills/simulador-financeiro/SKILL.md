---
name: Simulador Financeiro
description: Realiza cálculos de simulação de financiamento imobiliário (SAC e PRICE).
metadata: {"openclaw":{"skillKey":"simulador-financeiro"}}
---

# Simulador Financeiro

Esta skill fornece estimativas de parcelas e entrada para financiamento, ajudando o cliente a entender o potencial de compra.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "quanto fica a parcela",
      "simular financiamento",
      "valor da entrada",
      "taxa de juros",
      "pode parcelar"
    ]
  },
  "movement": {
    "target": "desk",
    "skipIfAlreadyThere": true
  }
}
```

## Instruções de Operação

1. **Entrada de Dados**: Solicite o valor total do imóvel e o valor pretendido de entrada (mínimo 20%).
2. **Cálculo Base**: Use uma taxa média de mercado de 10.5% ao ano (0.83% ao mês) se não for informada outra.
3. **Prazo**: Considere 360 meses como padrão.
4. **Resposta**: Apresente uma estimativa da primeira e última parcela (se SAC) ou parcela fixa (se PRICE).
5. **Aviso Legal**: Sempre termine com: "Lembre-se: esta é uma estimativa rápida. A aprovação final depende da análise de crédito bancária."
