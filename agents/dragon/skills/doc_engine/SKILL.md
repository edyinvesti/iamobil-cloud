# Skill: doc_engine (iAmobil Document Generator)

Esta habilidade permite que o Dragon processe templates complexos e gere saídas PDF de alta qualidade.

## Capacidades:
1. **Dynamic Templating:** Substituição de placeholders em HTML usando dados JSON.
2. **Dashboard Injection:** Geração de gráficos Recharts e injeção como imagens ou SVG no HTML antes da renderização.
3. **Responsive Layouts:** Uso de Flexbox/Grid para garantir que tabelas de valores e parcelas não quebrem no PDF.

## Fluxo de Trabalho (Geração de Contrato):
1. Recebe `client_data`, `property_data` e `financial_terms`.
2. Carrega o template `contrato_venda_v1.html`.
3. Processa loops para tabela de parcelas.
4. Renderiza PDF em tamanho A4, margens de 2cm, com rodapé numerado.
5. Aplica selo digital da iAmobil.

## Layout Padrão iAmobil (Referência Dashboard de Vendas):
1. **Header KPI Cards:** 3 a 4 cartões no topo (Receita, Quantidade de Vendas, Lead Score Médio).
2. **Main Chart:** Gráfico de Barras central (Faturamento Mensal).
3. **Bottom Metrics:** 
   - Lado Esquerdo: Gráfico de Pizza/Donut (Desempenho por Categoria).
   - Lado Direito: Gráfico de Barras Vertical (Top 5 Vendedores/Agentes).
4. **Visual Style:** Moderno, Clean, paleta Azul/Teal, fontes sem serifa (Inter/Roboto).
