# Ravatex Documents Ingestor

Módulo separado para ingestão de documentos (XML/PDF) via Gmail para o sistema Ravatex.

## Por que está fora do app principal

- **Responsabilidade única**: o app principal (Controle de Tapetes) gerencia pedidos, clientes e produção. A captura de documentos é um processo assíncrono separado.
- **Segurança**: o ingestor lida com OAuth Gmail e anexos; manter isso isolado reduz risco de vazamento de credenciais.
- **Independência**: pode ser executado sob demanda (CLI), não como watcher contínuo.
- **Acoplamento futuro**: via outbox JSONL + integração manual no app principal.

## Stack

- Node.js 22 + TypeScript (ESM strict)
- SQLite (better-sqlite3)
- googleapis (Gmail API)
- Vitest para testes
- Commander para CLI

## Configuração

1. Copie `.env.example` para `.env` e preencha:
   ```
   GOOGLE_CLIENT_ID=seu-client-id
   GOOGLE_CLIENT_SECRET=seu-client-secret
   GOOGLE_REDIRECT_URI=http://localhost
   ```

2. Crie credenciais OAuth 2.0 no [Google Cloud Console](https://console.cloud.google.com/):
   - Habilite Gmail API
   - Baixe o JSON e salve como `credentials.json` na raiz (protegido pelo `.gitignore`)

3. Instale dependências:
   ```bash
   npm install
   ```

## Como usar

### Scanner (preparado — não processa emails reais automaticamente)
```bash
npm run scan
```
Lista quantos documentos seriam detectados sem processar emails.

### Listar pendentes
```bash
npm run list:pending
```

### Atribuir Pedido manualmente
```bash
npm run assign -- --id <document_id_ou_email_id> --pedido 25/2026
```

### Exportar eventos
```bash
npm run export:events
```

### Desenvolvimento
```bash
npm run dev
```

## Estrutura de arquivos

```
data/
  documents/
    pendentes/        # Documentos antes da atribuição
    pedidos/          # Documentos organizados por Pedido
      PED-25-2026/
        nf/
        romaneio/
        desconhecido/
        manifest.json
  outbox/             # Eventos JSONL para consumo do app principal
  app.db              # SQLite local
```

## Fluxo

1. **Scan**: conecta Gmail, baixa anexos novos, classifica, salva em `pendentes/`
2. **Assign**: usuário atribui Pedido manualmente → move para `pedidos/PED-XX-YYYY/`, gera `manifest.json`, escreve evento no outbox
3. **Integração futura**: app principal lê outbox, mostra notificação no Pedido, usuário aceita/rejeita
4. **Aceite**: documento é incorporado ao Pedido no app principal

## Proibições nesta fase

- ❌ Sem Supabase
- ❌ Sem processamento real automático de email
- ❌ Sem OCR
- ❌ Sem identificação automática de Pedido
- ❌ Sem watcher/daemon contínuo
