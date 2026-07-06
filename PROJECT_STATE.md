# PROJECT STATE

## Objetivo
Ingerir documentos (XML/PDF) recebidos por email (Gmail), classificar, permitir atribuição manual a Pedido e gerar eventos para integração futura com o app principal (Controle de Tapetes).

## Workspace
D:\OneDrive\Programação\Ravatex\documents-ingestor

## Stack
- Node.js 22.22.3 / npm 10.9.8
- TypeScript 5.7 (ESM strict)
- better-sqlite3 (SQLite local)
- googleapis (Gmail API — preparado, não conectado)
- Vitest 3.0
- Commander 13.1

## Contratos locais
- `contracts/document-event.schema.json` — schema do evento de documento detectado
- `contracts/manifest.schema.json` — schema do manifest de Pedido

## Status atual
- Scaffold completo
- 28 testes passando (6 suites)
- Git init pronto
- Nenhum email real processado

## Comandos disponíveis
- `npm run dev` — tsx watch
- `npm run scan` — simula scan (não conecta Gmail real)
- `npm run list:pending` — lista documentos pendentes
- `npm run assign -- --id <id> --pedido <num>` — atribui Pedido
- `npm run export:events` — exporta eventos para JSONL
- `npm test` — roda testes

## Proibições permanentes
- Sem Supabase nesta fase
- Sem processamento automático de email
- Sem OCR
- Sem identificação automática de Pedido
- Sem watcher contínuo

## Última evidência de testes
```
Test Files  6 passed (6)
     Tests  28 passed (28)
```

## Decisão arquitetural
Não integrar Supabase nesta fase. O outbox JSONL é o contrato de integração. O app principal consumirá os eventos quando estiver pronto.
