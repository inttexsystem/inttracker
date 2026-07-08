# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `e5c872c` — Record export package real-lite smoke and add data/exports/ to gitignore (G10-C)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOC-INGESTOR-G10-C-EXPORT-PACKAGE-REAL-LITE-SMOKE

## Fase anterior
G10-B — Export package (comando + testes)

## Objetivo da fase G10-C
Validar `export:package --pedido PED-99-2026` contra dados reais-lite existentes.

### Pedido usado
PED-99-2026 (documento teste: nf/xml/entrada, status accepted)

### Comando executado
```
npm.cmd run export:package -- --pedido PED-99-2026 --output data\exports\packages\smoke-g10c
```

### Pacote gerado — 4 arquivos

**document-events.jsonl** (2 eventos):
- `document.accepted` — ingestion_event_id=ebfd..., status=accepted, Drive links presentes
- `document.linked` — ingestion_event_id=c9fe..., status=pending_app_acceptance, Drive links presentes
- event_id legado = document_id em ambos
- reason não aplicável (não há rejected)

**manifest.json** (1 documento):
- pedido: PED-99-2026
- status: accepted, tipo: nf, formato: xml, direcao_nf: entrada
- drive_web_view_link presente, storage_uri presente

**summary.json**:
- totalEvents: 2, totalDocuments: 1
- eventsByType: document.linked=1, document.accepted=1
- documentsWithDriveLink: 1

**README.md**:
- Instruções de idempotência (ingestion_event_id)
- event_id legado documentado
- Visualização via drive_web_view_link
- Sem Supabase/backend

### Garantias
- Nenhum scan/assign/sync/link/accept/reject executado
- Google/Drive não chamado
- Controle de Tapetes não tocado
- `data/app.db` não alterado
- Pacote gerado removido; arquivos não commitados
- `.gitignore` atualizado com `data/exports/`

### Riscos remanescentes
1. Bloqueio de mismatch entrada/saída deferido
2. event_id v2 deferido
3. Controle de Tapetes ainda não implementa consumo de outbox

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G11-CONTROLE-TAPETES-WATCHER
Foco: implementar consumo de outbox no Controle de Tapetes. Exibir documentos no pedido via drive_web_view_link. A implementação é no repositório do Controle de Tapetes.
