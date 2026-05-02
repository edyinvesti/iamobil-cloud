---
title: IAmobil
emoji: 🏠
colorFrom: blue
colorTo: pink
sdk: docker
pinned: false
---

# IAmobil

IAmobil é um ecossistema inteligente para gestão imobiliária e corretores autônomos.

O sistema utiliza agentes de IA (IA-Sentinels) para orquestrar leads, CRM e automação de marketing em um ambiente integrado.

## Funcionalidades Principais

- **Orquestração de Agentes**: Gestão de leads e automação via Hermes AI.
- **Gestor Corretor**: Portal dedicado para parceiros imobiliários.
- **Mensageria**: Integração com Telegram e WhatsApp através do Messaging Hub.
- **Auto-Healing**: Vigilância autônoma e reparo de sistema via Autofix Engine.

## Stack Tecnológica

- **Backend**: Node.js, Next.js, Hermes AI, SQLite.
- **Frontend**: Vite, Three.js (Visualização), React.
- **Monitoramento**: IA-Sentinel.

## Início Rápido

### Requisitos
- Node.js 20+
- PM2 (para gerenciamento de processos)

### Instalação
```bash
npm install
npm run build
```

### Inicialização
Para ligar o sistema completo:
```bash
npx pm2 start ecosystem.config.js
```

## Documentação

Veja os detalhes em `docs/` para arquitetura e guias de uso.

