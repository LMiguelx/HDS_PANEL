# Sistema de diseño — HDSAPP Panel

Base visual del panel a partir de la pantalla **Nuevo pedido** (`src/app/features/orders/counter-order-form.ts`).
Se aplica módulo por módulo: los tokens de color/tipografía ya son globales (cambian todo el panel
de una vez); el radio de 10/14px y los componentes nuevos se van adoptando pantalla por pantalla.

## 1. Layout y scroll

El shell (`src/app/core/layout/shell/`) ocupa exactamente la ventana y nunca hace scroll él mismo:

- `.shell` — `height: 100vh; overflow: hidden;` (antes `min-height`, que dejaba crecer la página).
- `.topbar` — 64px fijo (`flex: none`), fondo oscuro fijo (`--topbar-bg`), no cambia con el tema.
- `.body` — grid `240px 1fr` (lateral / contenido), `flex: 1; min-height: 0`.
- `.sidebar` — `overflow-y: auto` propio, para que un menú largo no empuje el layout.
- `.content` — **el único que scrollea** (`overflow-y: auto; height: 100%`). Cualquier columna
  "resumen" que deba quedar fija al hacer scroll usa `position: sticky; top: var(--sp-6);`
  relativo a este contenedor (ya no hace falta descontar el alto de la barra superior).

## 2. Tokens (`src/styles/_tokens.scss`)

Mismos nombres de variable que ya usaba el panel — solo se actualizó el **valor del lado claro**
de cada `light-dark(claro, oscuro)`; el oscuro se mantiene igual que antes. Así el modo oscuro no
se tocó y cualquier componente que ya usaba estas variables se actualiza solo.

| Variable                                              | Claro                                           | Para qué                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `--bg`                                                | `#f4f3f1`                                       | Lienzo de página                                                                              |
| `--surface`                                           | `#ffffff`                                       | Fondo de tarjeta (`ui-card`), por encima del lienzo                                           |
| `--surface-sunk`                                      | `#f7f7f6`                                       | Inputs, filas alternas                                                                        |
| `--ink`                                               | `#16181d`                                       | Texto principal                                                                               |
| `--ink-muted`                                         | `#5f6672`                                       | Texto secundario / ayuda                                                                      |
| `--divider`                                           | `#e3e5e9`                                       | Borde de 2px (secciones, tarjetas)                                                            |
| `--hairline`                                          | `#ececee`                                       | Borde de 1px (filas)                                                                          |
| `--accent`                                            | `#c93217`                                       | Acento de marca (fijo, no cambia con el tema)                                                 |
| `--accent-hover` / `--accent-press`                   | `#b32912` / `#8f2310`                           | Estados del acento                                                                            |
| `--accent-wash`                                       | `#fff6f3`                                       | Acento muy suave (fondos de alerta/ficha)                                                     |
| `--accent-soft`                                       | `#fce9e4`                                       | Acento suave más marcado (OptionCard/Badge seleccionados)                                     |
| `--success`                                           | `#1e7a4a`                                       | Éxito del sistema nuevo (Stepper, Badge) — no reemplaza los `--st-*` de negocio ya existentes |
| `--topbar-bg` / `--topbar-ink` / `--topbar-ink-muted` | `#14161a` / `#ffffff` / `rgba(255,255,255,.64)` | Barra superior, fija en ambos temas                                                           |
| `--radius-control`                                    | `10px`                                          | Inputs y botones                                                                              |
| `--radius-card`                                       | `14px`                                          | Tarjetas (`ui-card`)                                                                          |
| `--font-sans`                                         | `'DM Sans', system-ui, sans-serif`              | Tipografía del panel (pesos 400/500/600/700/800 cargados)                                     |

`--radius-sm/md/lg/pill` (legado, 8/12/16/999) se dejan igual: solo los usan dos pantallas
antiguas sin rediseñar. `--radius-pill` sí se reutiliza para el interruptor (`ui-toggle`).

## 3. Componentes reutilizables (`src/app/shared/ui/`)

Todos aceptan los tokens de arriba — no hace falta tocarlos pantalla por pantalla, solo usarlos.

| Componente                    | Selector                                                      | Qué resuelve                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Card**                      | `<ui-card title="…" subtitle="…">`                            | Tarjeta con cabecera opcional "título + texto de ayuda". `title`/`subtitle` son nuevos; si se omiten, el contenido proyectado ocupa toda la tarjeta como antes |
| **Input con ícono**           | `<ui-field icon="search">` / `<ui-typeahead icon="search">`   | Buscador con lupa a la izquierda. `icon` ya existía en `ui-field`; se agregó el mismo soporte a `ui-typeahead`                                                 |
| **Select**                    | `<ui-field type="select">`                                    | Ya existente, sin cambios                                                                                                                                      |
| **Switch**                    | `<ui-toggle>`                                                 | Ya existente; ahora es una píldora real (antes era un rectángulo)                                                                                              |
| **OptionCard**                | `<ui-option-card [selected]="…" (pick)="…">`                  | Tarjeta tipo radio para elecciones excluyentes ("Atribuir venta a")                                                                                            |
| **Stepper**                   | `<ui-stepper [steps]="[{label, state}]">`                     | Progreso de un formulario en pasos (`complete`/`current`/`upcoming`). Es solo indicador: no navega ni oculta contenido                                         |
| **Tabs**                      | `<ui-tabs [items]="…" [(value)]="…">`                         | Pestañas en memoria (sin ruta); el contenido de cada una lo decide el llamador con un `@switch`                                                                |
| **EmptyState**                | `<ui-empty>`                                                  | Ya existente, sin cambios                                                                                                                                      |
| **ItemMenú**                  | `<ui-menu>`                                                   | Ya existente (menú contextual), sin cambios                                                                                                                    |
| **Badge**                     | `<ui-badge tone="neutral\|accent\|success\|warning">`         | Etiqueta pequeña redondeada (conteos, estados cortos)                                                                                                          |
| **Botón primario/secundario** | `<button uiButton variant="primary\|secondary\|ghost\|icon">` | Ya existente; ahora con `border-radius: var(--radius-control)`                                                                                                 |

## 4. Pantalla de referencia: Nuevo pedido

`counter-order-form.ts` es el ejemplo de uso: encabezado + Stepper (solo en alta, no en edición) +
dos columnas (`1fr` contenido / `360px` resumen fijo) + tarjetas separadas Cliente / Condiciones de
venta / Carrito / Catálogo-Sugerido-Promociones. Ningún cambio de lógica ni de llamadas al backend:
mismos signals, mismos métodos, mismas validaciones — solo se reordenó el marcado y se reemplazaron
los bloques repetidos (botones de atribución, pestañas, cabecera de tarjeta) por los componentes de
arriba.

## 5. Cómo extenderlo a otro módulo

1. Envolver cada bloque visual en `<ui-card title="…" subtitle="…">` en vez de un `<div>` con borde
   a mano.
2. Cambiar los selects/inputs a `ui-field`/`ui-typeahead` si la pantalla todavía usa HTML nativo.
3. Si hay un conjunto de botones excluyentes tipo radio, usar `ui-option-card`.
4. Si hay pestañas en memoria (sin ruta), usar `ui-tabs` en vez de botones sueltos.
5. No hace falta tocar colores a mano: todo lo que ya usa `var(--accent)`, `var(--ink)`, etc. ya
   tiene la paleta nueva.
