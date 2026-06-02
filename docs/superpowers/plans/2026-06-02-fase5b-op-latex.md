# Fase 5b — OP de Látex — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao registrar uma entrega de tecelagem, gerar automaticamente uma OP de látex (independente, com número próprio) que registra o enviado por modelo e permite à empresa de látex (e ao admin) lançar os recebimentos do produto final, com controle Enviado × Recebido × Falta.

**Architecture:** Opção A — reaproveitar `ops`/`op_itens`/`op_fornecedores`/`entregas`/`entrega_itens`. A OP de látex é uma linha em `ops` com `tipo='latex'`; o "enviado" são seus `op_itens` (snapshot); os recebimentos são `entregas` `etapa='latex'`. A criação é feita por uma função plpgsql `SECURITY DEFINER` (`gerar_op_latex`) chamada via RPC ao salvar a entrega de tecelagem. As policies RLS existentes (genéricas, por `meu_fornecedor_id()`/vínculo em `op_fornecedores`) já cobrem a empresa de látex.

**Tech Stack:** HTML/CSS/JS vanilla + Supabase (Postgres + RLS + RPC). Sem framework/build. Testes automatizados só para funções puras em `tests/calculo-op.test.js` (`node --test`). DOM/SQL verificados manualmente (padrão do projeto via `docs/qa/`).

---

## File Structure

- **Create** `db/08_fase5b_latex.sql` — migração idempotente: colunas em `ops` (`tipo`, `origem_op_id`, `origem_entrega_id`, `observacao`), troca do UNIQUE, índice único parcial, e a função `gerar_op_latex` + GRANT.
- **Modify** `js/calculo-op.js` — comentário documentando que `totalEntregueCimaPorItem` também serve ao recebido de látex (sem mudança de lógica).
- **Modify** `tests/calculo-op.test.js` — 2 testes garantindo o reuso para látex.
- **Modify** `index.html`:
  - Labels/badge de tipo (`OP_TIPO_LABEL`, `badgeTipo`).
  - `screenListaOPs` — coluna Tipo + filtro.
  - `buildEntregaInlineForm` — flag `comDestino`.
  - `salvarEntregaCima` — chamar `gerar_op_latex` via RPC.
  - `salvarEntregaLatex` / `atualizarEntregaLatex` — persistência de recebimentos (etapa `latex`).
  - `screenNovaOP` — buscar `tipo` e ramificar para a visão de látex.
  - `buildOPLatexView(op, modelosById, recarregar)` — detalhe admin da OP de látex (origem, Enviado×Recebido×Falta, recebimentos, ajuste manual, finalizar).
  - Link "Ver OP de látex" no histórico de entregas da tecelagem (bloco admin).
  - `screenFornecedorLatex` + rota `#/fornecedor/latex` + `routeAfterLogin`.
- **Create** `docs/qa/fase5b-checklist.md` — QA manual da Fase 5b.

**Nota sobre testes:** a lógica nova mora majoritariamente na RPC (plpgsql, sem harness JS) e no DOM. O cálculo Enviado×Recebido×Falta reusa `totalEntregueCimaPorItem`. Os 23 testes atuais devem permanecer verdes (regressão). RPC e DOM são verificados manualmente.

---

## Task 1: Migração de banco — schema + função `gerar_op_latex`

**Files:**
- Create: `db/08_fase5b_latex.sql`

- [ ] **Step 1: Criar o arquivo de migração**

```sql
-- ============================================================
-- Fase 5b — OP de Látex (recebimento do produto final)
-- Idempotente: pode rodar várias vezes.
-- ============================================================

-- 1) Tipo da OP: 'tecelagem' (produção, padrão) ou 'latex'.
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'tecelagem';
ALTER TABLE ops DROP CONSTRAINT IF EXISTS ops_tipo_chk;
ALTER TABLE ops
  ADD CONSTRAINT ops_tipo_chk CHECK (tipo IN ('tecelagem','latex'));

-- 2) Vínculos de origem (preenchidos só nas OPs de látex).
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS origem_op_id BIGINT REFERENCES ops(id) ON DELETE SET NULL;
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS origem_entrega_id BIGINT REFERENCES entregas(id) ON DELETE SET NULL;

-- 3) Observação livre / texto automático de origem.
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS observacao TEXT;

-- 4) Numeração independente por tipo (substitui UNIQUE(numero, ano)).
ALTER TABLE ops DROP CONSTRAINT IF EXISTS ops_numero_ano_key;
ALTER TABLE ops DROP CONSTRAINT IF EXISTS ops_numero_ano_tipo_key;
ALTER TABLE ops
  ADD CONSTRAINT ops_numero_ano_tipo_key UNIQUE (numero, ano, tipo);

-- 5) Idempotência: uma entrega de tecelagem gera no máximo uma OP de látex.
DROP INDEX IF EXISTS ops_origem_entrega_latex_uidx;
CREATE UNIQUE INDEX ops_origem_entrega_latex_uidx
  ON ops (origem_entrega_id) WHERE tipo = 'latex';

-- ============================================================
-- Função: gera a OP de látex a partir de uma entrega de tecelagem.
-- SECURITY DEFINER: cria ops/op_itens/op_fornecedores com privilégio,
-- mas valida que o chamador é o fornecedor dono da entrega ou admin.
-- Retorna o id da OP de látex (nova ou já existente). NULL se nada a enviar.
-- ============================================================
CREATE OR REPLACE FUNCTION gerar_op_latex(p_entrega_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega       entregas%ROWTYPE;
  v_op_id         BIGINT;
  v_ano           INTEGER;
  v_numero        INTEGER;
  v_latex_op_id   BIGINT;
BEGIN
  SELECT * INTO v_entrega FROM entregas WHERE id = p_entrega_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrega % não encontrada', p_entrega_id;
  END IF;

  IF v_entrega.etapa <> 'cima' THEN
    RAISE EXCEPTION 'Entrega % não é de tecelagem (etapa=%)', p_entrega_id, v_entrega.etapa;
  END IF;

  -- Autorização: admin ou o próprio fornecedor da entrega.
  IF NOT (is_admin() OR v_entrega.fornecedor_id = meu_fornecedor_id()) THEN
    RAISE EXCEPTION 'Sem permissão para gerar OP de látex da entrega %', p_entrega_id;
  END IF;

  IF v_entrega.destino_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'Entrega % sem destino de látex', p_entrega_id;
  END IF;

  -- Idempotência: já existe OP de látex para esta entrega?
  SELECT id INTO v_latex_op_id FROM ops
    WHERE tipo = 'latex' AND origem_entrega_id = p_entrega_id;
  IF v_latex_op_id IS NOT NULL THEN
    RETURN v_latex_op_id;
  END IF;

  -- OP de produção de origem (todas as linhas da entrega são da mesma OP).
  SELECT op_id INTO v_op_id FROM entrega_itens WHERE entrega_id = p_entrega_id LIMIT 1;
  IF v_op_id IS NULL THEN
    RETURN NULL;  -- entrega sem itens
  END IF;

  -- Se não há metros sem defeito, não cria OP de látex.
  IF NOT EXISTS (
    SELECT 1 FROM entrega_itens
    WHERE entrega_id = p_entrega_id AND defeito = FALSE AND metros_entregues > 0
  ) THEN
    RETURN NULL;
  END IF;

  v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
    FROM ops WHERE tipo = 'latex' AND ano = v_ano;

  INSERT INTO ops (numero, ano, status, tipo, origem_op_id, origem_entrega_id, observacao)
  VALUES (
    v_numero, v_ano, 'em_producao', 'latex', v_op_id, p_entrega_id,
    'Gerada da entrega de ' || to_char(v_entrega.data, 'DD/MM/YYYY')
      || ' da OP ' || (SELECT numero || '/' || ano FROM ops WHERE id = v_op_id) || ' (tecelagem)'
  )
  RETURNING id INTO v_latex_op_id;

  -- Enviado por modelo (soma sem defeito), via join entrega_itens -> op_itens.
  INSERT INTO op_itens (op_id, modelo_id, metros_pedidos)
  SELECT v_latex_op_id, oi.modelo_id, SUM(ei.metros_entregues)
  FROM entrega_itens ei
  JOIN op_itens oi ON oi.id = ei.op_item_id
  WHERE ei.entrega_id = p_entrega_id AND ei.defeito = FALSE AND ei.metros_entregues > 0
  GROUP BY oi.modelo_id;

  -- Empresa de látex dona da OP de látex.
  INSERT INTO op_fornecedores (op_id, fornecedor_id, etapa)
  VALUES (v_latex_op_id, v_entrega.destino_fornecedor_id, 'latex')
  ON CONFLICT (op_id, fornecedor_id, etapa) DO NOTHING;

  RETURN v_latex_op_id;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_op_latex(BIGINT) TO authenticated;
```

- [ ] **Step 2: Revisão de idempotência (visual)**

Confirme: `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` antes de cada `ADD CONSTRAINT`, `DROP INDEX IF EXISTS` antes de `CREATE UNIQUE INDEX`, `CREATE OR REPLACE FUNCTION`. Rodar duas vezes não deve dar erro.

> Execução no Supabase é **manual** (SQL Editor). Não executar aqui.

- [ ] **Step 3: Commit**

```bash
git add db/08_fase5b_latex.sql
git commit -m "feat(fase5b): schema da OP de latex e funcao gerar_op_latex"
```

---

## Task 2: Testes — reuso do cálculo para o recebido de látex

**Files:**
- Modify: `js/calculo-op.js` (comentário)
- Modify: `tests/calculo-op.test.js`

- [ ] **Step 1: Escrever os testes (devem falhar? não — documentam reuso)**

Em `tests/calculo-op.test.js`, adicionar ao final do arquivo (antes do fechamento, seguindo o padrão `test(...)` existente):

```js
test('totalEntregueCimaPorItem também serve ao recebido de látex (mesma forma de dados)', () => {
  const recebimentosLatex = [
    { op_item_id: 10, metros_entregues: 12.5, defeito: false },
    { op_item_id: 10, metros_entregues: 7.5, defeito: false },
    { op_item_id: 11, metros_entregues: 3, defeito: false },
  ];
  const total = totalEntregueCimaPorItem(recebimentosLatex);
  assert.deepStrictEqual(total, { 10: 20, 11: 3 });
});

test('recebido de látex ignora itens com defeito', () => {
  const recebimentosLatex = [
    { op_item_id: 10, metros_entregues: 5, defeito: false },
    { op_item_id: 10, metros_entregues: 9, defeito: true },
  ];
  const total = totalEntregueCimaPorItem(recebimentosLatex);
  assert.deepStrictEqual(total, { 10: 5 });
});
```

- [ ] **Step 2: Atualizar o comentário da função em `js/calculo-op.js`**

Trocar o comentário acima de `function totalEntregueCimaPorItem(itens) {`:

```js
// Soma metros entregues sem defeito por op_item_id (Fase 5a — tecelagem).
// Defeitos ficam gravados no banco mas não somam aqui.
// itens: [{ op_item_id, metros_entregues, defeito }]
// Retorna: { [op_item_id]: total_metros }  (arredondado a 2 casas)
```

por:

```js
// Soma metros entregues sem defeito por op_item_id.
// Usada na tecelagem (Fase 5a, "entregue") e no látex (Fase 5b, "recebido"):
// a forma de dados é a mesma (entrega_itens), então é agnóstica de etapa.
// Defeitos ficam gravados no banco mas não somam aqui.
// itens: [{ op_item_id, metros_entregues, defeito }]
// Retorna: { [op_item_id]: total_metros }  (arredondado a 2 casas)
```

- [ ] **Step 3: Rodar os testes**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 25` / `fail 0` (23 antigos + 2 novos).

- [ ] **Step 4: Commit**

```bash
git add js/calculo-op.js tests/calculo-op.test.js
git commit -m "test(fase5b): cobre reuso do calculo no recebido de latex"
```

---

## Task 3: Lista de OPs — coluna Tipo + filtro

**Files:**
- Modify: `index.html` — perto de `OP_STATUS_LABEL`/`badgeStatus` (~848) e `screenListaOPs` (~853)

- [ ] **Step 1: Adicionar labels e helper de tipo**

Logo antes de `function badgeStatus(status) {`, adicionar:

```js
const OP_TIPO_LABEL = { tecelagem: 'Tecelagem', latex: 'Látex' };
const OP_TIPO_BADGE = { tecelagem: 'bg-indigo-100 text-indigo-700', latex: 'bg-amber-100 text-amber-700' };
function badgeTipo(tipo) {
  return el('span', { class: 'px-2 py-1 rounded text-xs font-semibold ' + (OP_TIPO_BADGE[tipo] || 'bg-gray-100 text-gray-700') },
    OP_TIPO_LABEL[tipo] || tipo);
}
```

- [ ] **Step 2: Trazer `tipo` na query e adicionar filtro + coluna**

Em `screenListaOPs`, trocar a query (dentro de `reload`):

```js
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, criado_em, op_itens(id)')
      .order('ano', { ascending: false })
      .order('numero', { ascending: false });
    if (error) { toast('Erro ao carregar OPs', 'error'); console.error(error); return; }
    render(data || []);
```

por:

```js
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, tipo, criado_em, op_itens(id)')
      .order('ano', { ascending: false })
      .order('numero', { ascending: false });
    if (error) { toast('Erro ao carregar OPs', 'error'); console.error(error); return; }
    render(data || []);
```

Trocar a função `render(rows)` inteira por:

```js
  let filtroTipo = 'todas';
  function render(rows) {
    const header = pageHeader('Ordens de Produção', [{ label: '+ Nova OP', onclick: () => navigate('#/ops/nova') }]);
    const filtro = el('div', { class: 'flex gap-2 mb-3' },
      ...[['todas', 'Todas'], ['tecelagem', 'Tecelagem'], ['latex', 'Látex']].map(([val, lbl]) =>
        el('button', {
          class: 'px-3 py-1 rounded-lg text-sm font-semibold ' + (filtroTipo === val ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'),
          onclick: () => { filtroTipo = val; render(rows); },
        }, lbl)));
    const visiveis = filtroTipo === 'todas' ? rows : rows.filter(r => (r.tipo || 'tecelagem') === filtroTipo);
    const body = visiveis.length === 0
      ? el('div', { class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500' }, 'Nenhuma OP para este filtro.')
      : dataTable({
          columns: [
            { key: 'lote', label: 'Lote', render: (r) => `Nº ${r.numero}/${r.ano}` },
            { key: 'tipo', label: 'Tipo', render: (r) => badgeTipo(r.tipo || 'tecelagem') },
            { key: 'status', label: 'Status', render: (r) => badgeStatus(r.status) },
            { key: 'itens', label: 'Itens', render: (r) => String((r.op_itens || []).length) },
            { key: 'criado_em', label: 'Criada em', render: (r) => new Date(r.criado_em).toLocaleDateString('pt-BR') },
          ],
          rows: visiveis,
          actions: [
            { label: (r) => r.status === 'simulada' ? 'Editar' : 'Ver', onclick: (r) => navigate('#/ops/' + r.id) },
          ]
        });
    container.replaceChildren(header, filtro, body);
  }
```

- [ ] **Step 3: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 25` / `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fase5b): coluna tipo e filtro na lista de OPs"
```

---

## Task 4: `buildEntregaInlineForm` — flag `comDestino`

**Files:**
- Modify: `index.html` — `buildEntregaInlineForm` (~444)

- [ ] **Step 1: Adicionar o flag e condicionar o select**

Trocar a assinatura + criação do select:

```js
function buildEntregaInlineForm({ opItens, modelosById, entrega = null, latexOptions = [] }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const dataInput = textInput({ type: 'date', value: entrega?.data || hoje });
  const obsInput = textInput({ type: 'text', value: entrega?.observacao || '', placeholder: 'observação (opcional)' });
  const destinoSelect = selectInput({
    options: latexOptions,
    value: entrega?.destino_fornecedor_id ?? '',
    placeholder: '— selecione a empresa de látex —',
  });
```

por:

```js
function buildEntregaInlineForm({ opItens, modelosById, entrega = null, latexOptions = [], comDestino = true }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const dataInput = textInput({ type: 'date', value: entrega?.data || hoje });
  const obsInput = textInput({ type: 'text', value: entrega?.observacao || '', placeholder: 'observação (opcional)' });
  const destinoSelect = comDestino ? selectInput({
    options: latexOptions,
    value: entrega?.destino_fornecedor_id ?? '',
    placeholder: '— selecione a empresa de látex —',
  }) : null;
```

- [ ] **Step 2: Condicionar o campo no layout**

Trocar:

```js
      el('div', { class: 'w-64 min-w-[200px]' }, formField({ label: 'Destino (látex)', input: destinoSelect })),
```

por:

```js
      comDestino ? el('div', { class: 'w-64 min-w-[200px]' }, formField({ label: 'Destino (látex)', input: destinoSelect })) : el('span', {}),
```

- [ ] **Step 3: Condicionar no `getPayload`**

Trocar:

```js
    const destino = destinoSelect.value === '' ? null : Number(destinoSelect.value);
    return { data: dataInput.value || hoje, observacao: obsInput.value || null, destino_fornecedor_id: destino, linhas };
```

por:

```js
    const destino = (comDestino && destinoSelect && destinoSelect.value !== '') ? Number(destinoSelect.value) : null;
    return { data: dataInput.value || hoje, observacao: obsInput.value || null, destino_fornecedor_id: destino, linhas };
```

- [ ] **Step 4: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 25` / `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(fase5b): flag comDestino no form de entrega (latex sem destino)"
```

---

## Task 5: Criação automática — `salvarEntregaCima` chama `gerar_op_latex`

**Files:**
- Modify: `index.html` — `salvarEntregaCima` (~503)

- [ ] **Step 1: Chamar a RPC após gravar os itens**

Trocar o final de `salvarEntregaCima`:

```js
  const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
  const insItens = await supa.from('entrega_itens').insert(itens);
  if (insItens.error) {
    await supa.from('entregas').delete().eq('id', entregaId);
    toast('Erro ao gravar itens da entrega', 'error'); console.error(insItens.error); return false;
  }
  toast('Entrega registrada', 'success');
  return true;
}
```

por:

```js
  const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
  const insItens = await supa.from('entrega_itens').insert(itens);
  if (insItens.error) {
    await supa.from('entregas').delete().eq('id', entregaId);
    toast('Erro ao gravar itens da entrega', 'error'); console.error(insItens.error); return false;
  }
  // Fase 5b: a entrega de tecelagem gera automaticamente a OP de látex.
  const rpc = await supa.rpc('gerar_op_latex', { p_entrega_id: entregaId });
  if (rpc.error) {
    toast('Entrega salva, mas falhou ao gerar a OP de látex. Gere manualmente.', 'error');
    console.error(rpc.error);
    return true;
  }
  toast('Entrega registrada' + (rpc.data ? ' · OP de látex gerada' : ''), 'success');
  return true;
}
```

- [ ] **Step 2: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 25` / `fail 0`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(fase5b): salvar entrega de tecelagem gera a OP de latex via RPC"
```

---

## Task 6: Persistência dos recebimentos de látex

**Files:**
- Modify: `index.html` — adicionar após `atualizarEntregaCima` (~538)

- [ ] **Step 1: Adicionar `salvarEntregaLatex` e `atualizarEntregaLatex`**

Logo após o fim da função `atualizarEntregaCima` (antes de `excluirEntrega`), inserir:

```js
// Persistência dos recebimentos de látex (Fase 5b). Espelha as de tecelagem,
// mas etapa='latex', sem destino e sem gerar OP (a OP de látex já existe).
async function salvarEntregaLatex({ fornecedorId, opId, payload }) {
  if (payload.linhas.length === 0) { toast('Adicione ao menos 1 item com metros recebidos', 'error'); return false; }
  const ins = await supa.from('entregas').insert({
    fornecedor_id: fornecedorId, etapa: 'latex', data: payload.data, observacao: payload.observacao,
  }).select().single();
  if (ins.error) { toast('Erro ao gravar recebimento', 'error'); console.error(ins.error); return false; }
  const entregaId = ins.data.id;
  const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
  const insItens = await supa.from('entrega_itens').insert(itens);
  if (insItens.error) {
    await supa.from('entregas').delete().eq('id', entregaId);
    toast('Erro ao gravar itens do recebimento', 'error'); console.error(insItens.error); return false;
  }
  toast('Recebimento registrado', 'success');
  return true;
}

async function atualizarEntregaLatex({ entregaId, opId, payload }) {
  if (payload.linhas.length === 0) { toast('Adicione ao menos 1 item com metros recebidos', 'error'); return false; }
  const upd = await supa.from('entregas').update({
    data: payload.data, observacao: payload.observacao,
  }).eq('id', entregaId);
  if (upd.error) { toast('Erro ao atualizar recebimento', 'error'); console.error(upd.error); return false; }
  await supa.from('entrega_itens').delete().eq('entrega_id', entregaId);
  const itens = payload.linhas.map(l => ({ entrega_id: entregaId, op_id: opId, ...l }));
  const insItens = await supa.from('entrega_itens').insert(itens);
  if (insItens.error) { toast('Erro ao regravar itens do recebimento', 'error'); console.error(insItens.error); return false; }
  toast('Recebimento atualizado', 'success');
  return true;
}
```

(`excluirEntrega` já é genérica — serve para recebimentos de látex também.)

- [ ] **Step 2: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 25` / `fail 0`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(fase5b): persistencia dos recebimentos de latex"
```

---

## Task 7: Tela da empresa de látex (`screenFornecedorLatex`) + rota

**Files:**
- Modify: `index.html` — adicionar `screenFornecedorLatex` após `screenFornecedorEntregas`; ajustar `routes` (~273) e `routeAfterLogin` (~366)

- [ ] **Step 1: Registrar a rota e o roteamento pós-login**

Em `routes`, adicionar a linha:

```js
  '#/fornecedor/latex': { render: screenFornecedorLatex, roles: ['fornecedor'] },
```

Em `routeAfterLogin`, trocar:

```js
  else if (t === 'latex') navigate('#/fornecedor/entregas');  // fallback temporário até a Fase 5b
```

por:

```js
  else if (t === 'latex') navigate('#/fornecedor/latex');
```

- [ ] **Step 2: Adicionar a tela (espelha `screenFornecedorEntregas`, para látex)**

Adicionar a função (após `screenFornecedorEntregas`):

```js
async function screenFornecedorLatex() {
  const container = el('div', {});

  async function reload() {
    if (!CURRENT_USER.fornecedor_id) {
      container.replaceChildren(
        pageHeader('Meus recebimentos de látex'),
        el('div', { class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500' },
          'Seu usuário não está vinculado a um fornecedor. Fale com o administrador.')
      );
      return;
    }

    const opfRes = await supa.from('op_fornecedores')
      .select('op_id, ops!inner(id, numero, ano, status, tipo, observacao, origem_op_id, op_itens(id, modelo_id, metros_pedidos))')
      .eq('fornecedor_id', CURRENT_USER.fornecedor_id)
      .eq('etapa', 'latex');
    if (opfRes.error) { toast('Erro ao carregar OPs de látex', 'error'); console.error(opfRes.error); return; }
    const ops = (opfRes.data || [])
      .map(r => r.ops)
      .filter(o => o && o.tipo === 'latex' && o.status === 'em_producao');

    const entRes = await supa.from('entregas')
      .select('id, data, observacao, criado_em, entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
      .eq('fornecedor_id', CURRENT_USER.fornecedor_id)
      .eq('etapa', 'latex')
      .order('data', { ascending: false })
      .order('id', { ascending: false });
    if (entRes.error) { toast('Erro ao carregar recebimentos', 'error'); console.error(entRes.error); return; }
    const entregas = entRes.data || [];

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
    const blocos = [pageHeader('Meus recebimentos de látex')];

    if (ops.length === 0) {
      blocos.push(el('div', { class: 'bg-white rounded-xl shadow p-8 text-center text-gray-500 mb-6' },
        'Nenhuma OP de látex em produção atribuída a você no momento.'));
    } else {
      for (const op of ops) {
        const recebidosNaOP = entregas.flatMap(e => e.entrega_itens || []).filter(ei => ei.op_id === op.id);
        const totalPorItem = totalEntregueCimaPorItem(recebidosNaOP);

        const card = el('div', { class: 'bg-white rounded-xl shadow p-5 mb-6' });
        card.appendChild(el('div', { class: 'flex items-center justify-between mb-3' },
          el('div', { class: 'font-semibold text-gray-800' }, `OP de látex Nº ${op.numero}/${op.ano}`),
          badgeStatus(op.status),
        ));
        if (op.observacao) card.appendChild(el('div', { class: 'text-xs text-gray-500 mb-2' }, op.observacao));

        card.appendChild(dataTable({
          columns: [
            { key: 'modelo', label: 'Modelo', render: (i) => {
                const m = modelosById[i.modelo_id];
                return m ? `${m.nome} ${larguraKey(m.largura)}m · ${m.cor_1?.nome || '?'}/${m.cor_2?.nome || '?'}` : ('#' + i.modelo_id);
              } },
            { key: 'enviado', label: 'Enviado', render: (i) => fmtMetros(i.metros_pedidos) },
            { key: 'recebido', label: 'Recebido', render: (i) => fmtMetros(totalPorItem[i.id] || 0) },
            { key: 'falta', label: 'Falta', render: (i) => {
                const falta = Math.round((Number(i.metros_pedidos) - (totalPorItem[i.id] || 0)) * 100) / 100;
                const cor = falta <= 0 ? 'text-green-700' : 'text-gray-800';
                return el('span', { class: cor }, falta <= 0 ? '✅ completo' : fmtMetros(falta));
              } },
          ],
          rows: op.op_itens || [],
        }));

        const formHolder = el('div', {});
        const btnNova = el('button', {
          class: 'mt-3 text-sm text-blue-700 hover:underline',
          onclick: () => {
            const form = buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById, comDestino: false });
            const btnSalvar = el('button', {
              class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg px-3 py-2 mr-2',
              onclick: async () => {
                btnSalvar.disabled = true;
                const ok = await salvarEntregaLatex({ fornecedorId: CURRENT_USER.fornecedor_id, opId: op.id, payload: form.getPayload() });
                btnSalvar.disabled = false;
                if (ok) reload();
              },
            }, 'Salvar recebimento');
            const btnCancelar = el('button', {
              class: 'bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg px-3 py-2',
              onclick: () => { formHolder.replaceChildren(); btnNova.style.display = ''; },
            }, 'Cancelar');
            formHolder.replaceChildren(el('div', {}, form.node, el('div', { class: 'mt-2' }, btnSalvar, btnCancelar)));
            btnNova.style.display = 'none';
          },
        }, '+ Novo recebimento');
        card.appendChild(btnNova);
        card.appendChild(formHolder);
        blocos.push(card);
      }
    }

    // Histórico dos recebimentos próprios.
    const opsById = {};
    for (const o of ops) opsById[o.id] = o;
    blocos.push(el('div', { class: 'font-semibold text-gray-700 mb-2 mt-2' }, 'Histórico de recebimentos'));
    const histWrap = el('div', { class: 'bg-white rounded-xl shadow p-5' });
    if (entregas.length === 0) {
      histWrap.appendChild(el('p', { class: 'text-sm text-gray-400' }, 'Nenhum recebimento registrado ainda.'));
    } else {
      for (const entrega of entregas) {
        const itens = entrega.entrega_itens || [];
        const opId = itens[0]?.op_id;
        const opRef = opsById[opId];
        const opLabel = opRef ? `OP de látex Nº ${opRef.numero}/${opRef.ano}` : (opId ? '#' + opId : '?');
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
              onclick: () => { if (!opRef) { toast('OP de látex não está mais em produção', 'error'); return; } excluirEntrega(entrega.id, reload); } }, 'Excluir'),
          ),
        ));
        if (entrega.observacao) wrap.appendChild(el('div', { class: 'text-xs text-gray-500 mb-1' }, entrega.observacao));
        for (const ei of itens) {
          const opItem = opRef?.op_itens?.find(i => i.id === ei.op_item_id);
          const modelo = opItem ? modelosById[opItem.modelo_id] : null;
          const nome = modelo ? `${modelo.nome} ${larguraKey(modelo.largura)}m · ${modelo.cor_1?.nome || '?'}/${modelo.cor_2?.nome || '?'}` : '?';
          wrap.appendChild(el('div', { class: 'text-sm text-gray-700' },
            nome + ': ' + Number(ei.metros_entregues).toFixed(2).replace('.', ',') + ' m',
            ei.defeito ? el('span', { class: 'ml-2 text-red-600 font-semibold' }, '⚠ DEFEITO') : '',
            ei.observacao ? el('span', { class: 'ml-2 text-xs text-gray-500' }, '(' + ei.observacao + ')') : '',
          ));
        }
        histWrap.appendChild(wrap);
      }
    }
    blocos.push(histWrap);

    function abrirEdicao(entrega, opRef, modelosById) {
      if (!opRef) { toast('OP de látex não está mais em produção', 'error'); return; }
      const form = buildEntregaInlineForm({ opItens: opRef.op_itens || [], modelosById, entrega, comDestino: false });
      modal({
        title: `Editar recebimento — OP de látex Nº ${opRef.numero}/${opRef.ano}`,
        body: form.node,
        saveLabel: 'Salvar alterações',
        onSave: async () => {
          const ok = await atualizarEntregaLatex({ entregaId: entrega.id, opId: opRef.id, payload: form.getPayload() });
          if (ok) reload();
          return ok;
        },
      });
    }

    container.replaceChildren(...blocos);
  }

  await reload();
  return shellLayout([{ href: '#/fornecedor/latex', label: 'Meus recebimentos de látex' }], container);
}
```

> O menu do fornecedor é um array inline (mesmo padrão de `screenFornecedorEntregas`, que usa `shellLayout([{ href: '#/fornecedor/entregas', label: 'Minhas entregas' }], container)`).

- [ ] **Step 3: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 25` / `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fase5b): tela de recebimentos de latex do fornecedor"
```

---

## Task 8: Detalhe admin da OP de látex + navegação

**Files:**
- Modify: `index.html` — `screenNovaOP` (busca da OP ~922-953 e ramificação) e bloco da tecelagem (`buildBlocoTecelagem` ~1227, histórico ~1300)

- [ ] **Step 1: Trazer `tipo`/origem na busca da OP e ramificar**

Em `screenNovaOP`, dentro do bloco `if (opId) {`, trocar o `select` da busca da OP:

```js
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, op_itens(id, modelo_id, metros_pedidos, metros_ajustados), op_fornecedores(fornecedor_id, etapa)')
      .eq('id', opId).single();
```

por:

```js
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, tipo, observacao, origem_op_id, op_itens(id, modelo_id, metros_pedidos, metros_ajustados), op_fornecedores(fornecedor_id, etapa)')
      .eq('id', opId).single();
```

E logo após a linha `op = data;` (que vem depois do tratamento de erro), inserir a ramificação:

```js
    op = data;
    if (op.tipo === 'latex') return await renderOPLatexAdmin(op.id);
```

(A variável `op` já existe no escopo de `screenNovaOP`; `renderOPLatexAdmin` é definida na Task 8 Step 2 e carrega a OP por conta própria.)

- [ ] **Step 2: Adicionar o detalhe admin da OP de látex**

Adicionar a função `renderOPLatexAdmin(opId)` (logo após `screenNovaOP`):

```js
async function renderOPLatexAdmin(opId) {
  const container = el('div', {});
  const fmtMetros = (n) => Number(n).toFixed(2).replace('.', ',') + ' m';

  async function reload() {
    const opRes = await supa.from('ops')
      .select('id, numero, ano, status, tipo, observacao, origem_op_id, op_itens(id, modelo_id, metros_pedidos), op_fornecedores(fornecedor_id, etapa, fornecedores:fornecedor_id(nome))')
      .eq('id', opId).single();
    if (opRes.error) { toast('Erro ao carregar OP de látex', 'error'); console.error(opRes.error); return; }
    const op = opRes.data;
    const latexForn = (op.op_fornecedores || []).find(f => f.etapa === 'latex');
    const latexFornecedorId = latexForn ? latexForn.fornecedor_id : null;

    const entRes = await supa.from('entregas')
      .select('id, fornecedor_id, data, observacao, entrega_itens(id, op_id, op_item_id, metros_entregues, defeito, observacao)')
      .eq('etapa', 'latex').eq('fornecedor_id', latexFornecedorId)
      .order('data', { ascending: false }).order('id', { ascending: false });
    const recebimentos = (entRes.data || []).filter(e => (e.entrega_itens || []).some(ei => ei.op_id === op.id));

    const modeloIds = [...new Set((op.op_itens || []).map(i => i.modelo_id))];
    const modelosRes = modeloIds.length
      ? await supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)').in('id', modeloIds)
      : { data: [] };
    const modelosById = {};
    for (const m of (modelosRes.data || [])) modelosById[m.id] = m;

    render(op, recebimentos, modelosById, latexFornecedorId);
  }

  function render(op, recebimentos, modelosById, latexFornecedorId) {
    const recItens = recebimentos.flatMap(e => (e.entrega_itens || []).filter(ei => ei.op_id === op.id));
    const totalPorItem = totalEntregueCimaPorItem(recItens);

    const acoes = [{ label: '← Voltar', onclick: () => navigate('#/ops') }];
    if (op.origem_op_id) acoes.push({ label: 'Ir para OP de tecelagem', onclick: () => navigate('#/ops/' + op.origem_op_id) });
    if (op.status === 'em_producao') acoes.push({ label: 'Finalizar OP de látex', onclick: () => finalizar(op.id) });
    const header = pageHeader(`OP de látex Nº ${op.numero}/${op.ano}`, acoes);

    const info = el('div', { class: 'bg-white rounded-xl shadow p-5 mb-4' },
      el('div', { class: 'flex items-center gap-3 mb-2' }, badgeTipo('latex'), badgeStatus(op.status)),
      op.observacao ? el('div', { class: 'text-sm text-gray-600' }, op.observacao) : el('span', {}),
    );

    const tabela = dataTable({
      columns: [
        { key: 'modelo', label: 'Modelo', render: (i) => {
            const m = modelosById[i.modelo_id];
            return m ? `${m.nome} ${larguraKey(m.largura)}m · ${m.cor_1?.nome || '?'}/${m.cor_2?.nome || '?'}` : ('#' + i.modelo_id);
          } },
        { key: 'enviado', label: 'Enviado', render: (i) => fmtMetros(i.metros_pedidos) },
        { key: 'recebido', label: 'Recebido', render: (i) => fmtMetros(totalPorItem[i.id] || 0) },
        { key: 'falta', label: 'Falta', render: (i) => {
            const falta = Math.round((Number(i.metros_pedidos) - (totalPorItem[i.id] || 0)) * 100) / 100;
            return el('span', { class: falta <= 0 ? 'text-green-700' : 'text-gray-800' }, falta <= 0 ? '✅ completo' : fmtMetros(falta));
          } },
      ],
      rows: op.op_itens || [],
    });

    const box = el('div', { class: 'bg-white rounded-xl shadow p-5' });
    box.appendChild(el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Recebimentos'));

    if (op.status === 'em_producao' && latexFornecedorId) {
      const formHolder = el('div', {});
      const btnNova = el('button', { class: 'text-sm text-blue-700 hover:underline mb-2',
        onclick: () => {
          const form = buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById, comDestino: false });
          const btnSalvar = el('button', { class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg px-3 py-2 mr-2',
            onclick: async () => { btnSalvar.disabled = true;
              const ok = await salvarEntregaLatex({ fornecedorId: latexFornecedorId, opId: op.id, payload: form.getPayload() });
              btnSalvar.disabled = false; if (ok) reload(); } }, 'Salvar recebimento');
          const btnCancelar = el('button', { class: 'bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg px-3 py-2',
            onclick: () => { formHolder.replaceChildren(); btnNova.style.display = ''; } }, 'Cancelar');
          formHolder.replaceChildren(el('div', {}, form.node, el('div', { class: 'mt-2' }, btnSalvar, btnCancelar)));
          btnNova.style.display = 'none';
        } }, '+ Novo recebimento');
      box.appendChild(btnNova);
      box.appendChild(formHolder);
    }

    if (recebimentos.length === 0) {
      box.appendChild(el('p', { class: 'text-sm text-gray-400 mt-2' }, 'Nenhum recebimento registrado ainda.'));
    } else {
      for (const ent of recebimentos) {
        const sub = el('div', { class: 'border-b py-3' });
        sub.appendChild(el('div', { class: 'flex items-center justify-between' },
          el('div', { class: 'text-sm' }, el('b', {}, new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR'))),
          op.status === 'em_producao' ? el('div', {},
            el('button', { class: 'text-sm text-blue-700 hover:underline mr-3',
              onclick: () => abrirEdicaoAdmin(ent, op, modelosById) }, 'Editar'),
            el('button', { class: 'text-sm text-red-600 hover:underline',
              onclick: () => excluirEntrega(ent.id, reload) }, 'Excluir'),
          ) : '',
        ));
        if (ent.observacao) sub.appendChild(el('div', { class: 'text-xs text-gray-500' }, ent.observacao));
        for (const ei of (ent.entrega_itens || []).filter(x => x.op_id === op.id)) {
          const it = (op.op_itens || []).find(i => i.id === ei.op_item_id);
          const m = it ? modelosById[it.modelo_id] : null;
          const nome = m ? `${m.nome} ${larguraKey(m.largura)}m · ${m.cor_1?.nome || '?'}/${m.cor_2?.nome || '?'}` : '?';
          sub.appendChild(el('div', { class: 'text-sm text-gray-700' },
            nome + ': ' + fmtMetros(ei.metros_entregues),
            ei.defeito ? el('span', { class: 'ml-2 text-red-600 font-semibold' }, '⚠ DEFEITO') : '',
            ei.observacao ? el('span', { class: 'ml-2 text-xs text-gray-500' }, '(' + ei.observacao + ')') : '',
          ));
        }
        box.appendChild(sub);
      }
    }

    function abrirEdicaoAdmin(ent, op, modelosById) {
      const form = buildEntregaInlineForm({ opItens: op.op_itens || [], modelosById, entrega: ent, comDestino: false });
      modal({
        title: `Editar recebimento — ${new Date(ent.data + 'T00:00:00').toLocaleDateString('pt-BR')}`,
        body: form.node, saveLabel: 'Salvar alterações',
        onSave: async () => { const ok = await atualizarEntregaLatex({ entregaId: ent.id, opId: op.id, payload: form.getPayload() }); if (ok) reload(); return ok; },
      });
    }

    container.replaceChildren(header, info, tabela, el('div', { class: 'h-4' }), box);
  }

  async function finalizar(id) {
    confirmDialog({
      title: 'Finalizar OP de látex',
      message: 'Marcar esta OP de látex como finalizada?',
      confirmLabel: 'Finalizar',
      onConfirm: async () => {
        const r = await supa.from('ops').update({ status: 'finalizada', finalizada_em: new Date().toISOString() }).eq('id', id);
        if (r.error) { toast('Erro ao finalizar', 'error'); console.error(r.error); return; }
        toast('OP de látex finalizada', 'success'); reload();
      },
    });
  }

  await reload();
  return shellLayout(ADMIN_MENU, container);
}
```

- [ ] **Step 3: Link "Ver OP de látex" no histórico de entregas da tecelagem (bloco admin)**

(a) Declarar o mapa no escopo da screen, junto de `let entregasCima = [];` (~896):

```js
  let latexOpPorEntrega = {};
```

(b) Popular o mapa nos DOIS pontos onde as entregas de tecelagem são carregadas — no load inicial (logo após a linha `entregasCima = (entRes.data || []).filter(...)` dentro do bloco `if (opId)`, ~953) e dentro de `reloadEntregasCima` (após a linha equivalente que reatribui `entregasCima`). Em cada ponto, inserir:

```js
      const latexOpsRes = await supa.from('ops').select('id, origem_entrega_id').eq('tipo', 'latex').eq('origem_op_id', op.id);
      latexOpPorEntrega = {};
      for (const lo of (latexOpsRes.data || [])) if (lo.origem_entrega_id) latexOpPorEntrega[lo.origem_entrega_id] = lo.id;
```

(c) No `buildBlocoTecelagem`, no subcard de cada entrega do histórico, dentro do bloco de botões (após o botão "Excluir", ~1313), adicionar condicionalmente:

```js
            latexOpPorEntrega[ent.id] ? el('button', { class: 'text-sm text-amber-700 hover:underline ml-3',
              onclick: () => navigate('#/ops/' + latexOpPorEntrega[ent.id]) }, 'Ver OP de látex') : '',
```

- [ ] **Step 4: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 25` / `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(fase5b): detalhe admin da OP de latex e navegacao entre OPs"
```

---

## Task 9: Ajuste manual do "enviado" (admin)

**Files:**
- Modify: `index.html` — `renderOPLatexAdmin` (adicionar edição dos `op_itens` e exclusão da OP)

- [ ] **Step 1: Adicionar botões de ajuste manual no cabeçalho da OP de látex**

Em `renderOPLatexAdmin`, dentro de `render(...)`, acrescentar ao array `acoes` (apenas quando `op.status === 'em_producao'`):

```js
    if (op.status === 'em_producao') acoes.push({ label: 'Editar enviado', onclick: () => editarEnviado(op, modelosById) });
    acoes.push({ label: 'Excluir OP de látex', onclick: () => excluirOpLatex(op.id) });
```

(Coloque estas linhas logo após o `push` do "Finalizar OP de látex".)

- [ ] **Step 2: Adicionar as funções `editarEnviado` e `excluirOpLatex`**

Dentro de `renderOPLatexAdmin` (no mesmo nível de `finalizar`), adicionar:

```js
  function editarEnviado(op, modelosById) {
    const linhas = (op.op_itens || []).map(it => {
      const m = modelosById[it.modelo_id];
      const rotulo = m ? `${m.nome} ${larguraKey(m.largura)}m · ${m.cor_1?.nome || '?'}/${m.cor_2?.nome || '?'}` : ('#' + it.modelo_id);
      const input = textInput({ type: 'number', step: '0.01', value: String(it.metros_pedidos) });
      return { id: it.id, input, node: el('div', { class: 'flex items-center gap-2 mb-2' },
        el('div', { class: 'flex-1 text-sm text-gray-700' }, rotulo),
        el('div', { class: 'w-32' }, formField({ label: 'Enviado (m)', input })),
      ) };
    });
    modal({
      title: 'Editar enviado (manual)',
      body: el('div', {}, el('p', { class: 'text-xs text-gray-500 mb-3' }, 'Ajuste os metros enviados por modelo.'), ...linhas.map(l => l.node)),
      saveLabel: 'Salvar',
      onSave: async () => {
        for (const l of linhas) {
          const val = l.input.value === '' ? 0 : Number(l.input.value);
          const r = await supa.from('op_itens').update({ metros_pedidos: val }).eq('id', l.id);
          if (r.error) { toast('Erro ao salvar enviado', 'error'); console.error(r.error); return false; }
        }
        toast('Enviado atualizado', 'success'); reload(); return true;
      },
    });
  }

  function excluirOpLatex(id) {
    confirmDialog({
      title: 'Excluir OP de látex',
      message: 'Isto remove a OP de látex e seus itens (recebimentos lançados também serão afetados). Continuar?',
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const r = await supa.from('ops').delete().eq('id', id);
        if (r.error) { toast('Erro ao excluir OP de látex', 'error'); console.error(r.error); return; }
        toast('OP de látex excluída', 'success'); navigate('#/ops');
      },
    });
  }
```

> `metros_pedidos` tem CHECK `> 0` no schema; o input deve ser > 0. Se o usuário zerar, o update falha e mostramos o toast de erro (comportamento aceitável). Não permitir 0 na UI seria um polimento futuro.

- [ ] **Step 3: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 25` / `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fase5b): ajuste manual do enviado e exclusao da OP de latex"
```

---

## Task 10: Checklist de QA da Fase 5b

**Files:**
- Create: `docs/qa/fase5b-checklist.md`

- [ ] **Step 1: Criar o checklist**

```markdown
# QA — Fase 5b: OP de Látex

Pré-requisitos: rodar `db/08_fase5b_latex.sql` no Supabase; ter ao menos 1 empresa de látex cadastrada; uma OP de tecelagem `em_producao` com fornecedor de tecelagem.

## Cálculo (automatizado — `node --test tests/calculo-op.test.js`)
- [x] 1. `totalEntregueCimaPorItem` soma o recebido de látex (mesma forma de dados).
- [x] 2. Recebido de látex ignora itens com defeito.

## Criação automática (RPC `gerar_op_latex`)
- [ ] 3. Salvar uma entrega de tecelagem (com destino) cria 1 OP `tipo='latex'`.
- [ ] 4. A OP de látex tem número próprio sequencial (não colide com as de tecelagem).
- [ ] 5. Os `op_itens` da OP de látex = enviado por modelo (soma sem defeito).
- [ ] 6. `op_fornecedores` da OP de látex aponta para a empresa de látex (destino).
- [ ] 7. Editar a entrega de tecelagem NÃO altera a OP de látex (independente).
- [ ] 8. Salvar a MESMA entrega de novo não duplica a OP de látex (idempotência).
- [ ] 9. Entrega só com defeito não gera OP de látex.

## Lista de OPs (admin)
- [ ] 10. Coluna "Tipo" mostra badge Tecelagem/Látex.
- [ ] 11. Filtro Todas/Tecelagem/Látex funciona.

## Detalhe da OP de látex (admin)
- [ ] 12. Tabela Enviado × Recebido × Falta por modelo bate.
- [ ] 13. Botão "Ir para OP de tecelagem" navega para a OP de origem.
- [ ] 14. Na OP de tecelagem, "Ver OP de látex" navega para a OP de látex gerada.
- [ ] 15. Admin lança/edita/exclui recebimento; Recebido e Falta atualizam.
- [ ] 16. Admin edita o "enviado" (op_itens) manualmente e o valor persiste.
- [ ] 17. Admin finaliza a OP de látex (status `finalizada`); bloco vira leitura.
- [ ] 18. Admin exclui a OP de látex.

## Empresa de látex (logada)
- [ ] 19. Login da empresa de látex cai em `#/fornecedor/latex`.
- [ ] 20. Vê apenas as próprias OPs de látex em produção (RLS).
- [ ] 21. Registra recebimento por modelo (sem campo de destino) e vê no histórico.
- [ ] 22. Editar/excluir os próprios recebimentos funciona.

## Resultado
(preencher após execução: X/22)
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa/fase5b-checklist.md
git commit -m "docs(fase5b): checklist de QA da OP de latex"
```

---

## Pendências de deploy (manuais, fora do código)

- Rodar `db/08_fase5b_latex.sql` no SQL Editor do Supabase (schema + função `gerar_op_latex` + GRANT).
- Verificar a RPC manualmente (criar entrega de teste → `select gerar_op_latex(<id>)` → conferir OP/itens/fornecedor; rodar de novo → não duplica).
- Executar o QA manual (itens 3–22).
- A ordem importa: o SQL precisa rodar **antes** de o front novo ir pro ar (Pages serve da `main`), senão as telas que leem `ops.tipo`/chamam a RPC quebram.
