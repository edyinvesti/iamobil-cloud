---
name: Protocolo de Segurança (Genio Fix)
description: Diretivas de segurança e boas práticas para manutenção autônoma do sistema.
metadata: {"openclaw":{"skillKey":"security-protocol"}}
---

# 🛡️ Protocolo de Segurança iAmobil

Este skill define as regras de ouro que o Gênio Fix e outros agentes de Engenharia de Software devem seguir ao realizar manutenção no sistema Claw3D/iAmobil.

## 🏁 Gatilho

```json
{
  "activation": {
    "anyPhrases": [
      "reparar",
      "consertar",
      "fix",
      "autofix",
      "manutenção",
      "segurança"
    ]
  },
  "movement": {
    "target": "qa_lab",
    "skipIfAlreadyThere": true
  }
}
```

## 📜 Regras de Operação

### 1. Prevenção de Loops Infinitos
- **Limite de Tentativas**: Se um reparo falhar ou introduzir um novo erro no log, o agente deve PARAR imediatamente e notificar o usuário. O Gênio Fix NÃO deve tentar corrigir suas próprias correções se elas falharem mais de uma vez.
- **Detecção de Mudança**: Antes de cada ação, verifique se o arquivo `REPAROS_IA.md` já contém uma entrada idêntica recente.

### 2. Segurança de Escrita e File System
- **Backup Obrigatório**: SEMPRE crie um arquivo `.bak` antes de usar `write_project_file`.
- **Validação de Sintaxe**: Antes de salvar um arquivo `.js` ou `.ts`, verifique se o novo conteúdo não contém erros de sintaxe óbvios (colchetes abertos, etc).
- **Escrita Cirúrgica**: Prefira editar apenas o bloco de código afetado em vez de reescrever o arquivo inteiro para evitar perda de lógica colateral.

### 3. Restrição de Comandos de Terminal
- **Lista Negra**: Nunca utilize comandos de deleção em massa (`rm -rf`, `del /s`), formatação ou comandos interativos que exijam resposta humana.
- **CWD**: Sempre execute comandos no diretório raiz do projeto.

### 4. Transparência e Logs
- **Relatório de Impacto**: Todo reparo deve ser registrado em `REPAROS_IA.md` com:
  1. O erro original.
  2. O arquivo afetado.
  3. O resumo da alteração realizada.
  4. O status da verificação pós-reparo.

### 5. Reinicialização Segura
- **Cooldown de Restart**: A ferramenta `restart_service` deve ser usada como último recurso e nunca mais de uma vez em um período de 60 minutos.

---
*Este protocolo visa garantir que a autonomia do sistema não comprometa a estabilidade da operação imobiliária.*
