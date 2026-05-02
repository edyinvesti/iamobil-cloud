---
name: Agendamento Imobiliário (Kaua)
description: Permite ao agente agendar visitas a imóveis e reuniões com corretores seniores.
metadata: {"openclaw":{"skillKey":"agendamento-imobiliario"}}
---

# Agendamento Imobiliário

Esta skill é ativada quando o cliente demonstra intenção clara de visitar um imóvel físico ou quer falar com um especialista. O Kauã usa isso para reter o lead e passar para o fechamento.

## Trigger

```json
{
  "activation": {
    "anyPhrases": [
      "quero visitar",
      "ver o imóvel",
      "marcar horário",
      "agendar visita",
      "conhecer pessoalmente"
    ]
  },
  "movement": {
    "target": "desk",
    "skipIfAlreadyThere": true
  }
}
```

## Instruções de Operação

1. **Verificação de Intencionalidade**: Confirme se o cliente já escolheu um imóvel específico do catálogo.
2. **Coleta de Disponibilidade**: Pergunte qual o melhor dia e período (manhã/tarde) para a visita.
3. **Registro**: Utilize a ferramenta `save_to_memory` para registrar a solicitação de agendamento com a tag `#AGENDAMENTO`.
4. **Confirmação**: Informe ao cliente que um corretor sênior entrará em contato em breve para confirmar o horário exato.
5. **Estado**: Os agendamentos devem ser salvos em `data/visitas_agendadas.json` seguindo o schema:
   ```json
   {
     "cliente": "Nome",
     "imovel_id": "ID",
     "data_preferencia": "YYYY-MM-DD",
     "periodo": "Manhã/Tarde",
     "status": "pendente"
   }
   ```
