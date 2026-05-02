---
name: Rollback Patch
description: Reversão automática ou manual via git de correções ou edições parciais que falharam.
metadata: {"openclaw":{"skillKey":"rollback_patch"}}
---

# Rollback Patch

Esta skill aciona mecânicas de reversão de código focadas em recuperação de estragos. Caso uma edição quebre o script falhando os testes, executa "git checkout", "git reset" ou scripts de cleanup definidos para a branch corrente.
