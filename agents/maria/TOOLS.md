# 🛠️ Notas de Ferramentas & Convenções - Maria

Este documento orienta a utilização das ferramentas disponíveis para a Maria, garantindo padronização e eficiência administrativa na iAmobil.

## Conjunto de Ferramentas (Core Toolset)

### 📋 Gestão de Leads (`save_lead_info`)
- **Uso:** Sempre que um contato demonstrar interesse real em compra, venda ou locação.
- **Campos:** Nome completo, telefone/e-mail, interesse específico (ex: "Apartamento 3 quartos no Leblon") e notas contextuais.

### 📀 Memória de Ouro (`save_to_memory`)
- **Uso:** Para fatos de longo prazo que não podem ser esquecidos e diretrizes estratégicas.
- **Exemplos:** "Cliente Carlos prefere contatos via WhatsApp", "Foco do CEO em imóveis com liquidez > 15%".

### 🔍 Busca Semântica (`semantic_search`)
- **Uso:** Antes de responder perguntas complexas sobre o catálogo de imóveis ou consultar o histórico da empresa.
- **Vantagem:** Localiza informações por significado contextuai, não apenas por palavras-chave exatas.

### 📝 Redação de Documentos (`draft_document`)
- **Uso:** Criação de contratos, recibos, minutas e relatórios no **Obsidian Vault**.
- **Pastas Padronizadas:**
  - `01_Leads`: Fichas de novos interessados e qualificações.
  - `02_Imoveis`: Descrições técnicas e atualizações de unidades.
  - `03_Clientes`: Histórico e perfil de clientes ativos.
  - `04_Vendas`: Documentação de fechamento e minutas de contratos.
  - `05_Relatorios`: Relatórios administrativos, financeiros e de desempenho.

### 🗄️ Consulta ao Vault (`query_vault`)
- **Uso:** Verificar se já existe um documento para o cliente ou imóvel antes de duplicar informações ou iniciar um novo processo.

## Convenções de Execução

1. **Nomenclatura de Arquivos:** Use PascalCase ou nomes claros com identificadores.
   - *Exemplo:* `Lead_CarlosEduardo.md`, `Contrato_Residencial_Unidade402.md`.
2. **Localização de Salvamento:** Maria deve sempre utilizar as pastas designadas (01 a 05) para manter o Obsidian Vault organizado.
3. **Tom de Escrita:** Documentos gerados devem ser profissionais, institucionais e estruturados em Markdown.
4. **Fonte da Verdade (Source of Truth):** Em caso de conflito, a informação contida no **IAmobil_Vault** (acessada via `query_vault`) é a que deve prevalecer.

## Ciclo de Trabalho Administrativo
1. **Identificar Demanda** -> 2. **Consultar Vault/Memória** -> 3. **Executar Ação (Draft/Save)** -> 4. **Confirmar Registro**.
