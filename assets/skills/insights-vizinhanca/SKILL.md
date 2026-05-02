---
name: Insights de Vizinhança
description: Fornece dados detalhados sobre o bairro, infraestrutura e conveniências.
metadata: {"openclaw":{"skillKey":"insights-vizinhanca"}}
---

# Insights de Vizinhança

Esta skill ajuda o cliente a decidir o local ideal, fornecendo informações sobre o que tem ao redor do imóvel.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "como é o bairro",
      "tem escola perto",
      "é seguro",
      "supermercado próximo",
      "transporte público",
      "pontos de interesse"
    ]
  },
  "movement": {
    "target": "desk",
    "skipIfAlreadyThere": true
  }
}
```

## Instruções de Operação

1. **Localização**: Identifique o bairro ou o imóvel que o cliente está consultando.
2. **Pesquisa Semântica**: Utilize `semantic_search` para buscar no catálogo notas sobre a localização do imóvel.
3. **Diferenciais**: Destaque pelo menos 3 pontos fortes da região (ex: parques, proximidade com centros comerciais, facilidade de acesso).
4. **Tom**: Seja consultivo e honesto, ajudando o cliente a visualizar a rotina dele naquele lugar.
