# Fase 6 — Cliente, Lote, fios sob demanda, % e PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar Cliente e Lote (sequencial automático) à OP, tornar os fornecedores de fio opcionais na abertura (atribuídos depois pelo admin), mostrar uma barra de % entregue na lista de OPs, e gerar um PDF de compra de fios.

**Architecture:** Tabelas novas `clientes` e `lotes`; `ops.lote_id` (nullable) liga OP→lote→cliente; OP manual cria um lote novo no 1º salvamento; OPs de látex herdam o lote via `gerar_op_latex`. `ordens_compra_fio.fornecedor_id` vira nullable; o admin atribui o fornecedor de fio (por tipo) no detalhe da OP, criando o vínculo `op_fornecedores`. Funções puras novas para % e agrupamento do PDF; PDF via jsPDF (CDN com SRI).

**Tech Stack:** HTML/CSS/JS vanilla + Supabase (Postgres + RLS). Testes de funções puras em `tests/calculo-op.test.js` (`node --test`). DOM/SQL/PDF verificados manualmente (padrão `docs/qa/`).

---

## File Structure

- **Create** `db/09_fase6_cliente_lote.sql` — `clientes`, `lotes`, `ops.lote_id`, `ordens_compra_fio.fornecedor_id` nullable, RLS, `gerar_op_latex` atualizada.
- **Modify** `js/calculo-op.js` + `tests/calculo-op.test.js` — `percentualEntregueOP`, `agruparOrdensCompraFio`.
- **Modify** `index.html`:
  - `<head>`: script jsPDF (CDN + SRI).
  - Cadastro de Clientes (`screenCadastrosClientes`) + rota + item no `ADMIN_MENU`.
  - `screenNovaOP`: carrega clientes; campo Cliente (obrigatório) + criação do lote; fios opcionais (só `cima` obrigatório); remove selects de fio da criação; query da OP traz lote/cliente.
  - `buildBlocoFios`: atribuição de fornecedor de fio por tipo (algodão/poliéster).
  - Cabeçalho da OP (tecelagem e látex): "Lote Nº · Cliente".
  - `screenListaOPs`: colunas Lote/Cliente + barra de %.
  - Botão "PDF de compra de fios" no detalhe.
- **Create** `docs/qa/fase6-checklist.md`.

**Nota:** os 25 testes atuais devem permanecer verdes (regressão). RPC/DOM/PDF verificados manualmente.

---

## Task 1: Migração de banco (clientes, lotes, ops.lote_id, fio nullable, gerar_op_latex)

**Files:**
- Create: `db/09_fase6_cliente_lote.sql`

- [ ] **Step 1: Criar o arquivo**

```sql
-- ============================================================
-- Fase 6 — Cliente, Lote, fios sob demanda
-- Idempotente: pode rodar várias vezes.
-- ============================================================

-- 1) Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Lotes (numero sequencial global + cliente)
CREATE TABLE IF NOT EXISTS lotes (
  id BIGSERIAL PRIMARY KEY,
  numero INTEGER NOT NULL UNIQUE,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) OP aponta pro lote (nullable; OPs antigas ficam sem lote)
ALTER TABLE ops
  ADD COLUMN IF NOT EXISTS lote_id BIGINT REFERENCES lotes(id) ON DELETE SET NULL;

-- 4) Ordem de fio pode nascer sem fornecedor
ALTER TABLE ordens_compra_fio ALTER COLUMN fornecedor_id DROP NOT NULL;

-- 5) RLS admin-only para clientes e lotes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clientes_admin ON clientes;
CREATE POLICY clientes_admin ON clientes FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS lotes_admin ON lotes;
CREATE POLICY lotes_admin ON lotes FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 6) gerar_op_latex: OP de látex herda o lote_id da OP de origem
CREATE OR REPLACE FUNCTION gerar_op_latex(p_entrega_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega       entregas%ROWTYPE;
  v_op_id         BIGINT;
  v_lote_id       BIGINT;
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

  IF NOT (is_admin() OR v_entrega.fornecedor_id = meu_fornecedor_id()) THEN
    RAISE EXCEPTION 'Sem permissão para gerar OP de látex da entrega %', p_entrega_id;
  END IF;

  IF v_entrega.destino_fornecedor_id IS NULL THEN
    RAISE EXCEPTION 'Entrega % sem destino de látex', p_entrega_id;
  END IF;

  SELECT id INTO v_latex_op_id FROM ops
    WHERE tipo = 'latex' AND origem_entrega_id = p_entrega_id;
  IF v_latex_op_id IS NOT NULL THEN
    RETURN v_latex_op_id;
  END IF;

  SELECT op_id INTO v_op_id FROM entrega_itens WHERE entrega_id = p_entrega_id LIMIT 1;
  IF v_op_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM entrega_itens
    WHERE entrega_id = p_entrega_id AND defeito = FALSE AND metros_entregues > 0
  ) THEN
    RETURN NULL;
  END IF;

  SELECT lote_id INTO v_lote_id FROM ops WHERE id = v_op_id;

  v_ano := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_numero
    FROM ops WHERE tipo = 'latex' AND ano = v_ano;

  INSERT INTO ops (numero, ano, status, tipo, origem_op_id, origem_entrega_id, lote_id, observacao)
  VALUES (
    v_numero, v_ano, 'em_producao', 'latex', v_op_id, p_entrega_id, v_lote_id,
    'Gerada da entrega de ' || to_char(v_entrega.data, 'DD/MM/YYYY')
      || ' da OP ' || (SELECT numero || '/' || ano FROM ops WHERE id = v_op_id) || ' (tecelagem)'
  )
  RETURNING id INTO v_latex_op_id;

  INSERT INTO op_itens (op_id, modelo_id, metros_pedidos)
  SELECT v_latex_op_id, oi.modelo_id, SUM(ei.metros_entregues)
  FROM entrega_itens ei
  JOIN op_itens oi ON oi.id = ei.op_item_id
  WHERE ei.entrega_id = p_entrega_id AND ei.defeito = FALSE AND ei.metros_entregues > 0
  GROUP BY oi.modelo_id;

  INSERT INTO op_fornecedores (op_id, fornecedor_id, etapa)
  VALUES (v_latex_op_id, v_entrega.destino_fornecedor_id, 'latex')
  ON CONFLICT (op_id, fornecedor_id, etapa) DO NOTHING;

  RETURN v_latex_op_id;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_op_latex(BIGINT) TO authenticated;
```

- [ ] **Step 2: Revisão de idempotência (visual)** — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ALTER COLUMN ... DROP NOT NULL` (idempotente), `DROP POLICY IF EXISTS` antes de `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`. `ENABLE ROW LEVEL SECURITY` é idempotente. Não executar no Supabase (manual).

- [ ] **Step 3: Commit**

```bash
git add db/09_fase6_cliente_lote.sql
git commit -m "feat(fase6): schema de clientes, lotes, fio nullable e gerar_op_latex herda lote"
```

---

## Task 2: Funções puras — `percentualEntregueOP` e `agruparOrdensCompraFio`

**Files:**
- Modify: `js/calculo-op.js`, `tests/calculo-op.test.js`

- [ ] **Step 1: Escrever os testes** (no fim de `tests/calculo-op.test.js`, seguindo o padrão `test(...)`/`assert` do arquivo)

```js
test('percentualEntregueOP: usa ajustado quando houver, senão pedido', () => {
  const opItens = [
    { id: 1, metros_pedidos: 100, metros_ajustados: 80 },
    { id: 2, metros_pedidos: 20, metros_ajustados: null },
  ];
  const entregaItens = [
    { op_item_id: 1, metros_entregues: 40, defeito: false },
    { op_item_id: 2, metros_entregues: 10, defeito: false },
  ];
  // meta = 80 + 20 = 100; feito = 50 → 50%
  assert.strictEqual(percentualEntregueOP(opItens, entregaItens), 50);
});

test('percentualEntregueOP: ignora defeito e arredonda', () => {
  const opItens = [{ id: 1, metros_pedidos: 30, metros_ajustados: null }];
  const entregaItens = [
    { op_item_id: 1, metros_entregues: 10, defeito: false },
    { op_item_id: 1, metros_entregues: 5, defeito: true },
  ];
  // meta = 30; feito = 10 → 33%
  assert.strictEqual(percentualEntregueOP(opItens, entregaItens), 33);
});

test('percentualEntregueOP: meta zero retorna 0', () => {
  assert.strictEqual(percentualEntregueOP([], []), 0);
});

test('percentualEntregueOP: cap em 100 quando entregue excede a meta', () => {
  const opItens = [{ id: 1, metros_pedidos: 10, metros_ajustados: null }];
  const entregaItens = [{ op_item_id: 1, metros_entregues: 25, defeito: false }];
  assert.strictEqual(percentualEntregueOP(opItens, entregaItens), 100);
});

test('agruparOrdensCompraFio: separa por tipo, soma kg e ordena', () => {
  const ordens = [
    { tipo: 'algodao', kg_pedido: 5, cores: { nome: 'VERDE' } },
    { tipo: 'algodao', kg_pedido: 2.5, cores: { nome: 'AZUL' } },
    { tipo: 'algodao', kg_pedido: 1.5, cores: { nome: 'AZUL' } },
    { tipo: 'poliester', kg_pedido: 3, cor_poliester: 'PRETO' },
  ];
  const r = agruparOrdensCompraFio(ordens);
  assert.deepStrictEqual(r.algodao, [{ rotulo: 'AZUL', kg: 4 }, { rotulo: 'VERDE', kg: 5 }]);
  assert.deepStrictEqual(r.poliester, [{ rotulo: 'PRETO', kg: 3 }]);
  assert.strictEqual(r.totalAlgodao, 9);
  assert.strictEqual(r.totalPoliester, 3);
});

test('agruparOrdensCompraFio: lista vazia', () => {
  const r = agruparOrdensCompraFio([]);
  assert.deepStrictEqual(r, { algodao: [], poliester: [], totalAlgodao: 0, totalPoliester: 0 });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/calculo-op.test.js`
Expected: FAIL — `percentualEntregueOP`/`agruparOrdensCompraFio is not defined`.

- [ ] **Step 3: Implementar em `js/calculo-op.js`** (adicionar antes do bloco `if (typeof module ...`)

```js
// % entregue de uma OP (Fase 6). meta = soma de (ajustado ?? pedido) dos op_itens;
// feito = soma de metros_entregues sem defeito dos entrega_itens da OP. Cap 0..100.
function percentualEntregueOP(opItens, entregaItens) {
  const meta = (opItens || []).reduce((s, i) => {
    const m = (i.metros_ajustados == null ? Number(i.metros_pedidos) : Number(i.metros_ajustados));
    return s + (Number.isFinite(m) ? m : 0);
  }, 0);
  if (!(meta > 0)) return 0;
  const feito = (entregaItens || []).reduce((s, ei) => {
    if (ei.defeito) return s;
    const m = Number(ei.metros_entregues);
    return s + (Number.isFinite(m) ? m : 0);
  }, 0);
  return Math.min(100, Math.round((feito / meta) * 100));
}

// Agrupa ordens de compra de fio por tipo p/ o PDF (Fase 6). Soma kg por rótulo,
// ordena alfabeticamente. Algodão usa a cor; poliéster usa PRETO/BRANCO.
function agruparOrdensCompraFio(ordens) {
  const acc = { algodao: {}, poliester: {} };
  for (const o of (ordens || [])) {
    if (o.tipo === 'algodao') {
      const rot = (o.cores && o.cores.nome) ? o.cores.nome : '?';
      acc.algodao[rot] = (acc.algodao[rot] || 0) + (Number(o.kg_pedido) || 0);
    } else if (o.tipo === 'poliester') {
      const rot = o.cor_poliester || '?';
      acc.poliester[rot] = (acc.poliester[rot] || 0) + (Number(o.kg_pedido) || 0);
    }
  }
  const r2 = (n) => Math.round(n * 1000) / 1000;
  const toList = (m) => Object.keys(m).sort().map(rotulo => ({ rotulo, kg: r2(m[rotulo]) }));
  const algodao = toList(acc.algodao);
  const poliester = toList(acc.poliester);
  const soma = (l) => r2(l.reduce((s, x) => s + x.kg, 0));
  return { algodao, poliester, totalAlgodao: soma(algodao), totalPoliester: soma(poliester) };
}
```

E no `module.exports`, trocar:
```js
  module.exports = { larguraKey, calcularFiosOP, montarOrdensCompraFio, recalcularOP, consumoPorOrdem, totalEntregueCimaPorItem };
```
por:
```js
  module.exports = { larguraKey, calcularFiosOP, montarOrdensCompraFio, recalcularOP, consumoPorOrdem, totalEntregueCimaPorItem, percentualEntregueOP, agruparOrdensCompraFio };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 31` / `fail 0` (25 + 6 novos).

- [ ] **Step 5: Commit**

```bash
git add js/calculo-op.js tests/calculo-op.test.js
git commit -m "feat(fase6): funcoes puras percentualEntregueOP e agruparOrdensCompraFio"
```

---

## Task 3: Cadastro de Clientes

**Files:**
- Modify: `index.html` — nova `screenCadastrosClientes`, rota, `ADMIN_MENU`

- [ ] **Step 1: Registrar rota e menu**

No objeto `routes`, junto das outras `'#/cadastros/...'`, adicionar:
```js
  '#/cadastros/clientes': { render: screenCadastrosClientes, roles: ['admin'] },
```
No `ADMIN_MENU`, após a linha de Fornecedores, adicionar:
```js
  { href: '#/cadastros/clientes',      label: 'Clientes' },
```

- [ ] **Step 2: Adicionar a tela** (após `screenCadastrosCores`)

```js
async function screenCadastrosClientes() {
  const container = el('div', {});

  async function reload() {
    const { data, error } = await supa.from('clientes').select('*').order('nome');
    if (error) { toast('Erro ao carregar clientes', 'error'); console.error(error); return; }
    render(data || []);
  }

  function render(rows) {
    container.replaceChildren(
      pageHeader('Clientes', [{ label: '+ Novo cliente', onclick: () => openModal(null) }]),
      dataTable({
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'nome', label: 'Nome' },
        ],
        rows,
        actions: [
          { label: 'Editar', onclick: (r) => openModal(r) },
          { label: 'Excluir', class: 'text-red-600 hover:underline', onclick: (r) => confirmExcluir(r) },
        ]
      })
    );
  }

  function openModal(cli) {
    const isEdit = !!cli;
    const nomeInput = textInput({ value: cli?.nome || '', placeholder: 'Ex: LOJA CENTRAL', required: true });
    const body = el('div', {}, formField({ label: 'Nome', input: nomeInput }));
    modal({
      title: isEdit ? 'Editar cliente' : 'Novo cliente',
      body,
      onSave: async () => {
        const nome = nomeInput.value.trim();
        if (!nome) { toast('Nome é obrigatório', 'error'); return false; }
        const payload = { nome };
        const { error } = isEdit
          ? await supa.from('clientes').update(payload).eq('id', cli.id)
          : await supa.from('clientes').insert(payload);
        if (error) { toast(error.message.includes('duplicate') ? 'Cliente já cadastrado' : 'Erro ao salvar', 'error'); console.error(error); return false; }
        toast(isEdit ? 'Cliente atualizado' : 'Cliente criado', 'success');
        reload();
      }
    });
  }

  function confirmExcluir(cli) {
    confirmDialog({
      title: 'Excluir cliente',
      message: `Excluir "${cli.nome}"? Se algum lote usar esse cliente, a exclusão vai falhar.`,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        const { error } = await supa.from('clientes').delete().eq('id', cli.id);
        if (error) { toast('Cliente está em uso (não dá pra excluir)', 'error'); console.error(error); return; }
        toast('Cliente excluído', 'success');
        reload();
      }
    });
  }

  await reload();
  return shellLayout(ADMIN_MENU, container);
}
```

- [ ] **Step 3: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 31` / `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fase6): cadastro de clientes"
```

---

## Task 4: Nova OP — Cliente + Lote + fios opcionais

**Files:**
- Modify: `index.html` — `screenNovaOP` (carregamento, estado, `buildLeft`, `persistir`, `renderRightInto`, query da OP)

- [ ] **Step 1: Carregar clientes**

No `Promise.all` de dados de apoio (em `screenNovaOP`), trocar:
```js
  const [modelosRes, paramsRes, fornsRes] = await Promise.all([
    supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)').order('nome'),
    supa.from('parametros_largura').select('*'),
    supa.from('fornecedores').select('id, nome, tipo').order('nome'),
  ]);
  if (modelosRes.error || paramsRes.error || fornsRes.error) {
    toast('Erro ao carregar dados da OP', 'error');
    console.error(modelosRes.error || paramsRes.error || fornsRes.error);
    return shellLayout(ADMIN_MENU, container);
  }
```
por:
```js
  const [modelosRes, paramsRes, fornsRes, clientesRes] = await Promise.all([
    supa.from('modelos').select('id, nome, largura, cor_1:cor_1_id(id,nome), cor_2:cor_2_id(id,nome)').order('nome'),
    supa.from('parametros_largura').select('*'),
    supa.from('fornecedores').select('id, nome, tipo').order('nome'),
    supa.from('clientes').select('id, nome').order('nome'),
  ]);
  if (modelosRes.error || paramsRes.error || fornsRes.error || clientesRes.error) {
    toast('Erro ao carregar dados da OP', 'error');
    console.error(modelosRes.error || paramsRes.error || fornsRes.error || clientesRes.error);
    return shellLayout(ADMIN_MENU, container);
  }
  const clientesOptions = (clientesRes.data || []).map(c => ({ value: c.id, label: c.nome }));
```

- [ ] **Step 2: Estado — `clienteSel`**

Junto de `let fornSel = ...;`, adicionar:
```js
  let clienteSel = '';
```

- [ ] **Step 3: Query da OP traz lote/cliente** (no bloco `if (opId)`)

Trocar:
```js
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, tipo, observacao, origem_op_id, op_itens(id, modelo_id, metros_pedidos, metros_ajustados), op_fornecedores(fornecedor_id, etapa)')
      .eq('id', opId).single();
```
por:
```js
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, tipo, observacao, origem_op_id, lote_id, lote:lote_id(id, numero, cliente:cliente_id(id, nome)), op_itens(id, modelo_id, metros_pedidos, metros_ajustados), op_fornecedores(fornecedor_id, etapa)')
      .eq('id', opId).single();
```
E logo após `op = data;` (antes do `if (op.tipo === 'latex')`), adicionar:
```js
    clienteSel = op.lote?.cliente?.id || '';
```

- [ ] **Step 4: `buildLeft` — campo Cliente + só tecelagem**

Trocar:
```js
    left.appendChild(el('div', { class: 'font-semibold text-gray-700 mt-5 mb-2' }, 'Fornecedores'));
    left.appendChild(buildFornField('Algodão', 'fio_algodao'));
    left.appendChild(buildFornField('Poliéster', 'fio_poliester'));
    left.appendChild(buildFornField('Tecelagem (parte de cima)', 'cima'));

    return left;
```
por:
```js
    left.appendChild(el('div', { class: 'font-semibold text-gray-700 mt-5 mb-2' }, 'Cliente'));
    const clienteSelEl = disabledAttr(selectInput({ options: clientesOptions, value: clienteSel, placeholder: 'Selecione o cliente...' }));
    clienteSelEl.addEventListener('change', () => { clienteSel = clienteSelEl.value ? Number(clienteSelEl.value) : ''; renderRight(); });
    left.appendChild(formField({ label: 'Cliente', input: clienteSelEl }));

    left.appendChild(el('div', { class: 'font-semibold text-gray-700 mt-5 mb-2' }, 'Fornecedor de tecelagem'));
    left.appendChild(buildFornField('Tecelagem (parte de cima)', 'cima'));

    return left;
```

- [ ] **Step 5: `persistir` — exigir cliente, criar/atualizar lote, só `cima`, ordens sem fornecedor**

Trocar a função `persistir` inteira por:
```js
  async function persistir(status) {
    const numeroInt = parseInt(numero, 10), anoInt = parseInt(ano, 10);
    if (!numeroInt || !anoInt) { toast('Número e ano são obrigatórios', 'error'); return null; }
    if (!clienteSel) { toast('Escolha o cliente', 'error'); return null; }
    const validos = itensValidos();
    if (validos.length === 0) { toast('Adicione ao menos 1 item com metros', 'error'); return null; }

    if (status === 'aberta' && !fornSel.cima) {
      toast('Escolha o fornecedor de tecelagem antes de abrir a OP', 'error'); return null;
    }

    // Lote: cria no 1º salvamento (OP nova ou legada sem lote); senão atualiza o cliente.
    let loteId = op?.lote_id || null;
    if (loteId) {
      const lu = await supa.from('lotes').update({ cliente_id: clienteSel }).eq('id', loteId);
      if (lu.error) { toast('Erro ao atualizar lote', 'error'); console.error(lu.error); return null; }
    } else {
      const proxRes = await supa.from('lotes').select('numero').order('numero', { ascending: false }).limit(1);
      if (proxRes.error) { toast('Erro ao ler lotes', 'error'); console.error(proxRes.error); return null; }
      const prox = (proxRes.data && proxRes.data[0]) ? Number(proxRes.data[0].numero) + 1 : 1;
      const li = await supa.from('lotes').insert({ numero: prox, cliente_id: clienteSel }).select().single();
      if (li.error) { toast('Erro ao criar lote', 'error'); console.error(li.error); return null; }
      loteId = li.data.id;
    }

    // 1) upsert ops
    let opRow;
    if (op) {
      const r = await supa.from('ops').update({ numero: numeroInt, ano: anoInt, status, lote_id: loteId }).eq('id', op.id).select().single();
      if (r.error) { erroSalvar(r.error); return null; }
      opRow = r.data;
    } else {
      const r = await supa.from('ops').insert({ numero: numeroInt, ano: anoInt, status, lote_id: loteId }).select().single();
      if (r.error) { erroSalvar(r.error); return null; }
      opRow = r.data;
    }
    const opIdSalvo = opRow.id;

    // 2) substitui op_itens
    await supa.from('op_itens').delete().eq('op_id', opIdSalvo);
    const itensPayload = validos.map(i => ({ op_id: opIdSalvo, modelo_id: i.modeloId, metros_pedidos: Number(i.metros) }));
    const itensRes = await supa.from('op_itens').insert(itensPayload);
    if (itensRes.error) {
      if (status === 'aberta') await supa.from('ops').update({ status: 'simulada' }).eq('id', opIdSalvo);
      toast('Erro ao salvar itens', 'error'); console.error(itensRes.error); return null;
    }

    // 3) substitui op_fornecedores — só tecelagem na criação (fios são atribuídos depois)
    await supa.from('op_fornecedores').delete().eq('op_id', opIdSalvo);
    if (fornSel.cima) {
      const fornRes = await supa.from('op_fornecedores').insert([{ op_id: opIdSalvo, fornecedor_id: fornSel.cima, etapa: 'cima' }]);
      if (fornRes.error) {
        if (status === 'aberta') await supa.from('ops').update({ status: 'simulada' }).eq('id', opIdSalvo);
        toast('Erro ao salvar fornecedor de tecelagem', 'error'); console.error(fornRes.error); return null;
      }
    }

    // 4) se abrir: gera ordens_compra_fio SEM fornecedor (atribuído depois)
    if (status === 'aberta') {
      const calc = calcularFiosOP(validos, modelosById, parametrosByLargura);
      const ordens = montarOrdensCompraFio(calc).map(o => ({
        op_id: opIdSalvo,
        fornecedor_id: null,
        tipo: o.tipo, cor_id: o.cor_id, cor_poliester: o.cor_poliester,
        kg_pedido: o.kg_pedido, status: 'pendente',
      }));
      await supa.from('ordens_compra_fio').delete().eq('op_id', opIdSalvo);
      const ordRes = await supa.from('ordens_compra_fio').insert(ordens);
      if (ordRes.error) {
        await supa.from('ops').update({ status: 'simulada' }).eq('id', opIdSalvo);
        toast('Falha ao gerar ordens de compra — OP mantida como simulada', 'error');
        console.error(ordRes.error);
        return null;
      }
    }

    return opIdSalvo;
  }
```

- [ ] **Step 6: `renderRightInto` — botão Abrir exige cliente + tecelagem**

Trocar:
```js
    if (!readOnly) {
      const faltamForn = ['fio_algodao', 'fio_poliester', 'cima'].filter(e => !fornSel[e]);
```
por:
```js
    if (!readOnly) {
      const faltamForn = [];
      if (!clienteSel) faltamForn.push('cliente');
      if (!fornSel.cima) faltamForn.push('tecelagem');
```
E trocar a mensagem de ajuda:
```js
      if (faltamForn.length) children.push(el('p', { class: 'text-xs text-gray-500 mt-1' }, 'Escolha os 3 fornecedores para abrir.'));
```
por:
```js
      if (faltamForn.length) children.push(el('p', { class: 'text-xs text-gray-500 mt-1' }, 'Escolha cliente e fornecedor de tecelagem para abrir.'));
```

- [ ] **Step 7: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 31` / `fail 0`.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat(fase6): nova OP com cliente + lote automatico e fios opcionais"
```

---

## Task 5: Atribuição do fornecedor de fio no detalhe da OP

**Files:**
- Modify: `index.html` — `buildBlocoFios` (cabeçalho do bloco), e estado/recarga de fornecedores de fio em `screenNovaOP`

- [ ] **Step 1: Estado dos fornecedores de fio já atribuídos**

Em `screenNovaOP`, junto de `let cimaFornecedorId = null;` (ou das declarações de estado), adicionar:
```js
  let fioFornSel = { fio_algodao: '', fio_poliester: '' };
```
No bloco `if (opId)`, onde `op_fornecedores` é lido (`for (const f of (data.op_fornecedores || [])) fornSel[f.etapa] = f.fornecedor_id;`), logo após, adicionar:
```js
    fioFornSel.fio_algodao = (data.op_fornecedores || []).find(f => f.etapa === 'fio_algodao')?.fornecedor_id || '';
    fioFornSel.fio_poliester = (data.op_fornecedores || []).find(f => f.etapa === 'fio_poliester')?.fornecedor_id || '';
```

- [ ] **Step 2: Função que atribui o fornecedor de um tipo**

Adicionar dentro de `screenNovaOP` (perto de `reloadOrdens`):
```js
  async function atribuirFornecedorFio(etapa, tipo, fornecedorId) {
    // etapa: 'fio_algodao'|'fio_poliester'; tipo: 'algodao'|'poliester'
    if (!fornecedorId) { toast('Escolha um fornecedor', 'error'); return; }
    const u = await supa.from('ordens_compra_fio')
      .update({ fornecedor_id: fornecedorId })
      .eq('op_id', op.id).eq('tipo', tipo);
    if (u.error) { toast('Erro ao atribuir fornecedor às ordens', 'error'); console.error(u.error); return; }
    // vínculo op_fornecedores (remove o antigo do mesmo etapa e insere o novo)
    await supa.from('op_fornecedores').delete().eq('op_id', op.id).eq('etapa', etapa);
    const ins = await supa.from('op_fornecedores').insert([{ op_id: op.id, fornecedor_id: fornecedorId, etapa }]);
    if (ins.error) { toast('Erro ao vincular fornecedor', 'error'); console.error(ins.error); return; }
    fioFornSel[etapa] = fornecedorId;
    toast('Fornecedor atribuído', 'success');
    reloadOrdens();
  }
```

- [ ] **Step 3: Selects de atribuição no topo de `buildBlocoFios`**

Em `buildBlocoFios`, logo após a linha do título (`box.appendChild(el('div', { class: 'font-semibold text-gray-700 mb-3' }, 'Recebimento de fios'));`) e **apenas quando `op.status === 'aberta'`**, inserir o bloco de atribuição. Trocar:
```js
    if (op.status === 'aberta') {
      const pendentes = ordens.filter(o => o.status === 'pendente');
```
por:
```js
    if (op.status === 'aberta') {
      const temAlgodao = ordens.some(o => o.tipo === 'algodao');
      const temPoliester = ordens.some(o => o.tipo === 'poliester');
      const atribRow = el('div', { class: 'flex flex-wrap gap-4 mb-4' });
      const buildAtrib = (label, etapa, tipo, temTipo) => {
        if (!temTipo) return null;
        const sel = selectInput({ options: fornsPorTipo(tipo), value: fioFornSel[etapa], placeholder: 'Selecione...' });
        const btn = el('button', { class: 'bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg px-3 py-2',
          onclick: () => atribuirFornecedorFio(etapa, tipo, sel.value ? Number(sel.value) : '') }, 'Atribuir');
        return el('div', { class: 'flex items-end gap-2' },
          el('div', { class: 'w-48' }, formField({ label, input: sel })), btn);
      };
      const a = buildAtrib('Fornecedor de algodão', 'fio_algodao', 'algodao', temAlgodao);
      const p = buildAtrib('Fornecedor de poliéster', 'fio_poliester', 'poliester', temPoliester);
      if (a) atribRow.appendChild(a);
      if (p) atribRow.appendChild(p);
      if (a || p) box.appendChild(atribRow);

      const pendentes = ordens.filter(o => o.status === 'pendente');
```

- [ ] **Step 4: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 31` / `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(fase6): admin atribui fornecedor de fio por tipo no detalhe da OP"
```

---

## Task 6: Exibir Lote · Cliente no cabeçalho da OP

**Files:**
- Modify: `index.html` — título de `screenNovaOP` (`render`) e `renderOPLatexAdmin`

- [ ] **Step 1: Título da OP de tecelagem**

Em `screenNovaOP`, na função `render()`, trocar:
```js
    const titulo = op ? `OP Nº ${op.numero}/${op.ano}` + (readOnly ? ' (leitura)' : ' (editar)') : 'Nova OP';
```
por:
```js
    const loteTxt = op && op.lote ? ` · Lote Nº ${op.lote.numero} · ${op.lote.cliente?.nome || '—'}` : '';
    const titulo = op ? `OP Nº ${op.numero}/${op.ano}${loteTxt}` + (readOnly ? ' (leitura)' : ' (editar)') : 'Nova OP';
```

- [ ] **Step 2: Cabeçalho da OP de látex (`renderOPLatexAdmin`)**

Na query de `renderOPLatexAdmin.reload`, acrescentar o lote ao select. Trocar:
```js
      .select('id, numero, ano, status, tipo, observacao, origem_op_id, op_itens(id, modelo_id, metros_pedidos), op_fornecedores(fornecedor_id, etapa, fornecedores:fornecedor_id(nome))')
```
por:
```js
      .select('id, numero, ano, status, tipo, observacao, origem_op_id, lote:lote_id(numero, cliente:cliente_id(nome)), op_itens(id, modelo_id, metros_pedidos), op_fornecedores(fornecedor_id, etapa, fornecedores:fornecedor_id(nome))')
```
E no `info` card (`renderOPLatexAdmin.render`), após a linha dos badges, acrescentar uma linha com o lote. Trocar:
```js
    const info = el('div', { class: 'bg-white rounded-xl shadow p-5 mb-4' },
      el('div', { class: 'flex items-center gap-3 mb-2' }, badgeTipo('latex'), badgeStatus(op.status)),
      op.observacao ? el('div', { class: 'text-sm text-gray-600' }, op.observacao) : el('span', {}),
    );
```
por:
```js
    const info = el('div', { class: 'bg-white rounded-xl shadow p-5 mb-4' },
      el('div', { class: 'flex items-center gap-3 mb-2' }, badgeTipo('latex'), badgeStatus(op.status)),
      op.lote ? el('div', { class: 'text-sm text-gray-700 mb-1' }, `Lote Nº ${op.lote.numero} · ${op.lote.cliente?.nome || '—'}`) : el('span', {}),
      op.observacao ? el('div', { class: 'text-sm text-gray-600' }, op.observacao) : el('span', {}),
    );
```

- [ ] **Step 3: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 31` / `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fase6): cabecalho da OP mostra lote e cliente"
```

---

## Task 7: Lista de OPs — colunas Lote/Cliente + barra de %

**Files:**
- Modify: `index.html` — `screenListaOPs`

- [ ] **Step 1: Query traz lote/cliente e metros; carrega entrega_itens**

Em `screenListaOPs.reload`, trocar:
```js
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, tipo, criado_em, op_itens(id)')
      .order('ano', { ascending: false })
      .order('numero', { ascending: false });
    if (error) { toast('Erro ao carregar OPs', 'error'); console.error(error); return; }
    render(data || []);
```
por:
```js
    const { data, error } = await supa.from('ops')
      .select('id, numero, ano, status, tipo, criado_em, lote:lote_id(numero, cliente:cliente_id(nome)), op_itens(id, metros_pedidos, metros_ajustados)')
      .order('ano', { ascending: false })
      .order('numero', { ascending: false });
    if (error) { toast('Erro ao carregar OPs', 'error'); console.error(error); return; }
    const eiRes = await supa.from('entrega_itens').select('op_id, metros_entregues, defeito');
    if (eiRes.error) { toast('Erro ao carregar progresso', 'error'); console.error(eiRes.error); return; }
    itensPorOpId = {};
    for (const ei of (eiRes.data || [])) (itensPorOpId[ei.op_id] = itensPorOpId[ei.op_id] || []).push(ei);
    render(data || []);
```

> `itensPorOpId` é declarado no escopo da tela (Step 2) — não passado como parâmetro — para o re-render do filtro (que chama `render(rows)`) continuar funcionando.

- [ ] **Step 2: `render` ganha colunas e barra**

Trocar a assinatura/colunas de `render`. Substituir:
```js
  let filtroTipo = 'todas';
  function render(rows) {
```
por:
```js
  let filtroTipo = 'todas';
  let itensPorOpId = {};
  function barraProgresso(pct) {
    return el('div', { class: 'w-32' },
      el('div', { class: 'h-2 bg-gray-200 rounded-full overflow-hidden' },
        el('div', { class: 'h-2 bg-blue-600 rounded-full', style: `width:${pct}%` })),
      el('div', { class: 'text-xs text-gray-500 mt-0.5' }, pct + '%'),
    );
  }
  function render(rows) {
```
E nas `columns` do `dataTable`, após a coluna `lote`/`status` existentes, ajustar para incluir Lote, Cliente e Progresso. Trocar o array de `columns` por:
```js
          columns: [
            { key: 'lote_op', label: 'OP', render: (r) => `Nº ${r.numero}/${r.ano}` },
            { key: 'tipo', label: 'Tipo', render: (r) => badgeTipo(r.tipo || 'tecelagem') },
            { key: 'lote', label: 'Lote', render: (r) => r.lote ? `Nº ${r.lote.numero}` : '—' },
            { key: 'cliente', label: 'Cliente', render: (r) => r.lote?.cliente?.nome || '—' },
            { key: 'status', label: 'Status', render: (r) => badgeStatus(r.status) },
            { key: 'progresso', label: 'Entregue', render: (r) => barraProgresso(percentualEntregueOP(r.op_itens || [], itensPorOpId[r.id] || [])) },
            { key: 'criado_em', label: 'Criada em', render: (r) => new Date(r.criado_em).toLocaleDateString('pt-BR') },
          ],
```
(Removo a coluna antiga `itens`/contagem; o `lote_op` substitui a antiga `lote` que mostrava `Nº x/ano`.)

- [ ] **Step 3: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 31` / `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fase6): lista de OPs com lote, cliente e barra de % entregue"
```

---

## Task 8: PDF de compra de fios (jsPDF)

**Files:**
- Modify: `index.html` — `<head>` (script jsPDF) e botão no detalhe da OP de tecelagem

- [ ] **Step 1: Adicionar o jsPDF com SRI**

Obter o hash SRI oficial da jsPDF 2.5.1 (`jspdf.umd.min.js`) — por exemplo via `https://api.cdnjs.com/libraries/jspdf/2.5.1?fields=sri` (campo `sri` do arquivo `jspdf.umd.min.js`). No `<head>` do `index.html`, após o `<script src="js/calculo-op.js"></script>`, adicionar (substituindo `SRI_HASH_AQUI` pelo hash obtido):
```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" integrity="SRI_HASH_AQUI" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
```
> IMPORTANTE: não invente o hash. Busque o SRI real do cdnjs para esse arquivo/versão e cole.

- [ ] **Step 2: Botão + geração do PDF no detalhe da OP**

No `screenNovaOP`, dentro de `buildBlocoFios`, no início (logo após o título "Recebimento de fios"), adicionar um botão quando houver ordens:
```js
    if (ordens.length) {
      box.appendChild(el('button', {
        class: 'mb-3 text-sm text-blue-700 hover:underline',
        onclick: () => gerarPdfCompraFios(),
      }, '📄 PDF de compra de fios'));
    }
```
E adicionar a função `gerarPdfCompraFios` dentro de `screenNovaOP` (perto de `buildBlocoFios`):
```js
  function gerarPdfCompraFios() {
    const jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) { toast('Biblioteca de PDF não carregou', 'error'); return; }
    const g = agruparOrdensCompraFio(ordens);
    const doc = new jsPDFCtor();
    const loteTxt = op.lote ? `Lote Nº ${op.lote.numero} · ${op.lote.cliente?.nome || '—'}` : 'Lote —';
    let y = 15;
    doc.setFontSize(14); doc.text('Compra de fios', 14, y); y += 8;
    doc.setFontSize(10);
    doc.text(`${loteTxt}`, 14, y); y += 6;
    doc.text(`OP Nº ${op.numero}/${op.ano} · ${new Date().toLocaleDateString('pt-BR')}`, 14, y); y += 10;

    const secao = (titulo, lista, total) => {
      doc.setFontSize(12); doc.text(titulo, 14, y); y += 6;
      doc.setFontSize(10);
      if (lista.length === 0) { doc.text('—', 18, y); y += 6; }
      for (const it of lista) {
        doc.text(`${it.rotulo}`, 18, y);
        doc.text(`${it.kg.toFixed(3).replace('.', ',')} kg`, 120, y);
        y += 6;
      }
      doc.setFont(undefined, 'bold');
      doc.text(`Total ${titulo}: ${total.toFixed(3).replace('.', ',')} kg`, 18, y);
      doc.setFont(undefined, 'normal');
      y += 10;
    };
    secao('Algodão', g.algodao, g.totalAlgodao);
    secao('Poliéster', g.poliester, g.totalPoliester);

    doc.save(`compra-fios-OP-${op.numero}-${op.ano}.pdf`);
  }
```

- [ ] **Step 3: Rodar a regressão**

Run: `node --test tests/calculo-op.test.js`
Expected: `pass 31` / `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(fase6): botao de PDF de compra de fios (jsPDF)"
```

---

## Task 9: Checklist de QA da Fase 6

**Files:**
- Create: `docs/qa/fase6-checklist.md`

- [ ] **Step 1: Criar o arquivo**

```markdown
# QA — Fase 6: Cliente, Lote, fios sob demanda, % e PDF

Pré-requisitos: rodar `db/09_fase6_cliente_lote.sql` no Supabase; ter ≥1 cliente cadastrado.

## Cálculo (automatizado — `node --test tests/calculo-op.test.js`)
- [x] 1. `percentualEntregueOP` (ajustado/pedido, defeito, meta=0, cap 100).
- [x] 2. `agruparOrdensCompraFio` (separação por tipo, soma, ordenação).

## Clientes
- [ ] 3. Cadastro de Clientes (criar/editar/excluir) na barra lateral.

## Cliente + Lote na OP
- [ ] 4. Nova OP exige Cliente para salvar/abrir.
- [ ] 5. Ao salvar a 1ª OP, nasce um lote com número sequencial automático.
- [ ] 6. Cabeçalho da OP mostra "Lote Nº · Cliente".
- [ ] 7. OP de látex gerada herda o mesmo lote/cliente da OP de tecelagem.

## Fios sob demanda
- [ ] 8. Abrir OP NÃO exige fornecedores de fio (só cliente + tecelagem).
- [ ] 9. Ordens de fio nascem sem fornecedor; PDF/lista mostram as ordens.
- [ ] 10. No detalhe, admin atribui fornecedor de algodão e de poliéster.
- [ ] 11. Após atribuir, o fornecedor de fio logado vê a ordem e registra o kg.

## Lista de OPs
- [ ] 12. Colunas Lote e Cliente aparecem.
- [ ] 13. Barra de % entregue bate com entregue ÷ (ajustado/pedido).

## PDF
- [ ] 14. Botão "PDF de compra de fios" baixa o PDF.
- [ ] 15. PDF tem cabeçalho (lote/cliente/OP/data) e seções Algodão e Poliéster com subtotais.

## Resultado
(preencher após execução: X/15)
```

- [ ] **Step 2: Commit**

```bash
git add docs/qa/fase6-checklist.md
git commit -m "docs(fase6): checklist de QA"
```

---

## Pendências de deploy (manuais)

- Rodar `db/09_fase6_cliente_lote.sql` no Supabase **antes** de a `main` ir pro ar (o front lê `lote`/`cliente`, ordens sem fornecedor e a função atualizada). Pages serve da `main`.
- Confirmar o hash SRI da jsPDF antes de publicar (o `<script>` precisa do `integrity` correto, senão o PDF não carrega).
- Executar o QA manual (itens 3–15).
```
