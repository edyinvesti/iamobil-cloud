---
name: Lead Scoring
description: Qualifica automaticamente o interesse do cliente com base na conversa.
metadata: {"openclaw":{"skillKey":"lead-scoring"}}
---

# Lead Scoring

Esta skill roda silenciosamente para ajudar a priorizar o atendimento dos corretores seniores.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "final de conversa",
      "interesse confirmado",
      "lead registrado"
    ]
  },
  "silent": true
}
```

## Instruções de Operação

1. **Critérios de Pontuação**:
   - **Intenção de Visita**: +4 pontos.
   - **Simulação de Financiamento**: +2 pontos.
   - **Dados completos (Telefone/Email)**: +2 pontos.
   - **Urgência (ex: "preciso mudar logo")**: +2 pontos.
2. **Cálculo**: Atribua uma nota de 0 a 10 ao lead.
3. **Ação**: 
   - Se score >= 7, adicione a flag `#QUENTE` no `save_lead_info`.
   - Se score >= 9, adicione a flag `#URGENTE` e notifique o canal de supervisão.
4. **Registro**: Salve a evolução do interesse na memória persistente do lead.
