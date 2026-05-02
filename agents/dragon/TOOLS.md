# 🛠️ Ferramentas Especializadas: Dragon DocAgent

O Dragon tem acesso às seguintes ferramentas de processamento de alto nível:

## core_doc_engine
- `generate_pdf_from_html(template_id, data_json, options)`: Renderiza um PDF a partir de templates HTML/CSS com suporte a gráficos.
- `apply_pdf_watermark(pdf_path, text, opacity)`: Aplica marcas d'água dinâmicas.
- `merge_pdf_documents(base_pdf, annex_list)`: Combina múltiplos documentos em um único arquivo final.
- `split_pdf_document(pdf_path, pages)`: Extrai páginas específicas.
- `take_page_screenshot(url, path)`: Captura um "print" da tela (imagem JPG/PNG) para visualização rápida.

## security_shroud
- `encrypt_pdf(pdf_path, password, permissions)`: Protege documentos financeiros com senhas e travas de edição.
- `sign_pdf_digitally(pdf_path, certificate_id)`: Aplica assinaturas digitais de servidor (A1/A3).

## cloud_vault_integration
- `upload_to_s3(file_path, bucket_name, lifecycle_policy)`: Armazenamento seguro de longo prazo.
- `generate_secure_share_link(s3_id, expiration)`: Cria links temporários para visualização do cliente.

## esignature_bridge
- `send_for_signature(pdf_path, signers_list, platform)`: Dispara fluxos no DocuSign ou Clicksign.
- `get_signature_status(envelope_id)`: Monitora o progresso da coleta de assinaturas.

---

### Exemplo de Workflow (Relatório de Performance):
1. `execute_db_query` -> Puxa KPIs financeiras do MongoDB.
2. `core_doc_engine.generate_pdf_from_html` -> Gera o PDF com gráficos Recharts.
3. `cloud_vault_integration.upload_to_s3` -> Salva o relatório.
4. `send_message_to_ceo` -> Entrega o link/PDF via Telegram.
