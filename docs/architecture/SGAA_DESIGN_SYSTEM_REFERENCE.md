# SGAA — Design System Reference

Referência de estilo extraída do código real do SGAA-EJ (Flask + Jinja + CSS puro,
sem framework de UI). Use este documento como contexto para construir páginas novas
que pareçam parte do mesmo produto.

Fontes reais: `static/css/modern-style.css`, `static/css/components/list-cards.css`,
`templates/admin_alertas.html`, `templates/admin_banco_dados.html`, `main.py`.

---

## 1. Tokens (`:root` de modern-style.css)

```css
:root{
  /* Tipografia */
  --font-sans:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --font-size-base:14px;
  --font-size-small:13px;

  /* Superfícies e texto */
  --bg:#f3f4f6;
  --surface:#ffffff;
  --border:#d4d8dd;
  --border-strong:#cbd5e1;
  --text-primary:#1f2937;
  --text-secondary:#6b7280;
  --text-tertiary:#9ca3af;

  /* Marca */
  --brand:#003366;
  --accent-blue:#0369a1;
  --add-blue:var(--brand);
  --add-blue-hover:#002244;

  /* Forma */
  --radius:4px;                          /* raio padrão do produto — baixo */
  --shadow-sm:0 1px 3px rgba(0,0,0,.10);
  --shadow-md:0 8px 20px rgba(0,0,0,.05);

  /* Botões */
  --btn-h:32px;
  --btn-px:10px;
  --btn-icon-size:15px;
  --btn-primary:var(--brand);
  --btn-primary-strong:#002244;
  --btn-primary-light:#335f8a;

  /* Campos */
  --field-bg:#ffffff;
  --field-border:#cbd5e1;
  --field-hover-bg:#f8fafc;
  --field-hover-border:var(--accent-blue);
  --field-focus-border:var(--accent-blue);
  --field-focus-ring:rgba(3,105,161,.22);
  --field-chip-hover-bg:#f1f5f9;
  --focus-ring-color:rgba(37,99,235,.35);

  /* Listas */
  --cell-pad-x:12px;
  --col-gap:2px;
}
```

Leitura do sistema: fundo cinza claro, cartões brancos, **raio baixo (4px)**, sombras
discretas, azul-marinho institucional como primária e um azul mais aceso como acento
de interação. Não é um visual arredondado nem colorido — é sóbrio e denso.

---

## 2. Status pills — o componente semântico principal

Pílula compacta (18px de altura) com bolinha à esquerda. Pinta por custom properties,
com fallback cinza embutido.

```css
.badge{ display:inline-block; border-radius:999px; padding:2px 8px; font-size:12px; font-weight:500; }

.badge.status-pill{
  display:inline-flex; align-items:center; justify-content:center; gap:5px;
  height:18px; min-width:18px; padding:0 6px;
  border:1px solid var(--status-pill-border, #d9dde2);
  border-radius:999px;
  background:var(--status-pill-bg, #f4f5f6);
  color:var(--status-pill-text, #48505a);
  font-size:11px; font-weight:600; line-height:1;
  white-space:nowrap; vertical-align:middle; box-sizing:border-box;
}
.badge.status-pill::before{
  content:""; width:5px; height:5px; flex:0 0 5px;
  border-radius:50%; background:var(--status-pill-dot, #7b8794);
}

.badge.status-pill.status-positive{ --status-pill-bg:#e9f5e7; --status-pill-border:#b9d7b5; --status-pill-text:#1f5a3c; --status-pill-dot:#3e835a; }
.badge.status-pill.status-neutral { --status-pill-bg:#eef1f4; --status-pill-border:#c4ced8; --status-pill-text:#3a4755; --status-pill-dot:#667585; }
.badge.status-pill.status-caution { --status-pill-bg:#faeed5; --status-pill-border:#e3c17b; --status-pill-text:#7b4b12; --status-pill-dot:#c5801f; }
.badge.status-pill.status-negative{ --status-pill-bg:#f9e3e6; --status-pill-border:#e3b0b8; --status-pill-text:#8d2431; --status-pill-dot:#cb4859; }
.badge.status-pill.status-info    { --status-pill-bg:#e4eff9; --status-pill-border:#b5d0e7; --status-pill-text:#1d5a83; --status-pill-dot:#3e7fb0; }
```

### Mapeamento semântico em uso

| Estado de domínio | Modificador |
|---|---|
| Deferida, Ativo, Ativa, Conectado, Resolvido, Concluído | `status-positive` |
| Pendente, Em análise, Reconectar | `status-caution` |
| Indeferida, Encerrada, Cancelado | `status-negative` |
| Devolvida | `status-info` |
| Inativo, Desconectado, Trancado, desconhecido | `status-neutral` |

Uso no template:

```html
<span class="badge status-badge status-pill status-positive">Deferida</span>
```

---

## 3. Badge tonal (camada legada)

Sem borda, só fundo + texto. Coexiste com o `status-pill` nas mesmas tags.

```css
.badge.success{ color:#27500A; background-color:#EAF3DE; }
.badge.warning{ color:#633806; background-color:#FAEEDA; }
.badge.danger { color:#791F1F; background-color:#FCEBEB; }
```

Em páginas novas, **prefira só `status-pill`**. Não replique a combinação dupla.

---

## 4. Badges quadrados

Mesma linguagem, cantos retos.

```css
/* Marcador de grupo/código em tabela */
.badge-grupo{
  display:inline-flex; align-items:center; justify-content:center;
  min-width:34px; padding:2px 6px; border-radius:6px;
  border:1px solid #c7d2fe; background:#eef2ff; color:#3730a3;
  font-size:12px; font-weight:600;
}
.badge-grupo.table-cell-ellipsis-target{ border-radius:2px; min-width:18px; }

/* Pílula de filtro em popover */
.filter-pill{
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  min-height:22px; padding:0 10px;
  border:1px solid var(--border-strong); border-radius:4px;
  background:var(--surface); color:var(--text-primary);
  font:inherit; font-size:13px; cursor:pointer;
  transition:border-color .15s ease, background .15s ease, color .15s ease;
}
.filter-pill:hover{ background:#f8fafc; border-color:#94a3b8; }
.filter-pill.is-active,
.filter-pill.has-selection{
  border-color:var(--btn-primary);
  background:rgba(3,105,161,.08);
  color:var(--btn-primary-strong);
}

/* Amostra de cor 18x18 */
.color-swatch{
  width:18px; height:18px; display:inline-block;
  border-radius:4px; border:1px solid var(--border-strong);
  box-shadow:var(--shadow-sm);
}
```

---

## 5. Paleta de alertas configuráveis

Sete presets. O admin escolhe em Alertas (sidebar). Cada preset é `{label, bg, border}`.

| Label | bg | border |
|---|---|---|
| Azul | `#e3eefd` | `#7e95b2` |
| Amarelo | `#fef4c0` | `#c9a227` |
| Verde | `#dcfaeb` | `#4ea86a` |
| Laranja | `#ffecd4` | `#c07a3a` |
| Vermelho | `#fee2e2` | `#bb6464` |
| Roxo | `#ede9fe` | `#8872c4` |
| Ciano | `#cffafe` | `#3aaab8` |

O Amarelo é reaproveitado como alerta automático do sistema
(`AUTO_ALERT_YELLOW_BG = #fef4c0`, `AUTO_ALERT_YELLOW_BORDER = #c9a227`).

### Cor livre e borda derivada

O usuário pode digitar hex livre ou usar o color picker. Fora dos presets, a borda é
**calculada** a partir do fundo:

```
luminância = (0.299·R + 0.587·G + 0.114·B) / 255
se luminância > 0.72 → mistura 18% de preto   (escurece)
senão                → mistura 26% de branco  (clareia)
```

Reproduza esse algoritmo se a página nova também permitir cor livre — assim a borda
fica coerente com o resto do produto.

### Renderização do alerta

```css
.alerta{
  min-height:calc(var(--btn-h) * 0.8);
  display:flex; align-items:center; gap:8px;
  padding:0 12px;
  border:1px solid;              /* cor vem do dado */
  border-radius:var(--radius);
  box-shadow:var(--shadow-sm);
}
```

Fundo e borda vêm do registro (`bg_color` / `border_color`), nunca hardcoded.

---

## 6. Convenções a seguir

1. **Raio 4px** (`--radius`) para superfícies e controles; `999px` só para pílulas de
   status; `2px–6px` para marcadores em tabela.
2. **Altura de controle 32px** (`--btn-h`); pílulas de status têm 18px.
3. Ícones: biblioteca **Lucide**, via `<i class="lucide" data-lucide="nome">`.
4. Texto secundário sempre por token (`--text-secondary` / `--text-tertiary`), nunca
   hex solto.
5. Estado ativo/selecionado usa `rgba(3,105,161,.08)` de fundo com borda
   `--btn-primary` — esse é o azul único de seleção do produto.
6. Popovers: `border-radius:var(--radius)`, `box-shadow:0 12px 28px rgba(0,0,0,.10)`,
   fundo `--surface`, borda `--border-strong`.

## 7. Inconsistências conhecidas — não replicar

- `.badge` está declarado duas vezes com valores idênticos, em `modern-style.css` e em
  `components/list-cards.css`.
- A tela Banco de dados tem um sistema paralelo (`.db-badge`, definido inline no
  template) com verde `#ecfdf3/#047857` e azul `#eff6ff/--accent-blue` que **não** são
  os do `status-pill`, para o mesmo significado semântico. As duas famílias convivem na
  mesma página.
- O mapeamento status → cor está duplicado em três lugares (dois templates Jinja e um
  bloco JS), comparando strings com e sem acento.

Em página nova: um único mapeamento, no backend ou num helper Jinja compartilhado.
