# Fase 5a — Tecelagem (parte de cima) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o fornecedor de tecelagem registre entregas parciais da "parte de cima" de cada OP em produção (com defeitos por linha), e que o admin acompanhe pelo detalhe da OP (resumo + lista) e possa lançar entregas em nome da tecelagem. A OP permanece `em_producao`.

**Architecture:** SPA vanilla JS num único `index.html` + módulo puro `js/calculo-op.js` testável com `node --test` + Supabase (Postgres/RLS). Função pura nova para somar entregues sem defeito. Nova rota `#/fornecedor/entregas` (tela do tecelagem). Novo bloco "Entregas tecelagem" dentro de `screenNovaOP`. Form de entrega extraído como helper compartilhado entre os dois lados.

**Tech Stack:** HTML/CSS (Tailwind via CDN) + JavaScript vanilla, Supabase JS client (`supa`), helpers próprios (`el`, `toast`, `dataTable`, `formField`, `textInput`, `confirmDialog`, `pageHeader`, `shellLayout`). Testes com `node --test`.

**Referências:**
- Spec: `docs/superpowers/specs/2026-05-28-fase5a-tecelagem-design.md`
- Schema: `db/01_schema.sql` (tabelas `entregas`, `entrega_itens`)
- Policies: `db/03_policies.sql` — precisam de 2 policies novas (Task 2)
- Idioma: tudo em português brasileiro.

---

## Estrutura de arquivos

- **`js/calculo-op.js`** — adicionar `totalEntregueCimaPorItem` + export.
- **`tests/calculo-op.test.js`** — adicionar 5 testes da nova função + import.
- **`db/06_fase5a_policies.sql`** *(novo)* — policies `entregas_fornecedor_update` e `entregas_fornecedor_delete`.
- **`index.html`** — script inline:
  - Estender `loadCurrentUser` (carrega `fornecedores.tipo`).
  - Ajustar `routeAfterLogin` para ramificar por `fornecedor_tipo`.
  - Helper compartilhado `buildEntregaInlineForm(...)`.
  - Funções `salvarEntregaCima`/`atualizarEntregaCima`/`excluirEntrega`.
  - Nova tela `screenFornecedorEntregas` (`#/fornecedor/entregas`).
  - Novo bloco `buildBlocoTecelagem` dentro de `screenNovaOP`.
- **`docs/qa/fase5a-checklist.md`** *(novo)* — checklist QA.
- **`docs/superpowers/STATUS.md`** — atualizar Fase atual.

---

## Task 1: Função pura `totalEntregueCimaPorItem` + testes (TDD)

**Files:**
- Modify: `js/calculo-op.js`
- Test: `tests/calculo-op.test.js`

- [ ] **Step 1: Atualizar o import dos testes**

Em `tests/calculo-op.test.js`, trocar a primeira linha de require por:

```js
const { calcularFiosOP, larguraKey, montarOrdensCompraFio, recalcularOP, consumoPorOrdem, totalEntregueCimaPorItem } = require('../js/calculo-op.js');
```

- [ ] **Step 2: Escrever os 5 testes que falham**

Adicionar ao final de `tests/calculo-op.test.js`:

```js
test('totalEntregueCimaPorItem soma metros sem defeito por op_item', () => {
  const r = totalEntregueCimaPorItem([
    { op_item_id: 10, metros_entregues: 50, defeito: false },
    { op_item_id: 10, metros_entregues: 30, defeito: false },
    { op_item_id: 11, metros_entregues: 20, defeito: false },
  ]);
  assert.strictEqual(r[10], 80);
  assert.strictEqual(r[11], 20);
});

test('totalEntregueCimaPorItem ignora linhas com defeito', () => {
  const r = totalEntregueCimaPorItem([
    { op_item_id: 10, metros_entregues: 50, defeito: false },
    { op_item_id: 10, metros_entregues: 20, defeito: true },   // ignorada
    { op_item_id: 11, metros_entregues: 15, defeito: true },   // ignorada totalmente
  ]);
  assert.strictEqual(r[10], 50);
  assert.strictEqual(r[11], undefined);  // nenhuma soma sem defeito
});

test('totalEntregueCimaPorItem arredonda total a 2 casas', () => {
  const r = totalEntregueCimaPorItem([
    { op_item_id: 10, metros_entregues: 10.333, defeito: false },
    { op_item_id: 10, metros_entregues: 10.333, defeito: false },
    { op_item_id: 10, metros_entregues: 10.334, defeito: false },
  ]);
  assert.strictEqual(r[10], 31);  // 30.999... → arredonda para 31.00
});

test('totalEntregueCimaPorItem ignora linhas sem op_item_id', () => {
  const r = totalEntregueCimaPorItem([
    { op_item_id: 10, metros_entregues: 50, defeito: false },
    { op_item_id: null, modelo_id: 1, metros_entregues: 25, defeito: false },
    { metros_entregues: 30, defeito: false },
  ]);
  assert.strictEqual(r[10], 50);
  assert.strictEqual(Object.keys(r).length, 1);
});

test('totalEntregueCimaPorItem vazio retorna objeto vazio', () => {
  assert.deepStrictEqual(totalEntregueCimaPorItem([]), {});
});
```

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `node --test tests/calculo-op.test.js`
Expected: FAIL — `totalEntregueCimaPorItem is not a function` (5 novos falham; os 17 existentes seguem passando).

- [ ] **Step 4: Implementar `totalEntregueCimaPorItem`**

Em `js/calculo-op.js`, adicionar após `consumoPorOrdem` e antes do `module.exports`:

```js
// Soma metros entregues sem defeito por op_item_id (Fase 5a — tecelagem).
// Defeitos ficam gravados no banco mas não somam aqui.
// itens: [{ op_item_id, metros_entregues, defeito }]
// Retorna: { [op_item_id]: total_metros }  (arredondado a 2 casas)
function totalEntregueCimaPorItem(itens) {
  const round2 = (n) => Math.round(n * 100) / 100;
  const acc = {};
  for (const i of itens) {
    if (i.defeito) continue;
    if (i.op_item_id == null) continue;
    acc[i.op_item_id] = (acc[i.op_item_id] || 0) + Number(i.metros_entregues);
  }
  for (const k of Object.keys(acc)) acc[k] = round2(acc[k]);
  return acc;
}
```

E atualizar o export no fim do arquivo:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { larguraKey, calcularFiosOP, montarOrdensCompraFio, recalcularOP, consumoPorOrdem, totalEntregueCimaPorItem };
}
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `node --test tests/calculo-op.test.js`
Expected: PASS — 22 testes (17 antigos + 5 novos), 0 falhas.

- [ ] **Step 6: Commit**

```bash
git add js/calculo-op.js tests/calculo-op.test.js
git commit -m "feat(fase5a): totalEntregueCimaPorItem (ignora defeito) com testes"
```

---

## Task 2: Policies RLS — UPDATE/DELETE de entregas pelo fornecedor

**Files:**
- Create: `db/06_fase5a_policies.sql`

A spec sinalizou que o fornecedor consegue INSERT em `entregas`, mas não tem policy de UPDATE nem DELETE. `entrega_itens` está coberto pelo `FOR ALL` via relação com `entregas`, então só precisa de duas policies novas em `entregas`. O SQL é idempotente (DROP IF EXISTS + CREATE), seguro para reaplicar.

- [ ] **Step 1: Criar o arquivo `db/06_fase5a_policies.sql`**

```sql
-- ============================================================
-- Fase 5a — Policies adicionais para entregas
-- Permite ao fornecedor editar e excluir as próprias entregas
-- ============================================================

DROP POLICY IF EXISTS entregas_fornecedor_update ON entregas;
CREATE POLICY entregas_fornecedor_update ON entregas FOR UPDATE
  USING (fornecedor_id = meu_fornecedor_id())
  WITH CHECK (fornecedor_id = meu_fornecedor_id());

DROP POLICY IF EXISTS entregas_fornecedor_delete ON entregas;
CREATE POLICY entregas_fornecedor_delete ON entregas FOR DELETE
  USING (fornecedor_id = meu_fornecedor_id());
```

- [ ] **Step 2: Rodar o SQL no Supabase**

Aplicar via SQL Editor do Supabase (sem Restart/Pause/Resume — cuidado já conhecido do projeto). Verificar que retorna sucesso sem erro.

Após aplicar, conferir no painel "Authentication → Policies" que `entregas` mostra 5 policies (admin + 4 do fornecedor: read/insert/update/delete).

- [ ] **Step 3: Commit**

```bash
git add db/06_fase5a_policies.sql
git commit -m "feat(fase5a): policies entregas_fornecedor_update/delete"
```

---

## Task 3: Roteamento por tipo de fornecedor

**Files:**
- Modify: `index.html` (`loadCurrentUser`, `routeAfterLogin`)

A função `loadCurrentUser` (linha ~252) hoje seleciona apenas campos de `usuarios`. Vou estendê-la para trazer também `fornecedores.tipo` via FK. `routeAfterLogin` (linha ~357) ramifica o redirect por esse tipo.

- [ ] **Step 1: Estender `loadCurrentUser` para incluir `fornecedor_tipo`**

Em `index.html`, localizar o `supa.from('usuarios').select(...)` dentro de `loadCurrentUser` (perto da linha 254). Substituir o select por uma versão com join. A linha atual é:

```js
    .select('id, email, nome, tipo, fornecedor_id')
```

Trocar por:

```js
    .select('id, email, nome, tipo, fornecedor_id, fornecedores:fornecedor_id(tipo)')
```

E logo após `CURRENT_USER = data;` (linha ~262), adicionar uma normalização para expor o tipo do fornecedor de forma plana:

```js
  CURRENT_USER.fornecedor_tipo = data.fornecedores?.tipo || null;
```

- [ ] **Step 2: Ramificar `routeAfterLogin` por `fornecedor_tipo`**

Localizar a função `routeAfterLogin` (perto da linha 357). Substituir por:

```js
async function routeAfterLogin() {
  await loadCurrentUser();
  if (!CURRENT_USER) { navigate('#/login'); return; }
  if (CURRENT_USER.tipo === 'admin') { navigate('#/painel'); return; }
  const t = CURRENT_USER.fornecedor_tipo;
  if (t === 'fio_algodao' || t === 'fio_poliester') navigate('#/fornecedor/ordens');
  else if (t === 'tecelagem') navigate('#/fornecedor/entregas');
  else if (t === 'latex') navigate('#/fornecedor/entregas');  // fallback temporário até a Fase 5b
  else navigate('#/fornecedor/ordens');                       // fallback genérico
}
```

- [ ] **Step 3: Verificação manual**

Subir o site (após o deploy). Logar com:
- Admin → cai em `#/painel`. ✓
- Fornecedor de algodão/poliéster → cai em `#/fornecedor/ordens` (Fase 4). ✓
- Fornecedor de tecelagem → cai em `#/fornecedor/entregas`. Hoje essa rota ainda não existe (não foi registrada na Task 4), então mostra "Tela não encontrada" temporariamente — esperado.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fase5a): roteamento pos-login por tipo de fornecedor"
```

---

## Task 4: Tela do fornecedor de tecelagem — `#/fornecedor/entregas`

**Files:**
- Modify: `index.html` (helpers + nova função `screenFornecedorEntregas` + nova rota)

Tela única do tecelagem: cards de OPs em produção (cada um com tabela de itens e form inline de nova entrega) + histórico de entregas próprias com botões editar/excluir. Form é extraído como helper compartilhado `buildEntregaInlineForm` (usado também pelo admin na Task 5).

- [ ] **Step 1: Adicionar o helper `buildEntregaInlineForm` (módulo)**

Em `index.html`, inserir antes da função `screenFornecedorOrdens` (que existe da Fase 4). Este helper retorna o node DOM do form e expõe um método `getPayload()` para uso por quem chamou:

```js
// Form inline para criar/editar uma entrega de tecelagem (Fase 5a).
// opItens: [{ id, modelo_id, metros_pedidos, metros_ajustados }]
// modelosById: { [id]: { id, nome, largura, cor_1:{id,nome}, cor_2:{id,nome} } }
// entrega (opcional, para edição): { id, data, observacao, entrega_itens: [...] }
// Retorna: { node, getPayload }
function buildEntregaInlineForm({ opItens, modelosById, entrega = null }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const dataInput = textInput({ type: 'date', value: entrega?.data || hoje });
  const obsInput = textInput({ type: 'text', value: entrega?.observacao || '', placeholder: 'observação (opcional)' });

  // Mapa rápido das linhas existentes (edição) por op_item_id
  const existentesPorItem = {};
  if (entrega?.entrega_itens) {
    for (const ei of entrega.entrega_itens) existentesPorItem[ei.op_item_id] = ei;
  }

  // Uma linha por op_item
  const linhasState = opItens.map(it => {
    const existente = existentesPorItem[it.id];
    const metrosInput = textInput({ type: 'number', step: '0.01', value: existente ? String(existente.metros_entregues) : '', placeholder: '0,00' });
    const defeitoChk = el('input', { type: 'checkbox', class: 'h-4 w-4' });
    if (existente?.defeito) defeitoChk.checked = true;
    const obsLinha = textInput({ type: 'text', value: existente?.observacao || '', placeholder: 'obs (opcional)' });
    return { op_item_id: it.id, metrosInput, defeitoChk, obsLinha };
  });

  const linhasNode = el('div', { class: 'space-y-2 mt-2 mb-3' });
  for (let idx = 0; idx < linhasState.length; idx++) {
    const ls = linhasState[idx];
    const it = opItens[idx];
    const modelo = modelosById[it.modelo_id];
    const rotulo = modelo
      ? `${modelo.nome} ${larguraKey(modelo.largura)}m · ${modelo.cor_1?.nome || '?'}/${modelo.cor_2?.nome || '?'}`
      : ('#' + it.modelo_id);
    linhasNode.appendChild(el('div', { class: 'flex flex-wrap items-end gap-2 border-b pb-2' },
      el('div', { class: 'flex-1 min-w-[180px] text-sm text-gray-700' }, rotulo),
      el('div', { class: 'w-28' }, formField({ label: 'Metros', input: ls.metrosInput })),
      el('label', { class: 'flex items-center gap-1 text-sm text-gray-700 mb-1' }, ls.defeitoChk, 'defeito'),
      el('div', { class: 'flex-1 min-w-[140px]' }, formField({ label: 'Observação', input: ls.obsLinha })),
    ));
  }

  const node = el('div', { class: 'mt-3 border-t pt-3' },
    el('div', { class: 'flex flex-wrap gap-3 mb-2' },
      el('div', { class: 'w-40' }, formField({ label: 'Data', input: dataInput })),
      el('div', { class: 'flex-1 min-w-[200px]' }, formField({ label: 'Observação da entrega', input: obsInput })),
    ),
    linhasNode,
  );

  function getPayload() {
    const linhas = linhasState
      .map(ls => ({
        op_item_id: ls.op_item_id,
        metros_entregues: ls.metrosInput.value === '' ? 0 : Number(ls.metrosInput.value),
        defeito: ls.defeitoChk.checked,
        observacao: ls.obsLinha.value || null,
      }))
      .filter(l => l.metros_entregues > 0);
    return { data: dataInput.value || hoje, observacao: obsInput.value || null, linhas };
  }

  return { node, getPayload };
}
```

- [ ] **Step 2: Adicionar funções de persistência (módulo)**

Imediatamente após o helper acima, adicionar:

```js
// Persistência das entregas de tecelagem (Fase 5a).
// fornecedorId: id da fornecedora de tecelagem (CURRENT_USER.fornecedor_id ou op_fornecedores.cima).
// opId: a OP da entrega (1 entrega = 1 OP).
// payload: { data, observacao, linhas: [{ op_item_id, metros_entregues, defeito, observacao }] }
async function salvarEntregaCima({ fornecedorId, opId, payload }) {
  if (payload.linhas.length === 0) { toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
  const ins = await supa.from('entregas').insert({
    fornecedor_id: fornecedorId, etapa: 'cima', data: payload.data, observacao: payload.observacao,
  }).select().single();
  if (ins.error) { toast('Erro ao gravar entrega', 'error'); console.error(ins.error); return false; }
  const entregaId = ins.data.id;
  const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
  const insItens = await supa.from('entrega_itens').insert(itens);
  if (insItens.error) {
    await supa.from('entregas').delete().eq('id', entregaId);  // limpa órfã
    toast('Erro ao gravar itens da entrega', 'error'); console.error(insItens.error); return false;
  }
  toast('Entrega registrada', 'success');
  return true;
}

async function atualizarEntregaCima({ entregaId, opId, payload }) {
  if (payload.linhas.length === 0) { toast('Adicione ao menos 1 item com metros entregues', 'error'); return false; }
  const upd = await supa.from('entregas').update({
    data: payload.data, observacao: payload.observacao,
  }).eq('id', entregaId);
  if (upd.error) { toast('Erro ao atualizar entrega', 'error'); console.error(upd.error); return false; }
  await supa.from('entrega_itens').delete().eq('entrega_id', entregaId);
  const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
  const insItens = await supa.from('entrega_itens').insert(itens);
  if (insItens.error) { toast('Erro ao regravar itens da entrega', 'error'); console.error(insItens.error); return false; }
  toast('Entrega atualizada', 'success');
  return true;
}

async function excluirEntrega(entregaId) {
  return new Promise((resolve) => {
    confirmDialog({
      title: 'Excluir entrega',
      message: 'Esta ação remove a entrega e todos os seus itens. Continuar?',
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const r = await supa.from('entregas').delete().eq('id', entregaId);
        if (r.error) { toast('Erro ao excluir entrega', 'error'); console.error(r.error); resolve(false); return; }
        toast('Entrega excluída', 'success');
        resolve(true);
      },
    });
  });
}
```

- [ ] **Step 3: Implementar `screenFornecedorEntregas`**

Imediatamente após as funções de persistência acima:

```js
async function screenFornecedorEntregas() {
  const container = el('div', {});

  async function reload() {
    if (!CURRENT_USER.fornecedor_id) {
      container.replaceChildren(
        pageHeader('Minhas entregas'),
        el('div', { class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500' },
          'Seu usuário não está vinculado a um fornecedor. Fale com o administrador.')
      );
      return;
    }

    // 1) OPs em produção do tecelagem (via op_fornecedores etapa='cima')
    const opfRes = await supa.from('op_fornecedores')
      .select('op_id, ops!inner(id, numero, ano, status, op_itens(id, modelo_id, metros_pedidos, metros_ajustados))')
      .eq('fornecedor_id', CURRENT_USER.fornecedor_id)
      .eq('etapa', 'cima');
    if (opfRes.error) { toast('Erro ao carregar OPs', 'error'); console.error(opfRes.error); return; }
    const ops = (opfRes.data || [])
      .map(r => r.ops)
      .filter(o => o && o.status === 'em_producao');

    // 2) Entregas próprias do tecelagem (qualquer OP)
    const entRes = await supa.from('entregas')
      .select('id, data, observacao, criado_em, entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
      .eq('fornecedor_id', CURRENT_USER.fornecedor_id)
      .eq('etapa', 'cima')
      .order('data', { ascending: false })
      .order('id', { ascending: false });
    if (entRes.error) { toast('Erro ao carregar entregas', 'error'); console.error(entRes.error); return; }
    const entregas = entRes.data || [];

    // 3) Modelos para resolver rótulos
    const modeloIds = [...new Set(ops.flatMap(o => (o.op_itens || []).map(i => i.modelo_id)))];
    const modelosRes = modeloIds.length
      ? await supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)').in('id', modeloIds)
      : { data: [] };
    const modelosById = {};
    for (const m of (modelosRes.data || [])) modelosById[m.id] = m;

    render(ops, entregas, modelosById);
  }

  function render(ops, entregas, modelosById) {
    const fmtMetros = (n) => Number(n).toFixed(2).replace('.', ',') + ' m';
    const blocos = [pageHeader('Minhas entregas')];

    if (ops.length === 0) {
      blocos.push(el('div', { class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500 mb-6' },
        'Nenhuma OP em produção atribuída a você no momento.'));
    } else {
      for (const op of ops) {
        const itensEntreguesNaOP = entregas
          .flatMap(e => e.entrega_itens || [])
          .filter(ei => ei.op_id === op.id);
        const totalPorItem = totalEntregueCimaPorItem(itensEntreguesNaOP);

        const card = el('div', { class: 'bg-white rounded-xl shadow p-5 mb-6' });
        card.appendChild(el('div', { class: 'flex items-center justify-between mb-3' },
          el('div', { class: 'font-semibold text-gray-800' }, `Lote Nº ${op.numero}/${op.ano}`),
          badgeStatus(op.status),
        ));

        card.appendChild(dataTable({
          columns: [
            { key: 'modelo', label: 'Modelo', render: (i) => {
                const m = modelosById[i.modelo_id];
                return m ? `${m.nome} ${larguraKey(m.largura)}m · ${m.cor_1?.nome || '?'}/${m.cor_2?.nome || '?'}` : ('#' + i.modelo_id);
              } },
            { key: 'metros_pedidos', label: 'Pedido', render: (i) => fmtMetros(i.metros_pedidos) },
            { key: 'metros_ajustados', label: 'Ajustado', render: (i) => i.metros_ajustados == null ? fmtMetros(i.metros_pedidos) : fmtMetros(i.metros_ajustados) },
            { key: 'entregue', label: 'Entregue', render: (i) => fmtMetros(totalPorItem[i.id] || 0) },
            { key: 'falta', label: 'Falta', render: (i) => {
                const ajustado = i.metros_ajustados == null ? Number(i.metros_pedidos) : Number(i.metros_ajustados);
                const falta = Math.round((ajustado - (totalPorItem[i.id] || 0)) * 100) / 100;
                const cor = falta <= 0 ? 'text-green-700' : 'text-gray-800';
                const texto = falta <= 0 ? '✅ completo' : fmtMetros(falta);
                return el('span', { class: cor }, texto);
              } },
          ],
          rows: op.op_itens || [],
        }));

        // Form inline expansível
        const formHolder = el('div', {});
        const btnNova = el('button', {
          class: 'mt-3 text-sm text-blue-700 hover:underline',
          onclick: () => {
            const form = buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById });
            const btnSalvar = el('button', {
              class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg px-3 py-2 mr-2',
              onclick: async () => {
                btnSalvar.disabled = true;
                const ok = await salvarEntregaCima({ fornecedorId: CURRENT_USER.fornecedor_id, opId: op.id, payload: form.getPayload() });
                btnSalvar.disabled = false;
                if (ok) reload();
              },
            }, 'Salvar entrega');
            const btnCancelar = el('button', {
              class: 'bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg px-3 py-2',
              onclick: () => { formHolder.replaceChildren(); btnNova.style.display = ''; },
            }, 'Cancelar');
            const wrap = el('div', {}, form.node, el('div', { class: 'mt-2' }, btnSalvar, btnCancelar));
            formHolder.replaceChildren(wrap);
            btnNova.style.display = 'none';
          },
        }, '+ Nova entrega');
        card.appendChild(btnNova);
        card.appendChild(formHolder);

        blocos.push(card);
      }
    }

    // Histórico
    blocos.push(el('div', { class: 'bg-white rounded-xl shadow p-5 mb-6' },
      el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Histórico de entregas'),
      entregas.length === 0
        ? el('p', { class: 'text-sm text-gray-400' }, 'Nenhuma entrega registrada ainda.')
        : el('div', {}, entregas.map(ent => linhaHistorico(ent, modelosById, ops))),
    ));

    container.replaceChildren(...blocos);
  }

  function linhaHistorico(entrega, modelosById, opsCarregadas) {
    const itens = entrega.entrega_itens || [];
    const opId = itens[0]?.op_id;
    const opRef = opsCarregadas.find(o => o.id === opId);
    const opLabel = opRef ? `Lote Nº ${opRef.numero}/${opRef.ano}` : (opId ? '#' + opId : '?');

    const wrap = el('div', { class: 'border-b py-3' });
    wrap.appendChild(el('div', { class: 'flex items-center justify-between' },
      el('div', {},
        el('span', { class: 'text-sm font-medium text-gray-800' }, opLabel + ' · '),
        el('span', { class: 'text-sm text-gray-500' }, new Date(entrega.data + 'T00:00:00').toLocaleDateString('pt-BR')),
      ),
      el('div', {},
        el('button', { class: 'text-sm text-blue-700 hover:underline mr-3',
          onclick: () => abrirEdicao(entrega, opRef, modelosById) }, 'Editar'),
        el('button', { class: 'text-sm text-red-600 hover:underline',
          onclick: async () => { const ok = await excluirEntrega(entrega.id); if (ok) reload(); } }, 'Excluir'),
      ),
    ));
    if (entrega.observacao) wrap.appendChild(el('div', { class: 'text-xs text-gray-500 mb-1' }, entrega.observacao));
    for (const ei of itens) {
      const opItem = opRef?.op_itens?.find(i => i.id === ei.op_item_id);
      const modelo = opItem ? modelosById[opItem.modelo_id] : null;
      const nome = modelo
        ? `${modelo.nome} ${larguraKey(modelo.largura)}m · ${modelo.cor_1?.nome || '?'}/${modelo.cor_2?.nome || '?'}`
        : '?';
      wrap.appendChild(el('div', { class: 'text-sm text-gray-700' },
        nome + ': ' + Number(ei.metros_entregues).toFixed(2).replace('.', ',') + ' m',
        ei.defeito ? el('span', { class: 'ml-2 text-red-600 font-semibold' }, '⚠ DEFEITO') : '',
        ei.observacao ? el('span', { class: 'ml-2 text-xs text-gray-500' }, '(' + ei.observacao + ')') : '',
      ));
    }
    return wrap;
  }

  function abrirEdicao(entrega, opRef, modelosById) {
    if (!opRef) { toast('OP da entrega não está mais em produção', 'error'); return; }
    const form = buildEntregaInlineForm({ opItens: opRef.op_itens || [], modelosById, entrega });
    modal({
      title: `Editar entrega — Lote Nº ${opRef.numero}/${opRef.ano}`,
      body: form.node,
      saveLabel: 'Salvar alterações',
      onSave: async () => {
        const ok = await atualizarEntregaCima({ entregaId: entrega.id, opId: opRef.id, payload: form.getPayload() });
        if (ok) reload();
        return ok;  // false mantém o modal aberto em erro
      },
    });
  }

  await reload();
  return shellLayout([{ href: '#/fornecedor/entregas', label: 'Minhas entregas' }], container);
}
```

- [ ] **Step 4: Registrar a rota**

Em `index.html`, no objeto `routes` (perto da linha 280), logo abaixo da entrada `'#/fornecedor/ordens'`, adicionar:

```js
  '#/fornecedor/entregas': { render: screenFornecedorEntregas, roles: ['fornecedor'] },
```

- [ ] **Step 5: Verificar no navegador**

Após deploy:
- Logar como fornecedor de tecelagem (usuário de teste da Fase 1). Cair em `#/fornecedor/entregas`.
- Ver as OPs `em_producao` atribuídas (`op_fornecedores` etapa='cima'). Para cada OP, ver a tabela com Pedido/Ajustado/Entregue/Falta.
- Clicar "+ Nova entrega", preencher data + metros em pelo menos 1 linha + opcionalmente marcar defeito. Salvar.
- A entrega aparece no histórico abaixo. "Entregue" do item aumenta.
- Marcar a única linha como defeito → "Entregue" do item NÃO aumenta (defeito registrado no histórico, sem somar).
- No histórico, clicar "Editar" → abre modal com valores preenchidos. Mudar metros, salvar. A linha do histórico e a tabela atualizam.
- Clicar "Excluir" → confirmação → entrega some, "Entregue" recalcula.
- Excesso: enviar metros > ajustado → "Falta" fica negativo, sem bloqueio.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(fase5a): tela do fornecedor de tecelagem com nova/editar/excluir entrega"
```

---

## Task 5: Bloco "Entregas tecelagem" no detalhe da OP (admin)

**Files:**
- Modify: `index.html` (dentro de `screenNovaOP`: helper de carga + `buildBlocoTecelagem`; pendurar no `buildScreen`)

Espelha o padrão de `buildBlocoFios` (Fase 4): aparece quando `op.status !== 'simulada'` e há `op_fornecedores` etapa='cima'. Mostra resumo por item + lista de entregas + botão "+ Nova entrega" pro admin lançar no lugar da tecelagem.

- [ ] **Step 1: Estender o estado e o carregamento dentro de `screenNovaOP`**

Junto às declarações de estado (perto de `let ordens = [];`), adicionar:

```js
  let entregasCima = [];
  let cimaFornecedorId = null;
```

Logo após o carregamento de `ordens` no `if (opId) { ... if (op.status !== 'simulada') { ... } }`, adicionar:

```js
      const cimaForn = (data.op_fornecedores || []).find(f => f.etapa === 'cima');
      cimaFornecedorId = cimaForn ? cimaForn.fornecedor_id : null;
      const entRes = await supa.from('entregas')
        .select('id, fornecedor_id, data, observacao, fornecedores:fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
        .eq('etapa', 'cima')
        .order('data', { ascending: false })
        .order('id', { ascending: false });
      if (entRes.error) { toast('Erro ao carregar entregas de tecelagem', 'error'); console.error(entRes.error); }
      entregasCima = (entRes.data || []).filter(e => (e.entrega_itens || []).some(ei => ei.op_id === op.id));
```

- [ ] **Step 2: Pendurar o bloco em `buildScreen`**

Em `buildScreen()`, logo após `if (op && op.status !== 'simulada') wrap.appendChild(buildBlocoFios());`, adicionar:

```js
    if (op && op.status !== 'simulada' && cimaFornecedorId) wrap.appendChild(buildBlocoTecelagem());
```

- [ ] **Step 3: Implementar `buildBlocoTecelagem`**

Dentro de `screenNovaOP`, perto dos outros helpers (ex.: depois de `buildBlocoFios`), adicionar:

```js
  function buildBlocoTecelagem() {
    const box = el('div', { class: 'bg-white rounded-xl shadow p-5 mt-6' });
    box.appendChild(el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Entregas tecelagem'));

    const todosItens = entregasCima.flatMap(e => (e.entrega_itens || []).filter(ei => ei.op_id === op.id));
    const totalPorItem = totalEntregueCimaPorItem(todosItens);

    // Resumo por item
    box.appendChild(dataTable({
      columns: [
        { key: 'modelo', label: 'Modelo', render: (i) => rotuloModelo(modelosById[i.modelo_id]) },
        { key: 'metros_pedidos', label: 'Pedido', render: (i) => fmtMetros(i.metros_pedidos) },
        { key: 'metros_ajustados', label: 'Ajustado', render: (i) => i.metros_ajustados == null ? fmtMetros(i.metros_pedidos) : fmtMetros(i.metros_ajustados) },
        { key: 'entregue', label: 'Entregue', render: (i) => fmtMetros(totalPorItem[i.id] || 0) },
        { key: 'falta', label: 'Falta', render: (i) => {
            const ajustado = i.metros_ajustados == null ? Number(i.metros_pedidos) : Number(i.metros_ajustados);
            const falta = Math.round((ajustado - (totalPorItem[i.id] || 0)) * 100) / 100;
            const cor = falta <= 0 ? 'text-green-700' : 'text-gray-800';
            return el('span', { class: cor }, falta <= 0 ? '✅ completo' : fmtMetros(falta));
          } },
      ],
      rows: opItensRaw,
    }));

    // Botão Nova entrega (admin, só em em_producao)
    if (op.status === 'em_producao') {
      const formHolder = el('div', {});
      const btnNova = el('button', {
        class: 'mt-3 text-sm text-blue-700 hover:underline',
        onclick: () => {
          const form = buildEntregaInlineForm({ opItens: opItensRaw, modelosById });
          const btnSalvar = el('button', {
            class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg px-3 py-2 mr-2',
            onclick: async () => {
              btnSalvar.disabled = true;
              const ok = await salvarEntregaCima({ fornecedorId: cimaFornecedorId, opId: op.id, payload: form.getPayload() });
              btnSalvar.disabled = false;
              if (ok) reloadEntregasCima();
            },
          }, 'Salvar entrega');
          const btnCancelar = el('button', {
            class: 'bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg px-3 py-2',
            onclick: () => { formHolder.replaceChildren(); btnNova.style.display = ''; },
          }, 'Cancelar');
          formHolder.replaceChildren(el('div', {}, form.node, el('div', { class: 'mt-2' }, btnSalvar, btnCancelar)));
          btnNova.style.display = 'none';
        },
      }, '+ Nova entrega');
      box.appendChild(btnNova);
      box.appendChild(formHolder);
    }

    // Lista cronológica
    box.appendChild(el('div', { class: 'font-semibold text-gray-700 mt-5 mb-2' }, 'Histórico'));
    if (entregasCima.length === 0) {
      box.appendChild(el('p', { class: 'text-sm text-gray-400' }, 'Nenhuma entrega registrada ainda.'));
    } else {
      for (const ent of entregasCima) {
        const subcard = el('div', { class: 'border-b py-3' });
        subcard.appendChild(el('div', { class: 'flex items-center justify-between' },
          el('div', { class: 'text-sm' },
            el('b', {}, new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR')),
            ' · ' + (ent.fornecedores?.nome || '?'),
          ),
          op.status === 'em_producao' ? el('div', {},
            el('button', { class: 'text-sm text-blue-700 hover:underline mr-3',
              onclick: () => abrirEdicaoAdmin(ent) }, 'Editar'),
            el('button', { class: 'text-sm text-red-600 hover:underline',
              onclick: async () => { const ok = await excluirEntrega(ent.id); if (ok) reloadEntregasCima(); } }, 'Excluir'),
          ) : '',
        ));
        if (ent.observacao) subcard.appendChild(el('div', { class: 'text-xs text-gray-500' }, ent.observacao));
        for (const ei of (ent.entrega_itens || []).filter(x => x.op_id === op.id)) {
          const it = opItensRaw.find(i => i.id === ei.op_item_id);
          const nome = it ? rotuloModelo(modelosById[it.modelo_id]) : '?';
          subcard.appendChild(el('div', { class: 'text-sm text-gray-700' },
            nome + ': ' + fmtMetros(ei.metros_entregues),
            ei.defeito ? el('span', { class: 'ml-2 text-red-600 font-semibold' }, '⚠ DEFEITO') : '',
            ei.observacao ? el('span', { class: 'ml-2 text-xs text-gray-500' }, '(' + ei.observacao + ')') : '',
          ));
        }
        box.appendChild(subcard);
      }
    }
    return box;
  }

  function abrirEdicaoAdmin(entrega) {
    const form = buildEntregaInlineForm({ opItens: opItensRaw, modelosById, entrega });
    modal({
      title: `Editar entrega — ${new Date(entrega.data + 'T00:00:00').toLocaleDateString('pt-BR')}`,
      body: form.node,
      saveLabel: 'Salvar alterações',
      onSave: async () => {
        const ok = await atualizarEntregaCima({ entregaId: entrega.id, opId: op.id, payload: form.getPayload() });
        if (ok) reloadEntregasCima();
        return ok;
      },
    });
  }

  async function reloadEntregasCima() {
    const entRes = await supa.from('entregas')
      .select('id, fornecedor_id, data, observacao, fornecedores:fornecedor_id(nome), entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
      .eq('etapa', 'cima')
      .order('data', { ascending: false })
      .order('id', { ascending: false });
    if (entRes.error) { toast('Erro ao recarregar entregas', 'error'); console.error(entRes.error); return; }
    entregasCima = (entRes.data || []).filter(e => (e.entrega_itens || []).some(ei => ei.op_id === op.id));
    render();
  }
```

> `rotuloModelo`, `fmtMetros`, `opItensRaw`, `modelosById`, `op`, `render`, `op.status` já estão no escopo de `screenNovaOP`.

- [ ] **Step 4: Verificar no navegador**

Como admin, abrir uma OP `em_producao` (`#/ops/:id`):
- Bloco "Entregas tecelagem" aparece logo abaixo do "Recebimento de fios".
- Tabela com Modelo / Pedido / Ajustado / Entregue / Falta para cada item, refletindo as entregas existentes (somando só sem defeito).
- "+ Nova entrega" abre o mesmo form inline. Salvar adiciona a entrega; recarrega.
- Cada entrega no histórico tem botões Editar e Excluir. Editar reabre o form com valores preenchidos; Excluir pede confirmação.
- Defeito permanece visível no histórico mas não soma no "Entregue".

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(fase5a): bloco de entregas tecelagem no detalhe da OP (admin lanca tambem)"
```

---

## Task 6: Checklist QA + atualização de STATUS

**Files:**
- Create: `docs/qa/fase5a-checklist.md`
- Modify: `docs/superpowers/STATUS.md`

- [ ] **Step 1: Criar `docs/qa/fase5a-checklist.md`**

```markdown
# QA — Fase 5a: Tecelagem (parte de cima)

Pré-requisitos: OP `em_producao` com fornecedor de tecelagem atribuído (`op_fornecedores` etapa='cima').

## Cálculo (automatizado — `node --test tests/calculo-op.test.js`)
- [x] 1. `totalEntregueCimaPorItem` soma metros sem defeito.
- [x] 2. Defeitos são ignorados na soma (ficam só no banco).
- [x] 3. Arredondamento a 2 casas.
- [x] 4. Linhas sem `op_item_id` são ignoradas.
- [x] 5. Lista vazia retorna `{}`.

## Roteamento por tipo de fornecedor
- [ ] 6. Admin → cai em `#/painel`.
- [ ] 7. Fornecedor de algodão/poliéster → cai em `#/fornecedor/ordens` (Fase 4).
- [ ] 8. Fornecedor de tecelagem → cai em `#/fornecedor/entregas`.

## Fornecedor (manual, logado como tecelagem)
- [ ] 9. Lista as OPs em produção atribuídas; mostra Pedido/Ajustado/Entregue/Falta por item.
- [ ] 10. "+ Nova entrega" abre form inline; salvar grava `entregas` + `entrega_itens`.
- [ ] 11. Linha marcada como defeito grava no banco mas NÃO soma em "Entregue".
- [ ] 12. Excesso de metros entregue → "Falta" mostra valor negativo (sem bloqueio).
- [ ] 13. Histórico lista entregas próprias com botões Editar / Excluir.
- [ ] 14. Editar carrega valores existentes; salvar substitui as `entrega_itens` corretamente.
- [ ] 15. Excluir pede confirmação e remove a entrega (cascade nas `entrega_itens`).
- [ ] 16. Usuário sem `fornecedor_id` vinculado vê estado vazio amigável.

## Admin (manual, logado como admin)
- [ ] 17. Bloco "Entregas tecelagem" aparece no detalhe da OP em `em_producao`.
- [ ] 18. Resumo por item bate com o que o tecelagem vê.
- [ ] 19. Admin "+ Nova entrega" grava em nome do tecelagem (`fornecedor_id` = `op_fornecedores.cima`).
- [ ] 20. Admin consegue editar/excluir qualquer entrega da OP.
- [ ] 21. Em OP `finalizada` (quando existir, Fase 5b), o bloco é só leitura (sem botões).

## Resultado
(preencher após execução: X/21)
```

- [ ] **Step 2: Atualizar `docs/superpowers/STATUS.md`**

Mudar a linha do cabeçalho:

```markdown
## Fase atual: 5a — Tecelagem (parte de cima)
```

E a descrição abaixo dela:

```markdown
Fase 5a implementada em 2026-05-28, aguardando QA do Vinícius. Próxima: Fase 5b — Látex (com múltiplos destinos por OP, ver [[project_regra_latex]]).
```

Em "Próximas fases", trocar:

```markdown
- **Fase 5 — Tecelagem e látex** (entregas parciais, defeitos, múltiplos destinos de látex) ← próxima
```

por:

```markdown
- **Fase 5a — Tecelagem (parte de cima)** ⏳ implementada (aguardando QA)
- **Fase 5b — Látex** (com múltiplos destinos por OP) ← próxima
```

- [ ] **Step 3: Commit**

```bash
git add docs/qa/fase5a-checklist.md docs/superpowers/STATUS.md
git commit -m "docs(fase5a): checklist de QA e atualizacao de status"
```

---

## Verificação final

- [ ] `node --test tests/calculo-op.test.js` → 22 testes passando (17 antigos + 5 novos).
- [ ] SQL da Task 2 aplicado no Supabase, 5 policies em `entregas`.
- [ ] QA manual dos itens 6–21 do `docs/qa/fase5a-checklist.md`.
- [ ] Atualizar a memória do projeto (fase atual → 5a aguardando QA / depois → 5b) ao concluir o QA.
