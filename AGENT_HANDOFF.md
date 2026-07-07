# AGENT HANDOFF

## Branch/HEAD/Status
### documentos-ingestor (este repositório)
- Branch: master
- HEAD: `9c9898f` — Record drive manifest sync design (G9-A)

### Controle de Tapetes (staging/work/app-next)
- HEAD canônico: `997486a`

## Fase concluída
RAVATEX-DOC-INGESTOR-G9-A-DRIVE-MANIFEST-SYNC-DESIGN

## Fase anterior
G8-E — Pacote de handoff de integração (exemplos JSONL, regras, idempotência)

## Objetivo da fase G9-A
Diagnosticar e desenhar o modelo de sincronização do manifest Drive sem implementar patch funcional.

### Diagnóstico principal
- Manifest Drive é criado APENAS por `realAssign.ts` — é snapshot do assign real
- Link/accept/reject são local-only e NÃO tocam manifest
- `realAssign.ts:73` bloqueia documentos linked (`if (doc.status !== 'pending')`)
- `manifest.ts:117` em realAssign escreve em `/dev/null` (placeholder local)
- `drive.ts:202-265` uploadManifest cria/atualiza manifest.json no Drive

### Fonte de verdade
- **SQLite** = estado operacional (status, pedido, taxonomy)
- **Outbox JSONL** = eventos (contrato de integração)
- **Manifest Drive** = snapshot derivado (deve ser sincronizável, não fonte primária)

### Opções avaliadas (4)

| Opção | Veredito | Risco |
|---|---|---|
| 1 — Nada | Não atende | linked/rejected invisíveis |
| 2 — Manifest local exportável | Complementar | Baixo |
| **3 — Sync:manifest Drive** | **Recomendado** | Médio (dry-run protege) |
| 4 — Revisar assign real | Não recomendado | Alto (mistura rotas) |

### Recomendação
Implementar opção 2 + 3: comando `export:manifest` (local, sem Drive) e `sync:manifest` (Drive com `--confirm-real-google`), sem alterar assign real, sem mover arquivos.

### Decisões documentais
- Design completo em `docs/architecture/G9_DRIVE_MANIFEST_SYNC_DESIGN.md`
- Manifest classificado como snapshot derivado, não fonte de verdade
- Integração Controle de Tapetes permanece baseada em outbox (G8-E)

### Arquivos alterados/criados
- `docs/architecture/G9_DRIVE_MANIFEST_SYNC_DESIGN.md` — novo (design completo + ordem)
- `PROJECT_STATE.md`, `AGENT_HANDOFF.md` — atualização

### Riscos remanescentes
1. Bloqueio de mismatch entrada/saída deferido
2. event_id v2 deferido
3. Sync manifest não implementado ainda

### Próxima fase recomendada
RAVATEX-DOC-INGESTOR-G9-B-MANIFEST-LOCAL-AND-SYNC
Foco: export:manifest local + sync:manifest Drive com --confirm-real-google. Manifest reflete linked/accepted/rejected.
