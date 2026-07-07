# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `257a352` (nenhum novo commit — smoke operacional)
- Status: clean

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOC-INGESTOR-G9-C-MANIFEST-REAL-SMOKE

## Fase anterior
G9-B — Manifest local exportável + sync scaffold

## Objetivo da fase G9-C
Validar sync real controlado de manifest para pedido PED-99-2026 com Google Drive.

### Documento teste
- Gmail message ID: `19f3...e1`
- Doc ID: `cda1...05`
- Tipo: nf, formato: xml, direção: entrada
- Status: accepted
- Pedido: PED-99-2026

### Comandos executados

**Parte 1 — Baseline:**
```
export:manifest --pedido PED-99-2026 → 1 documento (accepted), drive_file_id presente
inspect → accepted, PED-99-2026, 2 eventos (linked + accepted)
report → 1 accepted, 2 pending, 0 rejected
```

**Parte 2 — Dry-run:**
```
sync:manifest --pedido PED-99-2026
→ DRY-RUN — no Google Drive calls performed. Would sync 1 documents.
```

**Parte 3 — Sync real:**
```
sync:manifest --pedido PED-99-2026 --confirm-real-google
→ Synced 1 documents for pedido PED-99-2026.
→ Drive file: 1Tp***Na
→ Storage URI: gdrive://file/1Tp***Na
```

**Parte 4 — Post-check:**
```
inspect → accepted (inalterado), same drive_file_id (1ao8qFfl***Vh), same updated_at
export:events → 2 eventos (linked + accepted, inalterados)
report → 1 accepted, 2 pending (inalterado)
```

### Resultado
- **Sync real: SUCESSO** (não stub — OAuth token válido, upload Drive confirmado)
- Manifest Drive criado/atualizado: `1Tp***Na`
- Documento **não foi movido** (drive_file_id inalterado)
- Status **não foi alterado** (accepted mantido)
- Outbox **não foi alterado** (2 eventos mantidos)
- Nenhum scan/assign/link/accept/reject executado
- Apenas manifest foi tocado no Drive

### Garantias
- Nenhum scan real executado
- Nenhum assign real executado
- Nenhum link/accept/reject executado
- Apenas Google Drive chamado para upload/update do manifest
- `data/app.db` não alterado indevidamente
- Nenhum dado commitado
- Git status clean

### Riscos remanescentes
1. Bloqueio de mismatch entrada/saída deferido
2. event_id v2 deferido
3. Controle de Tapetes ainda não consome outbox

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G10-CONTROLE-TAPETES-INTEGRATION
Foco: primeiro consumo real do outbox pelo Controle de Tapetes. Visualização via drive_web_view_link. Manifest sincronizável disponível como snapshot derivado.
