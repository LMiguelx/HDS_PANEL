# DESIGN.md — Sistema de diseño del panel HDSAPP

> Guía visual y de experiencia del panel `hds_panel` (paquete `hdsapp-frontend`).
> Pensada para agentes (Claude Code) y para quien programe o revise pantallas.
> Complementa a `ARCHITECTURE_PANEL.md` (estructura del código). Si se contradicen en algo visual, manda este documento; en estructura, manda el de arquitectura.
> Idioma: español. Última revisión: 2026-10-12.

Marcas que se usan en el documento:

- **(pendiente)**: algo que todavía no existe en el proyecto.
- **(a verificar)**: deducido sin haber leído el archivo; si el código dice otra cosa, manda el código y se corrige este documento.

---

## Índice

0. [Reglas de oro](#0-reglas-de-oro)
1. [Principios de un panel de supervisión](#1-principios-de-un-panel-de-supervisión)
2. [Plataformas: web, PWA y escritorio (.exe)](#2-plataformas-web-pwa-y-escritorio-exe)
3. [Layout y scroll](#3-layout-y-scroll)
4. [Tokens](#4-tokens)
5. [Espaciado y densidad](#5-espaciado-y-densidad)
6. [Tipografía](#6-tipografía)
7. [Color, estados de negocio y temas](#7-color-estados-de-negocio-y-temas)
8. [Cómo mostrar datos](#8-cómo-mostrar-datos)
9. [Estados de una pantalla](#9-estados-de-una-pantalla)
10. [Patrones de página](#10-patrones-de-página)
11. [Formularios](#11-formularios)
12. [Tablas](#12-tablas)
13. [Acciones y feedback](#13-acciones-y-feedback)
14. [Componentes](#14-componentes)
15. [Responsive](#15-responsive)
16. [Pantalla de referencia: Nuevo pedido / Editar pedido](#16-pantalla-de-referencia-nuevo-pedido--editar-pedido)
17. [Cómo llevar un módulo al sistema](#17-cómo-llevar-un-módulo-al-sistema)
18. [Checklist visual](#18-checklist-visual)
19. [Defectos visuales conocidos](#19-defectos-visuales-conocidos)

---

## 0. Reglas de oro

1. **Profesional e igual en todo el panel.** Lo mismo se ve y se comporta igual en cualquier módulo: un estado, un monto, una tabla, un formulario, un aviso. Cada módulo adapta el contenido a lo suyo, nunca inventa su propio estilo.
2. **Nada de huecos.** Ningún bloque vacío, ninguna columna sin contenido, ningún alto fijo que deje espacio muerto (sección 5).
3. **Nunca ids internos en pantalla.** Se muestra el nombre o el código de negocio (sección 8).
4. **Toda zona que carga datos resuelve sus cuatro estados:** cargando, error, vacío y con datos (sección 9).
5. **Solo tokens.** Ningún color, tamaño de letra, espaciado ni radio fijo en el CSS.
6. **Solo componentes de `shared/ui`.** Si falta uno, se usa el patrón de la sección 14.2; no se crea una variante local.
7. **Se diseña para escritorio Windows primero** (la app `.exe` y el navegador en laptop), sin romper tablet ni móvil (secciones 2 y 15).
8. **Una pantalla no mezcla el sistema viejo con el nuevo.** Si se toca, se lleva entera al sistema (sección 17).
9. **Tema claro y oscuro valen lo mismo.** Toda pantalla se diseña y se revisa en los dos; si algo se ve mal en uno, la pantalla no está terminada (sección 7.4).

---

## 1. Principios de un panel de supervisión

El panel lo usan supervisión y administración para **decidir y actuar** sobre pedidos, reparto, stock, promociones y clientes. Las decisiones de diseño salen de ahí:

| Principio                                 | Qué significa en la práctica                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Profesional y sobrio**                  | Pocas tipografías, un solo acento (rojo institucional), colores de estado con significado, sin decoración que no informe                               |
| **Consistente**                           | Mismo patrón para lo mismo en todos los módulos: cabecera de página, tarjeta, tabla, estado, aviso, formulario                                         |
| **Coherente con el módulo**               | Cada módulo muestra lo suyo con los mismos bloques: pedidos priorizan montos y estado; reparto, avance y comprobantes; stock, cantidades y diferencias |
| **Densidad útil**                         | Mucha información por pantalla, pero ordenada. Ni huecos ni amontonamiento                                                                             |
| **Accionable**                            | Lo que requiere atención se ve primero (avisos, pendientes, descuadres) y la acción que lo resuelve está al lado                                       |
| **Datos de negocio, no de base de datos** | Nombres, códigos, montos y estados legibles. El usuario no conoce ids ni códigos de catálogo internos                                                  |
| **Honesto**                               | Si algo falla o no hay datos, se dice con claridad y se ofrece qué hacer                                                                               |

---

## 2. Plataformas: web, PWA y escritorio (.exe)

El mismo build se distribuye de tres formas:

| Plataforma                    | Cómo                                                                | Uso esperado                             |
| ----------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| **Escritorio Windows (.exe)** | Electron (`npm run electron`, `npm run dist`, con `--base-href ./`) | Principal: oficina, supervisión, laptops |
| **Web**                       | Navegador                                                           | Acceso desde cualquier equipo            |
| **PWA**                       | Service worker solo en `production`                                 | Instalada en equipos o tablets           |

**Reglas que salen de esto:**

- **Pantallas objetivo:** laptop Windows de **1366×768** con escalado de 100 % o 125 %, y monitor de **1920×1080**. Toda pantalla se revisa en las dos. El ancho mínimo útil del contenido es **1024 px** (pendiente: fijar `minWidth` de la ventana en `electron/main.js`, a verificar).
- **Escalado de Windows:** a 125 % o 150 %, 1366 px equivalen a menos espacio real. No se diseña al límite: lo que entra justo a 100 % se rompe a 125 %.
- **Todo local, nada por CDN.** El `.exe` debe verse igual sin internet hacia terceros: fuentes con `@fontsource` (ya está), iconos empaquetados en el build y ningún CSS ni JS externo. Una fuente o un icono que se cargue de internet se ve roto en el ejecutable.
- **Sin depender del navegador.**
  - La navegación atrás/adelante está en la barra superior; ninguna pantalla depende de los botones del navegador.
  - El enrutado es por hash (`withHashLocation()`); los enlaces internos se arman con el router, nunca con rutas absolutas escritas a mano.
  - Los enlaces externos se abren en el navegador del sistema, no dentro de la app (a verificar en `electron/main.js`).
  - Las descargas (CSV, Excel, PDF) se generan como archivo con nombre útil (`pedidos-2026-10-12.csv`), no abriendo una pestaña.
- **Sin servidor no hay página de error del navegador.** Si el API no responde, la pantalla muestra su estado de error con **Reintentar** (sección 9). En el `.exe` no existe "recargar la página" como salida natural.
- **Teclado:** `Enter` envía el formulario o confirma el diálogo, `Esc` cierra el diálogo o el menú, `Tab` recorre en orden visual y el foco siempre se ve (`--border-focus`).
- **Barras de desplazamiento:** en Windows ocupan espacio real. Solo `.content` scrollea (sección 3); listas internas con scroll propio solo cuando su tamaño está acotado (por ejemplo, sugeridos con `max-height`).
- **Nada solo con hover.** Toda información o acción que aparece al pasar el mouse debe poder alcanzarse también con clic o foco (tablets con la PWA).
- **Texto seleccionable** en códigos, números de comprobante y montos: el usuario los copia a otros sistemas.

---

## 3. Layout y scroll

El shell (`core/layout/shell/`) ocupa exactamente la ventana y nunca hace scroll él mismo:

- `.shell`: `height: 100vh; overflow: hidden;`.
- `.topbar`: 64 px fijo (`flex: none`), fondo `--topbar-bg`, igual en los dos temas.
- `.body`: grid `240px 1fr` (lateral / contenido), `flex: 1; min-height: 0`.
- `.sidebar`: `overflow-y: auto` propio, para que un menú largo no empuje el layout.
- `.content`: **el único que scrollea** (`overflow-y: auto; height: 100%`).

Una columna que deba quedar fija al hacer scroll (resumen, acciones) usa `position: sticky; top: var(--sp-6);`, relativo a `.content`.

---

## 4. Tokens

Fuente de verdad: `src/styles/_tokens.scss`. Si este documento y el archivo difieren, **manda el archivo** y se corrige aquí. Todos los colores usan `light-dark(claro, oscuro)`; el tema lo fuerza `ThemeService` con `html.theme-light` / `html.theme-dark`. Las tablas muestran el valor **claro** como referencia; cada token tiene su valor oscuro en el archivo. Reglas de los dos temas en la sección 7.4.

### 4.1 Superficies y tinta

| Token            | Claro                | Uso                                    |
| ---------------- | -------------------- | -------------------------------------- |
| `--bg`           | `#f4f3f1`            | Lienzo de la página                    |
| `--surface`      | `#ffffff`            | Fondo de tarjeta, diálogo y tabla      |
| `--surface-sunk` | `#f7f7f6`            | Inputs, filas alternas, zonas hundidas |
| `--faint`        | `rgba(22,24,29,.05)` | Relleno sutil (esqueletos, notas)      |
| `--ink`          | `#16181d`            | Texto principal                        |
| `--ink-muted`    | `#5f6672`            | Texto secundario, ayuda, etiquetas     |
| `--divider`      | `#cbced4`            | Borde de 2 px (secciones)              |
| `--hairline`     | `#dde0e4`            | Borde de 1 px (filas, separadores)     |

### 4.2 Acento y marca

| Token                                                                | Uso                                       |
| -------------------------------------------------------------------- | ----------------------------------------- |
| `--accent` (`#c93217`, fijo)                                         | Acción principal, selección, foco         |
| `--accent-hover` / `--accent-press`                                  | Estados del acento                        |
| `--accent-ink`                                                       | Acento en texto de párrafo (enlaces)      |
| `--accent-wash`                                                      | Fondo muy suave (ficha seleccionada)      |
| `--accent-soft`                                                      | Selección más marcada (OptionCard, chips) |
| `--on-accent`                                                        | Texto sobre el acento                     |
| `--success`                                                          | Éxito del sistema nuevo (Badge, Stepper)  |
| `--topbar-bg` / `--topbar-ink` / `--topbar-ink-muted`                | Barra superior, fija en los dos temas     |
| `--brand-start` / `--brand-mid` / `--brand-end` / `--brand-gradient` | **Solo** login y splash                   |

### 4.3 Tipografía

`--font-sans`: DM Sans. Escala completa en la sección 6.

### 4.4 Espaciado (escala de 4 px)

| Token     | Valor |
| --------- | ----- |
| `--sp-1`  | 4 px  |
| `--sp-2`  | 8 px  |
| `--sp-3`  | 12 px |
| `--sp-4`  | 16 px |
| `--sp-5`  | 20 px |
| `--sp-6`  | 24 px |
| `--sp-8`  | 32 px |
| `--sp-10` | 40 px |

`--touch-min` = 44 px: alto mínimo de botones e inputs.

### 4.5 Radios

| Token               | Valor      | Uso                                        |
| ------------------- | ---------- | ------------------------------------------ |
| `--radius-control`  | 10 px      | Inputs, botones, avisos                    |
| `--radius-card`     | 14 px      | Tarjetas, diálogos                         |
| `--radius-pill`     | 999 px     | Interruptor, badges                        |
| `--radius-sm/md/lg` | 8/12/16 px | **Legado.** No se usan en pantallas nuevas |

Pantallas antiguas todavía tienen radio 0. **Una pantalla no mezcla radio 0 con 10/14**: se lleva entera al sistema nuevo (sección 17).

### 4.6 Anchos de contenido

| Token         | Valor  | Uso                            |
| ------------- | ------ | ------------------------------ |
| `--card-w-sm` | 640 px | Diálogos y formularios simples |
| `--card-w-md` | 820 px | Formularios con grillas        |
| `--card-w-lg` | 920 px | Formularios anchos             |

### 4.7 Bordes, elevación y movimiento

| Token                                                                 | Uso                            |
| --------------------------------------------------------------------- | ------------------------------ |
| `--border-hair`                                                       | Borde de 1 px con `--hairline` |
| `--border-rule`                                                       | Borde de 2 px con `--divider`  |
| `--border-focus`                                                      | Foco visible (2 px de acento)  |
| `--shadow-card`                                                       | Sombra suave de tarjeta        |
| `--elev-menu` / `--elev-dialog`                                       | Menús y diálogos               |
| `--dur-fast` (120 ms) / `--dur-base` (200 ms) / `--dur-slow` (320 ms) | Duración de transiciones       |
| `--ease-standard` / `--ease-exit`                                     | Curvas                         |

Las animaciones son cortas y funcionales (hover, foco, entrada de una fila). Nada se anima solo por adorno.

---

## 5. Espaciado y densidad

El objetivo es una pantalla **llena de información útil y sin huecos**.

### 5.1 Medidas fijas

| Dónde                                                     | Token                                      |
| --------------------------------------------------------- | ------------------------------------------ |
| Padding de página                                         | `--sp-8` (escritorio), `--sp-4` (≤ 767 px) |
| Cabecera de página → contenido                            | `--sp-5`                                   |
| Entre tarjetas o secciones de una misma columna           | `--sp-5`                                   |
| Entre columnas de un grid de página                       | `--sp-6`                                   |
| Entre campos apilados dentro de una tarjeta               | `--sp-4`                                   |
| Entre elementos en línea (botones, badges, icono y texto) | `--sp-2`                                   |
| Entre un título de sección y su contenido                 | `--sp-3`                                   |
| Padding interno de una fila de lista o tabla              | `--sp-2` vertical, `--sp-3` horizontal     |

Hoy el detalle de pedido separa tarjetas con 20 px y el formulario con 24 px. La regla queda **`--sp-5` entre tarjetas y `--sp-6` entre columnas**.

### 5.2 Prohibido

- **Bloques vacíos con alto fijo.** Una sección sin datos se reduce a un `ui-empty` compacto con su mensaje y su acción, nunca a un rectángulo gris. Ejemplo real: la "Escala de precios" del producto sin precios (sección 19, V1).
- **Columnas vacías.** Si la columna lateral de un detalle no tiene nada que mostrar, el grid pasa a una sola columna.
- **Contenido estirado de lado a lado** en formularios. Un formulario usa `--card-w-sm/md/lg` como ancho máximo; listados, tablas y reportes sí usan todo el ancho.
- **Espacios con `margin` sueltos** para "acomodar". El espacio lo dan el `gap` del contenedor y los tokens.
- **Alturas fijas** en contenedores con datos. La única excepción es el esqueleto, que copia la forma del contenido que reemplaza.
- **Saltos de layout al cargar.** El esqueleto ocupa aproximadamente lo mismo que el contenido final.

### 5.3 Grupos de datos clave-valor

Para fichas (producto, cliente, pedido) se usa un grid que se adapta solo:

```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
gap: var(--sp-4) var(--sp-5);
```

Etiqueta arriba (estilo `label`, sección 6) y valor abajo. Un valor vacío se muestra como `—`, nunca se oculta la etiqueta dejando un hueco irregular.

---

## 6. Tipografía

Una sola familia (DM Sans) y una escala fija. **No se escriben tamaños sueltos** (`font-size: 15px`): se usa el token del nivel.

| Nivel       | Tokens                                                    | Uso                                                                      |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Display** | `--fs-display` 30 / `--lh-display` / `--fw-display` 800   | Título de la página (`h1`): "Pedido #267225", nombre del producto        |
| **H1**      | `--fs-h1` 24 / `--fw-h1` 800                              | Título dentro de un diálogo grande o de una sección mayor                |
| **H2**      | `--fs-h2` 18 / `--fw-h2` 800                              | Título de sección o de tarjeta: "Líneas", "Escala de precios", "Resumen" |
| **Body**    | `--fs-body` 15 / `--lh-body`                              | Texto corrido, valores de ficha                                          |
| **Dense**   | `--fs-dense` 14 / `--lh-dense`                            | Tablas, listas, formularios densos                                       |
| **Meta**    | `--fs-meta` 12 / `--lh-meta`                              | Dato secundario: fecha bajo un nombre, código, ayuda de un campo         |
| **Label**   | `--fs-label` 11 + `--ls-label`, mayúsculas, `--ink-muted` | Etiqueta de dato, cabecera de tabla, _eyebrow_ sobre el título           |
| **Metric**  | `--fs-metric` 22 / `--fw-metric` 800                      | KPI, saldo, total destacado                                              |

Reglas:

- **Un solo título display por página.**
- **Los títulos de tarjeta salen de `ui-card title="…"`**, no de un `h2` escrito a mano con su propio tamaño. Hoy hay títulos de sección de 15 px y de 16 px (sección 19, V8).
- **Cifras con `font-variant-numeric: var(--tnum)`** en tablas, totales y cantidades, para que los números alineen.
- **No se fuerzan mayúsculas sobre datos** (`text-transform` en nombres). Los nombres de producto ya vienen en mayúsculas desde el ERP; se muestran como llegan. Las mayúsculas son solo para etiquetas (`label`).
- **Pesos:** 400 texto, 600 énfasis, 700 títulos chicos y botones, 800 display, H1, H2 y métricas.

---

## 7. Color, estados de negocio y temas

### 7.1 Reglas

- **El color nunca es el único portador de información:** todo estado lleva su nombre escrito.
- **Un estado tiene un solo color en todo el panel.** "Entregado" es el mismo verde en pedidos, reparto y reportes.
- **Prohibido el color fijo, también como respaldo.** `var(--st-vencida, #d13b3b)` está mal: si el token no existe, se crea en `_tokens.scss` (sección 19, V6).
- **El acento no es un estado.** El rojo institucional marca acción y selección; los errores usan `--status-danger`.

### 7.2 Catálogo de tokens de estado

| Dominio                            | Estado                     | Token                                               |
| ---------------------------------- | -------------------------- | --------------------------------------------------- |
| Pedido                             | Abierto                    | `--st-open`                                         |
|                                    | Enviado a facturación      | `--st-sent-to-billing`                              |
|                                    | Entregado en mostrador     | `--st-counter-delivered`                            |
|                                    | Anulado                    | `--st-cancelled`                                    |
| Planilla                           | En ruta                    | `--st-in-route`                                     |
|                                    | Liquidada                  | `--st-settled`                                      |
| Comprobante de planilla            | Pendiente                  | `--st-pending`                                      |
|                                    | Entregado                  | `--st-delivered`                                    |
|                                    | Parcial                    | `--st-partial`                                      |
|                                    | Rechazado                  | `--st-rejected`                                     |
| Conciliación de factura            | Sin conciliar              | `--st-unmatched`                                    |
|                                    | Conciliada (auto)          | `--st-matched-auto`                                 |
|                                    | Conciliada (manual)        | `--st-matched-manual`                               |
|                                    | Diferencia                 | `--st-mismatch`                                     |
| Visita                             | Atendido                   | `--st-attended`                                     |
|                                    | Cerrado                    | `--st-closed`                                       |
|                                    | No compró                  | `--st-no-purchase`                                  |
| Promoción                          | Vigente                    | `--st-vigente`                                      |
|                                    | Programada                 | `--st-programada`                                   |
|                                    | Vencida                    | `--st-vencida`                                      |
|                                    | Apagada                    | `--st-apagada`                                      |
|                                    | Pendiente                  | `--st-pendiente`                                    |
|                                    | Sin stock                  | `--st-sin-stock`                                    |
| Genérico (salud, semáforo, avisos) | Bien / Atención / Problema | `--status-ok` / `--status-warn` / `--status-danger` |

`--st-pending` (comprobante) y `--st-pendiente` (promoción) son tokens distintos: se usa el de su dominio.

### 7.3 Uso por tipo de aviso

| Aviso                                  | Token             |
| -------------------------------------- | ----------------- |
| Error, rechazo, bloqueo                | `--status-danger` |
| Atención, pendiente, algo por resolver | `--status-warn`   |
| Correcto, completado                   | `--status-ok`     |
| Información neutra                     | `--ink-muted`     |

Hoy varias pantallas usan `--st-no-purchase` (estado de visita) para avisos generales. En código nuevo o al tocar la pantalla, el aviso de atención usa `--status-warn`.

### 7.4 Tema claro y oscuro

El panel tiene dos temas y **los dos son de primera clase**: el usuario cambia con el interruptor **Modo oscuro** dentro del menú del usuario de la barra superior (no un botón suelto) y cualquier pantalla debe verse igual de bien, ordenada y legible en ambos.

**Cómo funciona.** Cada color de `_tokens.scss` se define con `light-dark(claro, oscuro)` y `color-scheme: light dark`. `ThemeService` fuerza el tema con `html.theme-light` / `html.theme-dark` (ver `_material.scss`). Por eso **un componente que solo usa tokens cambia de tema solo**, sin una línea de código extra. Cambiar de tema no recarga la página.

**Reglas:**

1. **Ningún color fijo en ninguna parte.** Un `#fff`, `white`, `black`, `#333` o `rgba(0,0,0,.1)` escrito en un componente se ve bien en un tema y mal en el otro. Esto incluye fondos, textos, bordes, sombras, íconos y respaldos de `var()`.
2. **Fondos por capas, no por color.** Lienzo `--bg` → tarjeta `--surface` → input o zona hundida `--surface-sunk` → relleno sutil `--faint`. Nunca "blanco" como fondo de tarjeta: es `--surface`.
3. **Texto según dónde está:**
   - Sobre `--bg` o `--surface`: `--ink` y `--ink-muted`.
   - Sobre el acento: `--on-accent`.
   - **Texto de color de acento** (enlaces, valores destacados): `--accent-ink`, no `--accent`. El rojo de `--accent` es fijo y como texto chico no alcanza contraste sobre el fondo oscuro.
4. **Transparencias con `color-mix` sobre tokens**, nunca `rgba` fijo: `color-mix(in srgb, var(--status-warn) 10%, transparent)`. Así el lavado de un aviso se adapta a cada tema.
5. **Separar superficies con borde, no solo con sombra.** En oscuro las sombras casi no se ven: toda tarjeta, tabla o diálogo lleva su borde `--hairline` o `--divider`, además de `--shadow-card` o `--elev-*` si corresponde.
6. **Estados de negocio:** cada `--st-*` ya trae su variante oscura (más clara, para leerse sobre fondo oscuro). Se usan como **texto o borde de color**, o como **fondo lavado** con `color-mix`. **Nunca texto blanco sobre un `--st-*` sólido**: en oscuro el color es pastel y el blanco no se lee.
7. **Contraste mínimo en los dos temas:** 4.5:1 para texto normal, 3:1 para texto grande, íconos y bordes de controles. Se revisa en especial `--ink-muted`, las etiquetas `label`, el texto sobre lavados y los placeholders.
8. **Foco y selección visibles en los dos:** `--border-focus` y `--accent-soft` ya están pensados para ambos; no se reemplazan por colores propios.
9. **Esqueletos y vacíos:** `--faint` en los dos temas; un esqueleto no debe "desaparecer" en oscuro ni verse como un bloque negro.
10. **Controles nativos** (desplegable de un `select`, selector de fecha, barras de desplazamiento): toman el tema por `color-scheme`. No se les fuerza un color fijo, o en el `.exe` aparecen claros dentro del tema oscuro.
11. **Componentes de terceros** (`@angular/material`, Leaflet, gráficos): sus colores salen de los tokens. Material sigue `_material.scss`; los popups, controles y leyendas de los mapas y las series de los gráficos se estilan con tokens (a verificar en cada pantalla que los use). Las capas del mapa pueden quedar claras, pero todo lo que el panel dibuja encima sigue el tema.
12. **Imágenes y logos:** con fondo transparente y legibles en los dos temas; si no se puede, se colocan sobre una superficie que lo garantice.
13. **Excepciones intencionales, las únicas:** la barra superior (`--topbar-*`) y las pantallas de marca (`--brand-*`) son iguales en los dos temas.
14. **Impresión y exportaciones** (PDF, impresión de comprobantes o reportes) salen siempre en claro, sin depender del tema activo.

**Cómo revisarlo:** cada pantalla se mira en claro y en oscuro antes de darla por terminada, con atención a avisos, estados, tablas, diálogos, esqueletos, inputs y desplegables nativos. Un defecto que aparece en un solo tema casi siempre es un color fijo: se busca en el CSS del componente.

---

## 8. Cómo mostrar datos

### 8.1 Identificadores

- **Nunca se muestra un id interno** (`customerId`, `productId`, `paymentConditionId`, `allocationId`, etc.). Los ids solo viven en la URL y en el código.
- Se muestra el **nombre**, y el **código de negocio** cuando ayuda a identificar: código de cliente, de producto, de vendedor, serie y número de comprobante, número de pedido.
- **Si falta el nombre de un catálogo, el respaldo es `—`**, nunca `#12` ni `Producto #1881`. Que falte un nombre es un error a corregir (cargar el catálogo o pedirlo al backend), no algo que se disimule con el id (sección 19, V5).
- **Prohibido pedirle un id al usuario en un formulario.** Todo dato de catálogo se elige con `select` o `typeahead` que muestra nombres (sección 11). Ejemplo real: "Tipo de cliente (id)" en Agregar precio (sección 19, V2).
- **Los números de pedido sí se muestran** (`Pedido #267225`): son un dato de negocio que el usuario usa y busca.

### 8.2 Formatos

| Dato                 | Formato                                        | Cómo                                                                    |
| -------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| Monto                | `S/ 1,234.50`                                  | `formatSoles`. Alineado a la derecha en tablas, con `--tnum`            |
| Descuento            | `− S/ 12.00` o columna "Descuento" en positivo | Coherente dentro de la pantalla                                         |
| Fecha                | `12/10/2026`                                   | `dateText` (hoy en `assignments/assignment-format`, excepción tolerada) |
| Fecha y hora         | `12/10/2026 14:54`                             | `dateTimeText`                                                          |
| Hora                 | `14:54`                                        | `timeText`                                                              |
| Cantidad de venta    | Entero: `12`                                   | Siempre unidades enteras; no se vende fraccionado                       |
| Cantidad con empaque | `3 cj + 4 und`                                 | Cuando existe `unitsPerPackage`                                         |
| Peso                 | `1.5 kg`                                       |                                                                         |
| Porcentaje           | `12.5 %`                                       |                                                                         |
| Sí / No              | `Sí` / `No`, o un `ui-badge` si es un estado   | Nunca `true` / `false`                                                  |
| Estado de catálogo   | Nombre + color (`ui-status`)                   | Nunca el código crudo (`OPEN`, `SENT_TO_BILLING`)                       |
| Vacío o nulo         | `—`                                            | Nunca `null`, `undefined`, `0` inventado ni celda en blanco             |

- **Fechas siempre en hora local de Lima.** Nunca `toISOString()` para "hoy" (después de las 19:00 da el día siguiente).
- **Texto largo:** una línea con puntos suspensivos y el texto completo en `title`, salvo en el detalle, donde se muestra completo.
- **Persona y quién hizo qué:** nombre legible ("TURPO QUILLA DIOGENES"); el código del usuario solo si ayuda a distinguir.

---

## 9. Estados de una pantalla

Toda zona que carga datos (la página o una sección) resuelve **cuatro estados**, más dos de contexto:

| Estado           | Cómo se ve                                                                                                         | Componente                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **Cargando**     | Esqueleto con la forma del contenido: filas para una tabla, bloques para una ficha. Sin spinner de página completa | Patrón esqueleto (14.2)                                   |
| **Error**        | Título claro, una línea de explicación y **Reintentar**                                                            | `ui-empty variant="error"` con `actionLabel` y `(action)` |
| **Vacío**        | Mensaje que explica por qué no hay nada y, si existe, la acción que lo resuelve                                    | `ui-empty`                                                |
| **Con datos**    | El contenido                                                                                                       | —                                                         |
| **Solo lectura** | Sin acciones de edición y con el motivo visible ("Enviado a facturación: ya no se puede editar")                   | `ui-empty` o aviso en línea                               |
| **Sin permiso**  | La acción no se muestra (`*hasPermission`); si es la página entera, la protege el guard                            | —                                                         |

Reglas:

- **Un rectángulo gris sin texto no es un estado.** Si se ve uno, es un esqueleto que nunca terminó o un vacío sin resolver (sección 19, V1).
- **Una sección secundaria que falla no rompe la página.** Si fallan las promociones de un pedido, se muestra el pedido con esa sección en error o vacía. Solo el dato principal puede dejar la página en error. Así se corrigió Editar pedido.
- **El vacío dice qué hacer:** "Este producto no tiene precios. **Agregar precio**", no solo "Sin datos".
- **El error usa el mensaje del API cuando es útil para el usuario** (`error.detail` / `error.message`), y uno genérico cuando no ("No pudimos cargar el pedido").
- **Las acciones en curso** se marcan en su botón (`[loading]`), no bloqueando toda la pantalla.

---

## 10. Patrones de página

Todas las páginas comparten la **cabecera**:

```
[eyebrow: módulo o código]                         [acciones]
Título display
línea meta: datos clave separados por " · "
```

- Las acciones van arriba a la derecha, alineadas con el título.
- El _eyebrow_ da contexto ("VENTAS · PEDIDO DE MOSTRADOR", el código del producto).
- La línea meta resume quién, cuándo y de qué se trata, en `--ink-muted`.

### 10.1 Listado

Ejemplos: Pedidos, Clientes, Promociones, Planillas.

```
Cabecera (título + acción principal: "Nuevo …")
Filtros en una fila (grid auto-fill), con "Limpiar" si hay filtros activos
Resumen opcional (conteos o totales del filtro)
Tabla (ui-table) con sus estados
Paginador
```

- En ≤ 767 px la tabla se reemplaza por tarjetas.
- La fila lleva al detalle; las acciones rápidas van al final de la fila.

### 10.2 Detalle

Ejemplos: Pedido, Producto, Cliente, Planilla.

```
Cabecera con acciones válidas para el estado actual
Avisos de lo que requiere atención (pendientes, bloqueos)
Grid 1fr / 360px:
  Izquierda: tarjetas con el contenido principal (líneas, historial)
  Derecha (sticky): resumen y totales
```

- Si la columna derecha no tiene contenido, el grid pasa a una columna.
- Una ficha corta (producto, cliente) usa el grid clave-valor de la sección 5.3 bajo la cabecera.

### 10.3 Formulario de página

Ejemplo de referencia: Nuevo pedido (sección 16).

```
Cabecera (eyebrow + título + Cancelar)
Stepper solo si el flujo tiene pasos reales (alta, no edición)
Grid 1fr / 360px:
  Izquierda: tarjetas por tema (Cliente, Condiciones, Productos)
  Derecha (sticky): resumen y la acción principal
```

### 10.4 Reporte y dashboard

```
Cabecera + selector de período
Fila de KPIs (--fs-metric) con su comparación o contexto
Gráficos o tablas de detalle
```

- Cada KPI dice de qué período es.
- Una tarjeta de KPI sin datos muestra `—` y no se oculta (no deja huecos en la fila).

### 10.5 Diálogo

```
Título (qué se hace) + subtítulo (sobre qué: nombre del producto, número de pedido)
Campos
Pie: [Cancelar] [Acción principal]   ← a la derecha
```

- Ancho máximo `--card-w-sm`; los formularios con grilla usan `--card-w-md`.
- Fondo con velo sobre la página, radio `--radius-card` y `--elev-dialog`.
- `Esc` cierra; `Enter` en el último campo confirma.
- Un diálogo con datos que se pueden perder pide confirmación al cerrarse (pendiente).

---

## 11. Formularios

Un formulario bien hecho se entiende sin explicación y no deja mandar algo inválido.

### 11.1 Campos

- **Siempre `ui-field` / `ui-typeahead`**, nunca un `<input>` o `<select>` nativo suelto. Excepción: inputs numéricos dentro de una tabla, con la clase de cantidad del sistema.
- **La etiqueta siempre visible arriba del campo.** El _placeholder_ es un ejemplo, nunca la etiqueta.
- **Obligatorio vs. opcional:** los opcionales llevan "(opcional)"; lo demás se asume obligatorio.
- **Ayuda** debajo del campo, en `meta`, solo si aporta ("Se usa en el comprobante").
- **Error** debajo del campo, en `--status-danger`, con el texto del API mapeado a ese campo (`error.errors.<campo>`) o uno claro del panel.
- **Datos de catálogo** (condición de pago, tipo de cliente, canal, almacén, marca, familia, vendedor, motivo) se eligen con `select` (catálogos chicos) o `typeahead` (grandes). **Nunca un campo de texto para escribir un id.**

### 11.2 Tipos de dato

| Dato                                            | Campo                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Cantidad de venta o dotación                    | Numérico entero, `step="1"`, mínimo según el caso; redondea y avisa si se escribe un decimal |
| Monto o precio                                  | Numérico con 2 decimales y prefijo `S/`                                                      |
| Fecha                                           | Selector de fecha local                                                                      |
| Sí / No                                         | `ui-toggle`                                                                                  |
| Elección excluyente con pocas opciones visibles | `ui-option-card`                                                                             |
| Texto largo                                     | `ui-field type="textarea"` con límite de caracteres visible si el backend lo tiene           |

### 11.3 Distribución

- Campos agrupados por tema en tarjetas (`ui-card title subtitle`).
- Campos cortos en dos columnas en escritorio y una en ≤ 767 px; los largos ocupan el ancho completo.
- El ancho de un campo es proporcional a su dato: un código no ocupa lo mismo que una dirección.

### 11.4 Envío

- **Una acción principal** al final, alineada a la derecha (o en el resumen fijo del formulario de página).
- **Deshabilitada mientras el formulario no sea válido**, con el motivo visible si no es obvio.
- `[loading]` mientras guarda; no se puede enviar dos veces.
- **Si el backend rechaza, se conserva todo lo escrito** y se muestra el error junto al campo o en un aviso.
- Validación al salir del campo y al enviar, no a cada tecla.
- Valores por defecto razonables (condición de pago habitual, fecha de hoy, cantidad 1).

---

## 12. Tablas

Siempre `ui-table` (o la clase `ui-table-grid` donde ya se usa) con los estados de la sección 9.

| Columna                           | Alineación        | Formato                         |
| --------------------------------- | ----------------- | ------------------------------- |
| Texto (nombre, cliente, producto) | Izquierda         | Una línea con elipsis y `title` |
| Código o número de documento      | Izquierda         | `meta` o `dense`, sin cortar    |
| Monto                             | **Derecha**       | `formatSoles`, `--tnum`         |
| Cantidad                          | **Derecha**       | Entero, `--tnum`                |
| Fecha                             | Izquierda         | `dateText`, sin cortar          |
| Estado                            | Izquierda         | `ui-status`                     |
| Acciones                          | Derecha, al final | Botones `icon` o `ui-menu`      |

- **Cabecera:** estilo `label` (11 px, mayúsculas, `--ink-muted`).
- **Cuerpo:** `--fs-dense`.
- **Totales** en una fila final destacada, con la misma alineación de su columna.
- **Fila clicable** si lleva a un detalle, con cursor y hover sutil (`--faint`).
- **Listas largas** paginadas; la cabecera queda fija si la tabla tiene scroll propio.
- **Móvil (≤ 767 px):** tarjetas con el dato principal arriba, el estado a la derecha y montos y fechas debajo.
- Una tabla nunca muestra columnas de ids.

---

## 13. Acciones y feedback

### 13.1 Botones

| Variante    | Uso                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------- |
| `primary`   | **Una por pantalla o diálogo**: la acción principal ("Guardar cambios", "Registrar pedido") |
| `secondary` | Acciones de la cabecera y alternativas                                                      |
| `ghost`     | Acciones terciarias, enlaces de acción ("Ver bonificaciones pendientes")                    |
| `icon`      | Acciones de fila (quitar, editar) con `title` obligatorio                                   |

- **Solo se muestran las acciones válidas para el estado actual.** Si el producto está activo se ve **Desactivar**; si está inactivo, **Activar**. Nunca las dos (sección 19, V3).
- **Máximo tres acciones visibles** en la cabecera; el resto va en un `ui-menu` ("Más").
- **Destructivas** (anular, desactivar, eliminar): diálogo de confirmación con `destructive: true` que explica qué pasa y si se puede deshacer.
- **Botón deshabilitado con su motivo** en `title` o en un texto cercano ("Resuelve lo pendiente antes de enviarlo").

### 13.2 Avisos

| Tipo               | Cuándo                                                                                                                         | Cómo                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Toast**          | Resultado de una acción que ya pasó: "Pedido actualizado", o el error que devolvió el API al guardar                           | `ToastService` (`success`, `error`, `info`)                                |
| **Aviso en línea** | Una condición del dato que sigue vigente y requiere atención: "Falta elegir un premio", "2 bonificaciones pendientes de stock" | Patrón aviso (14.2), arriba del contenido afectado y con su acción al lado |
| **Ayuda**          | Explicar un dato o una regla sin ocupar espacio                                                                                | `ui-info-tip`                                                              |
| **Confirmación**   | Antes de algo irreversible o con efectos                                                                                       | `UiDialogService.confirm()`                                                |

- El texto dice **qué pasó y qué hacer**, en español claro y sin jerga del backend ("No pudimos guardar el precio: ya existe uno para esa condición y tipo de cliente").
- Después de guardar, la pantalla muestra el dato actualizado (recarga la sección o navega al detalle). Nunca queda el dato viejo.

---

## 14. Componentes

### 14.1 Disponibles en `shared/ui/`

| Componente  | Selector                                                                                | Uso                                                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Badge       | `<ui-badge tone="neutral\|accent\|success\|warning">`                                   | Conteos y estados cortos                                                                                                                                                                                           |
| Button      | `<button uiButton variant="primary\|secondary\|ghost\|icon" size="sm">` con `[loading]` | Toda acción                                                                                                                                                                                                        |
| Card        | `<ui-card title="…" subtitle="…">`                                                      | Todo bloque visual. Sin `title`, el contenido ocupa toda la tarjeta. No espacia su contenido solo: con varios campos apilados se le agrega una clase con `display: flex; flex-direction: column; gap: var(--sp-4)` |
| Checkbox    | `<ui-checkbox label [(checked)] [disabled] [hint]>`                                     | Casilla múltiple (sección 11.2 del doc 38)                                                                                                                                                                         |
| Coming soon | `<app-coming-soon [title]>` (o `data.title` de la ruta)                                 | Módulo aún no disponible                                                                                                                                                                                           |
| Dialog      | `UiDialogService` (`open`, `confirm`), `UI_DIALOG_DATA`, `UiDialogRef`                  | Mecanismo de diálogos                                                                                                                                                                                              |
| Empty       | `<ui-empty variant="error" title body actionLabel (action)>`                            | Vacío y error                                                                                                                                                                                                      |
| Field       | `<ui-field label type="text\|select\|textarea\|…" [(value)] [options] icon>`            | Inputs y selects                                                                                                                                                                                                   |
| Info tip    | `<span [uiInfoTip]="'texto de ayuda'">`                                                 | Ayuda contextual, ícono ⓘ con `title`/`aria-label`                                                                                                                                                                 |
| Menu        | `<ui-menu>`                                                                             | Menú contextual y acciones de más                                                                                                                                                                                  |
| Modal       | `<ui-modal title subtitle (close)>` con slot `modalFooter`                              | Marco visual del diálogo                                                                                                                                                                                           |
| Option card | `<ui-option-card [selected] (pick)>`                                                    | Elección excluyente tipo radio                                                                                                                                                                                     |
| Status      | `<ui-status [label] [status]>`                                                          | Estado de catálogo con su color: normaliza `status` (o, si falta, `label`) a un slug y pinta `var(--st-<slug>)`; con un texto que no exista en su diccionario, se fuerza el color pasando `status` explícito       |
| Stepper     | `<ui-stepper [steps]="[{label, state}]">`                                               | Progreso de un flujo; solo indicador                                                                                                                                                                               |
| Table       | `<ui-table>` con `(retry)`                                                              | Tablas con estados                                                                                                                                                                                                 |
| Tabs        | `<ui-tabs [items] [(value)]>`                                                           | Pestañas en memoria                                                                                                                                                                                                |
| Toggle      | `<ui-toggle label [(checked)]>`                                                         | Sí / No                                                                                                                                                                                                            |
| Typeahead   | `<ui-typeahead label icon [search] [(selected)] (picked)>`                              | Búsqueda en catálogos grandes                                                                                                                                                                                      |

### 14.2 Patrones que todavía no son componente (pendiente)

Hoy se escriben a mano en cada página (`od-alert`, `cof-alert`, `od-skeleton`, `cof-skeleton`, `od-summary-row`…). **Mientras no exista el componente, se respeta el patrón** y no se inventa una variante nueva. Cuando se creen, van en `shared/ui/` y se reemplazan al tocar cada pantalla.

| Componente previsto                              | Patrón actual a respetar                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-alert` (tono `warn`, `danger`, `info`, `ok`) | Borde izquierdo de 3 px con el color del tono, fondo `color-mix(in srgb, <tono> 10%, transparent)`, `--radius-control`, padding `--sp-3 --sp-4`, texto `dense`; acciones en una fila debajo |
| `ui-skeleton`                                    | Bloques `--faint` con la forma del contenido; para tablas, 5 filas                                                                                                                          |
| `ui-key-value`                                   | Grid de la sección 5.3; etiqueta `label` arriba, valor `body` abajo, `—` si no hay valor                                                                                                    |
| `ui-summary-row`                                 | Fila con la etiqueta a la izquierda (`--ink-muted`) y el valor a la derecha (`--tnum`); el total, en negrita con borde superior `--hairline`                                                |
| `ui-page-header`                                 | Cabecera de la sección 10                                                                                                                                                                   |

### 14.3 Iconos

Una sola familia en todo el código: clase `material-icons` (Material Icons de Google), por nombre (`<span class="material-icons">home</span>`). No hay mezcla de familias (V11 estaba mal planteado: el código ya usa una sola). El defecto real es otro: la fuente se carga desde Google Fonts (`index.html`, `<link href="https://fonts.googleapis.com/icon?family=Material+Icons">`), igual que Roboto/Inter/Archivo — **viola la regla "todo local, nada por CDN" de la sección 2** y se ve roto en el `.exe` sin internet. Autohospedar estas fuentes (como ya se hizo con DM Sans vía `@fontsource`) queda pendiente, fuera del alcance del doc 38.

---

## 15. Responsive

| Corte    | Qué cambia                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------- |
| > 900 px | Layout completo: grids de dos columnas (`1fr / 360px`)                                              |
| ≤ 900 px | Los grids de página pasan a una columna; el resumen deja de ser `sticky`                            |
| ≤ 767 px | Padding de página `--sp-4`; las tablas pasan a tarjetas; las elecciones en dos columnas pasan a una |

- **Son los únicos cortes.** No se agregan otros por pantalla.
- El objetivo principal es escritorio (sección 2); tablet y móvil deben funcionar y verse ordenados, sin funciones nuevas.
- Toda zona táctil mide al menos `--touch-min`.

---

## 16. Pantalla de referencia: Nuevo pedido / Editar pedido

`features/orders/counter-order-form.ts` es el ejemplo de uso del sistema.

**Nuevo pedido (alta):**

- Cabecera con _eyebrow_, título y **Cancelar**.
- Stepper (solo indicador).
- Grid `1fr / 360px`: tarjetas Cliente, Condiciones de venta, Carrito y Catálogo-Sugerido-Promociones (con `ui-tabs`), y a la derecha el resumen fijo con la simulación y **Registrar pedido**.
- `ui-option-card` para "Atribuir venta a".
- Exige jornada abierta y sede.

**Editar pedido (mismo componente, con `orderId`):**

- Sin stepper.
- Tarjeta **Pedido** en solo lectura: cliente, vendedor, fecha, canal y origen.
- Carrito con cantidades enteras; las promociones, en solo lectura ("Se recalcula al guardar").
- Bloque de dotación del vendedor del pedido.
- Resumen rotulado **Estimado**; **Guardar cambios** deshabilitado si no queda ninguna línea de venta.
- Estados de carga, error con **Reintentar** y "ya no se puede editar".
- No exige jornada abierta.

---

## 17. Cómo llevar un módulo al sistema

Se aplica pantalla por pantalla, cuando se toca. Una pantalla tocada **queda entera en el sistema nuevo**, sin mezclar.

1. Cabecera de página con el patrón de la sección 10.
2. Cada bloque visual en `<ui-card title subtitle>` en vez de un `<div>` con borde a mano.
3. Inputs y selects con `ui-field` / `ui-typeahead`; ningún campo pide un id.
4. Botones excluyentes tipo radio con `ui-option-card`; pestañas en memoria con `ui-tabs`.
5. Radios `--radius-control` y `--radius-card`, nunca 0 ni legado.
6. Tamaños de letra con los tokens de la sección 6; espacios con los de la sección 5.
7. Los cuatro estados de la sección 9 en cada zona que carga datos.
8. Datos formateados según la sección 8; nada de ids, códigos crudos ni `null`.
9. Acciones según el estado, una sola primaria, destructivas con confirmación.
10. Revisión en 1366×768 al 125 % y en 1920×1080, en tema claro y en tema oscuro (sección 7.4).
11. Pasar el checklist de la sección 18.

Los colores ya son globales: todo lo que usa `var(--accent)`, `var(--ink)`, etc. toma la paleta solo.

---

## 18. Checklist visual

Antes de dar una pantalla por terminada:

**Datos**

- [ ] ¿Ningún id interno a la vista, ni como respaldo (`#12`)?
- [ ] ¿Estados con nombre y color de su token, nunca el código crudo?
- [ ] ¿Montos con `formatSoles`, fechas locales, cantidades enteras y `—` en los vacíos?

**Espacio y forma**

- [ ] ¿Sin bloques vacíos, columnas vacías ni alturas fijas con espacio muerto?
- [ ] ¿Espaciados, tamaños de letra y radios solo con tokens?
- [ ] ¿Sin mezcla de radio 0 con el sistema nuevo?
- [ ] ¿Un solo título display y títulos de tarjeta con `ui-card title`?

**Estados**

- [ ] ¿Cargando, error con Reintentar, vacío con su acción y con datos, en cada zona que carga?
- [ ] ¿Una sección secundaria que falla no rompe la página?
- [ ] ¿Solo lectura y sin permiso resueltos?

**Acciones**

- [ ] ¿Solo las acciones válidas para el estado actual?
- [ ] ¿Una sola primaria; destructivas con confirmación; deshabilitadas con su motivo?
- [ ] ¿Toast para resultados y aviso en línea para condiciones vigentes?

**Formularios**

- [ ] ¿Catálogos con select o typeahead por nombre?
- [ ] ¿Etiqueta visible, error junto al campo, envío deshabilitado si es inválido y datos conservados si el backend rechaza?

**Tema claro y oscuro**

- [ ] ¿Revisada completa en los dos temas, incluidos avisos, estados, tablas, diálogos, esqueletos e inputs?
- [ ] ¿Ningún color fijo (tampoco `white`, `black`, `rgba` fijo ni respaldo en `var()`)?
- [ ] ¿Transparencias con `color-mix` sobre tokens y superficies separadas con borde, no solo sombra?
- [ ] ¿Texto de acento con `--accent-ink` y ningún texto blanco sobre un `--st-*` sólido?
- [ ] ¿Contraste suficiente en los dos temas y desplegables nativos sin colores forzados?

**Plataformas**

- [ ] ¿Revisada en 1366×768 al 125 % y en 1920×1080?
- [ ] ¿Teclado: `Enter`, `Esc`, `Tab` y foco visible?
- [ ] ¿Sin recursos por CDN; funciona igual en el `.exe`?
- [ ] ¿Se ve ordenada en ≤ 900 px y en ≤ 767 px?

---

## 19. Defectos visuales conocidos

Registro de lo que hoy no cumple este documento. Se corrige al tocar la pantalla o cuando se ordene; al corregirse, se borra la fila.

| ID  | Defecto                                                                                                      | Dónde            | Regla                                          |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------------- |
| V7  | Avisos y esqueletos repetidos a mano en cada página (`od-alert`, `cof-alert`, `od-skeleton`, `cof-skeleton`) | `orders` y otros | 14.2                                           |
| V8  | Títulos de sección con tamaños distintos (15 px en el detalle, 16 px en el carrito), escritos a mano         | `orders`         | 6                                              |
| V9  | Avisos generales con `--st-no-purchase` (estado de visita)                                                   | `orders`         | 7.3: `--status-warn`                           |
| V10 | Separación entre tarjetas de 20 px en un sitio y 24 px en otro                                               | `orders`         | 5.1                                            |
| V11 | El ícono (`material-icons`) se carga desde Google Fonts por CDN, no empaquetado                              | `index.html`     | 2 y 14.3: se ve roto en el `.exe` sin internet |
