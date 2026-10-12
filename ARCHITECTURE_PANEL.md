# ARCHITECTURE_PANEL.md

> Guía de arquitectura del panel `hds_panel` (paquete `hdsapp-frontend`).
> Pensada para agentes (Claude Code) y para quien programe en el proyecto.
> Complementa a `DESIGN.md` (lo visual). Idioma: español.
> Última revisión: 2026-10-12.

Marcas que se usan en el documento:

- **(inferido)**: deducido por nombres de archivo o por imports, sin haber visto el código.
- **(pendiente)**: algo que todavía no existe o no está activado en el proyecto.

---

## 0. Reglas de oro (leer primero)

1. **Lo nuevo nace con la estructura nueva** (sección 5). Lo existente no se migra salvo orden explícita.
2. **Bug o cambio pequeño en un archivo existente:** edita ese archivo, con su estilo actual. No lo muevas, no lo renombres, no lo partas.
3. **Archivo nuevo dentro de un feature existente:** va en la subcarpeta de su capa (`pages/`, `data-access/`, `domain/`, `dialogs/`, `ui/`), aunque el resto del feature siga plano.
4. **Dependencias:** `core` ← `shared` ← `features`. Un feature **no importa los archivos internos de otro feature** (sección 4).
5. **Las páginas no llaman a `HttpClient`.** Usan un `*.api.ts` o un `*.store.ts`.
6. **Permisos:** en código nuevo, nunca strings sueltos. Se usa `PERMISSIONS` (sección 8.2).
7. **Navegación:** la única fuente de verdad del menú es `core/layout/nav.config.ts`. No se repiten rutas ni permisos a mano en otros sitios.
8. **Carga de datos:** una sola petición vigente por pantalla (`switchMap`) y filtros reunidos en un único `computed` (sección 8.1).
9. **Utilidades transversales** (fechas, extracción de errores del API) viven en `shared/utils/`. No se copian dentro de una página.
10. **Imports relativos.** Los alias (`@core`, `@shared`, `@features`) **todavía no están configurados**. No los uses hasta que se activen (sección 10).
11. **Código en inglés; rutas URL y textos de pantalla en español.** Estilos con tokens CSS, nunca colores fijos.
12. **Todo `*.format.ts`, store, guard, interceptor y utilidad lleva su `.spec.ts`** (sección 9).
13. **Si no estás seguro de algo, no lo inventes:** lee el archivo o pregunta. Este documento marca lo que no se pudo verificar.

---

## 1. Stack actual

| Área | Tecnología | Versión (`package.json`) |
|---|---|---|
| Framework | Angular (core, common, router, forms, platform-browser, compiler) | `^22.0.0` |
| Herramientas Angular | `@angular/cli`, `@angular/build`, `@angular/compiler-cli` | `^22.0.7` / `^22.0.0` |
| UI base | `@angular/cdk`, `@angular/material` | `^22.0.5` |
| PWA | `@angular/service-worker` | `^22.0.0` |
| Lenguaje | TypeScript | `~6.0.2` |
| Reactividad | RxJS | `~7.8.0` |
| Pruebas | Vitest + jsdom (`ng test` con `@angular/build:unit-test`) | `^4.0.8` / `^28.0.0` |
| Formato | Prettier (`.prettierrc`, `.editorconfig`) | `^3.8.1` |
| Escritorio | Electron, electron-builder, electron-updater | `^44.5.1` / `^26.15.3` / `^6.8.9` |
| Tiempo real | `@stomp/stompjs` (WebSocket) | `^7.3.0` |
| Mapas | `leaflet`, `leaflet.markercluster` (+ `@types`) | `^1.9.4` / `^1.5.3` |
| Fechas | `date-fns`, `date-fns-tz` | `^4.4.0` / `^3.2.0` |
| Fuentes | `@fontsource/inter`, `archivo`, `dm-sans` | `^5.3.0` |
| Gestor de paquetes | npm | `11.16.0` |

**Configuración relevante (visto en `angular.json`, `app.config.ts` y los `tsconfig`):**

- Aplicación única `hdsapp-frontend`, builder `@angular/build:application`, prefijo de selectores `app`, estilos `scss`.
- **Zoneless** (`provideZonelessChangeDetection()`): la vista solo se actualiza con **signals**. Un valor que cambie fuera de un signal no repinta la pantalla.
- Router: `withComponentInputBinding()` (los parámetros de ruta y query llegan como `input()`) y `withHashLocation()` (necesario para Electron y la PWA).
- HTTP: `provideHttpClient(withInterceptors([authInterceptor, errorInterceptor]))`.
- Se distribuye como **PWA** (service worker solo en `production`) y como **app de escritorio Windows** con Electron (`npm run electron`, `npm run dist`, ambos con `--base-href ./`).
- Presupuestos de producción: `initial` 500 kB aviso / 1 MB error; **`anyComponentStyle` 4 kB aviso / 8 kB error**. No se suben los límites para silenciar avisos.
- **No hay ESLint** instalado (pendiente).
- **`strict` y `strictTemplates` no están activados** en ningún `tsconfig` (pendiente, sección 10).
- Valores de plantilla sin completar en `package.json`: `author: "Tu nombre"` y `build.appId: "com.tuempresa.panel"`.

---

## 2. Arquitectura actual (hasta hoy)

### 2.1 Capas

```
src/app/
├── core/       infraestructura global, una sola vez en la app
│   ├── auth/            auth.ts (AuthService), jwt.util, auth-guard, permission-guard, auth-interceptor
│   ├── http/            error-interceptor
│   ├── layout/          nav.config.ts, nav-history.ts, shell/ (ShellComponent)
│   ├── notifications/   ws.ts (WebSocket) + notification-store.ts
│   ├── theme/           theme.service.ts
│   └── ui/              toast.ts (ToastService)
├── features/   un dominio de negocio por carpeta, cada uno con sus rutas lazy
└── shared/     components/, directives/ (has-permission), models/, pipes/ (money), utils/, ui/ (design system)
```

### 2.2 Features existentes (19)

`assignments`, `auth`, `billing`, `catalog`, `company`, `customer-requests`, `customers`, `dashboard`, `delivery`, `fleet`, `inventory`, `maintenance`, `notifications`, `orders`, `promos`, `sales` (solo `allocation.ts`), `sales-reports`, `segments`, `users`.

### 2.3 Convención actual dentro de un feature (carpeta plana)

| Archivo | Qué es |
|---|---|
| `<dominio>.routes.ts` | Rutas del feature, con `loadComponent` perezoso |
| `*-admin.ts`, `<sustantivo>.ts` (ej. `order-admin.ts`, `customer.ts`, `promo.ts`) | **Servicio HTTP** (`OrderAdminService`, `CustomerService`). El sufijo `-admin` NO indica una pantalla |
| `*-store.ts`, `*-alerts.ts`, `pending-count.ts` | Estado compartido con signals (`RouteStore`, `AssignmentAlertStore`, `PendingCountStore`) |
| `*-format.ts` | Funciones puras de etiquetas y formato (`order-format.ts`) |
| `<vista>.ts` | Página (clase `*Page`): template, estilos y lógica en un solo archivo |
| `ui/*-dialog.ts` | Diálogos (clase `*Dialog`) |
| `ui/module-tabs.ts` | Pestañas del módulo, repetidas en casi cada feature |

### 2.4 Seguridad y navegación

- `app.routes.ts`: `login` y `splash` fuera del shell; el resto cuelga de `ShellComponent` con `authGuard`. Cada feature se carga con `loadChildren` y **el permiso se exige en la ruta padre** con `permissionGuard('perm.a', 'perm.b')` (basta tener uno). Las rutas hijas no repiten el guard.
- `AuthService` (`core/auth/auth.ts`): sesión en signals (`currentUser`, `isAuthenticated`, `permissions`); `has(p)`, `hasAny(...ps)` (vacío = sí), `hasRole(r)`. Los permisos salen de los claims del JWT.
- UI: directiva `*hasPermission` (acepta un permiso o un arreglo).
- Menú: `NAV: NavItem[]` en `nav.config.ts` (`label`, `icon`, `route`, `anyOf`, `group`, `comingSoon`). El shell filtra con `auth.hasAny(...item.anyOf)` y agrupa por `group`. Los iconos son nombres de Material Symbols (string).
- Interceptores: `authInterceptor` añade el JWT; `errorInterceptor` maneja errores HTTP globales (inferido: avisa con toast).
- Tiempo real: `core/notifications/ws.ts` → `notification-store.ts` (inferido: alimenta la campana del shell).

---

## 3. Estado actual y deuda conocida

Esto es lo que hoy **no** cumple las reglas de este documento. No se corrige por sorpresa: se corrige cuando se toca ese archivo o cuando se ordene (sección 7).

| ID | Problema | Dónde | Prioridad |
|---|---|---|---|
| D1 | `strict` y `strictTemplates` apagados | `tsconfig.json`, `tsconfig.app.json`, `tsconfig.spec.json` | Alta |
| D2 | **Carrera de peticiones:** `load()` no cancela la anterior; una respuesta vieja puede pisar a la nueva | `order-list.ts`, `dashboard.ts`, `create-assignment-dialog.ts` (`loadSituation`) | **Urgente** |
| D3 | **Doble carga con query params:** el efecto de filtros carga con valores por defecto y luego el efecto de semillas cambia los filtros y carga otra vez | `order-list.ts` | **Urgente** |
| D4 | **Día y mes se pisan:** si hay mes, el día se ignora sin avisar | `order-list.ts` (`dateRange()`) | **Urgente** |
| D5 | **`core` depende de `features`:** el shell importa `PendingCountStore` (promos), `AssignmentAlertStore` (assignments), `RouteStore` (orders) y `timeText` (assignments) | `core/layout/shell/shell.ts` | Alta |
| D6 | **Imports cruzados entre features:** `LookupService` vive en `promos/lookup` y lo usan dashboard, orders y assignments; `assignments` importa `customers/customer`; `dashboard` importa `delivery/delivery-format`; `orders` importa `assignments/assignment-format` | varios | Alta |
| D7 | **Permisos y rutas repetidos con desfases:** el tile «Inventario» del dashboard pide `['report.view','config.edit']`, pero `nav.config` y `app.routes` también aceptan `stock.advance`; `promoPermissions` repite `PROMO_ANY_PERMISSION`; faltan tiles de Segmentos, Notificaciones y Validación de pedidos; permisos como strings sueltos | `dashboard.ts`, `nav.config.ts`, `app.routes.ts` | Alta |
| D8 | En el `nav.config.ts` revisado **ningún ítem tiene `comingSoon: true`**, así que la sección «Próximamente» del dashboard sale con el título y sin tiles | `dashboard.ts`, `nav.config.ts` | Media |
| D9 | Utilidades duplicadas: `todayIso()` en dashboard y order-list; `lastDayOfMonth()` a mano aunque `date-fns` está instalado; la extracción de errores del API (`err?.error?.errors`, `detail`, `message`) está escrita dentro de cada diálogo | varios | Media |
| D10 | Modelos en tres sitios (`shared/models/`, `promos/promo.types.ts`, `segments/segment.models.ts`); `segment.models.ts` existe dos veces con el mismo nombre | — | Media |
| D11 | `dashboard.ts` tiene ~700 líneas (template + ~350 de CSS + lógica) y el CSS inline se acerca al presupuesto de 4 kB | `dashboard.ts` | Media |
| D12 | Métodos llamados desde el template que deberían ser `computed` (`batchStatusSegments` se evalúa dos veces por render, `pendingModules()`) | `dashboard.ts` | Media |
| D13 | `restoreFromStorage()` deja `fullName: ''`: tras recargar la página, el saludo del dashboard pierde el nombre (salvo que otra pantalla lo complete; no vi `splash.ts`) | `core/auth/auth.ts` | Baja |
| D14 | Diálogos en `ui/` que inyectan servicios de datos (son contenedores, no presentacionales) | `create-assignment-dialog.ts` | Baja (ver 5.4) |
| D15 | `module-tabs.ts` repetido en ~12 features, incluido en cada página a mano en vez de una ruta layout | `features/*/ui/` | Baja |
| D16 | Estados como `string` con el catálogo en un comentario, y comentarios desfasados (`OrderSummary` lista 3 estados; `OrderDetail` añade `COUNTER_DELIVERED`); comparaciones con literales (`o.originCode === 'COUNTER'`) | `order.models.ts`, `order-list.ts` | Baja |
| D17 | Sin archivos `.spec.ts` visibles, aunque el runner ya está configurado | proyecto | Alta |
| D18 | Tokens JWT guardados en `localStorage` (decisión de seguridad, no bug confirmado; ver sección 11) | `core/auth/auth.ts` | Revisar |
| D19 | Menores: archivos de rutas con singular y plural mezclados; `ShellComponent` es el único con sufijo `Component`; JSDoc huérfano antes de `AdminOrderSummary`; tipos de reportes dentro de `order.models.ts` pese a existir `sales-report.models.ts` | varios | Baja |

---

## 4. Capas y regla de dependencias

```
features/<A>  ──x──▶  features/<B>        prohibido (salvo por <B>/index.ts)
     │
     ▼
   shared   ─────────▶   core
```

| Capa | Puede importar | No puede importar | Por qué |
|---|---|---|---|
| `core` | solo `core` y librerías | `features`, `shared` | Es la base: si depende del negocio, nada se puede cambiar sin tocar la infraestructura |
| `core/layout/shell` | además `shared/ui` (es el esqueleto visual) | `features` | El shell compone la UI, pero no debe conocer el negocio |
| `shared` | `core` y librerías | `features` | Debe ser reutilizable por cualquier feature |
| `features/<A>` | `core`, `shared`, su propio código | internals de `features/<B>` | Evita acoplamiento entre dominios y permite carga perezosa real y trabajo en paralelo |

Reglas prácticas:

- Si dos features necesitan lo mismo, **eso sube a `shared`**. No lo importes del otro feature.
- Si un feature debe exponer algo a otro, lo hace por su `index.ts` (API pública). Es la excepción, no la norma.
- **El shell no importa stores nuevos de features.** Para un badge nuevo en el menú se usará un token de inyección `NAV_BADGE` en `core/layout/` (pendiente: se crea la primera vez que haga falta; los tres imports actuales del shell son deuda D5).

**Excepciones toleradas hoy** (existen, no se amplían):

- `LookupService` desde `features/promos/lookup`.
- Formateadores de fecha (`dateTimeText`, `timeText`, `dateText`) desde `features/assignments/assignment-format`.
- Si necesitas una utilidad transversal que no existe en `shared`, **créala en `shared/utils/`** en vez de copiarla.

---

## 5. Estructura nueva de un feature

### 5.1 Plantilla

```
features/<dominio>/
├── <dominio>.routes.ts            rutas lazy del feature
├── index.ts                       API pública (solo si otro feature la necesita)
├── data-access/                   habla con el backend y guarda estado
│   ├── <x>.api.ts                 solo HTTP
│   └── <x>.store.ts               signals + acciones
├── domain/                        puro, sin Angular
│   ├── <x>.models.ts              contratos del backend
│   └── <x>.format.ts              funciones puras de formato y etiquetas
├── pages/                         componentes ruteados
│   └── <page-name>/
│       ├── <page-name>.page.ts
│       ├── <page-name>.page.html   (si el template es largo)
│       ├── <page-name>.page.scss   (si el CSS es largo)
│       └── <page-name>.page.spec.ts
├── dialogs/                       diálogos con lógica (contenedores)
│   └── <x>.dialog.ts
└── ui/                            componentes presentacionales del feature
    └── <x>.ts
```

Un feature **pequeño** (menos de ~8 archivos, ej. `maintenance`, `company`) puede quedarse plano, pero con los sufijos de la sección 6.

### 5.2 Responsabilidades

| Pieza | Puede | No puede | Por qué |
|---|---|---|---|
| **api** | Llamadas HTTP, devolver DTOs tipados | Guardar estado, tocar UI, mostrar toasts | Se puede probar y reutilizar sin Angular UI |
| **store** | Signals, acciones, llamar a la api de su feature | Conocer componentes | Un solo dueño del estado; las vistas solo lo leen |
| **page** | Leer stores/apis, coordinar, navegar, pasar datos a `ui/` | Lógica de formato, cálculos de gráficos, `HttpClient` directo | Páginas delgadas y fáciles de leer |
| **dialog** | Inyectar api/store de **su** feature, validar, guardar, cerrar con resultado | Inyectar servicios de otro feature | Un diálogo es un mini flujo con lógica propia |
| **ui** | `input()`, `output()`, mostrar | Inyectar servicios de datos | Se reutiliza y se prueba con solo pasar inputs |
| **domain** (`models`, `format`) | Tipos y funciones puras | Importar Angular | Es lo más barato de probar y no cambia con el framework |

### 5.3 Páginas con pestañas de módulo

En módulos nuevos **no se crea un `module-tabs.ts` propio ni se incluye a mano en cada página**. Se usa una ruta layout:

```ts
export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    component: OrdersLayout, // <ui-tabs/> + <router-outlet/>
    children: [
      { path: '', loadComponent: () => import('./pages/order-list/order-list.page').then((m) => m.OrderListPage) },
      // ...
    ],
  },
];
```

Se reutiliza `shared/ui/tabs`. Los features existentes conservan sus `module-tabs.ts` hasta la migración.

### 5.4 Diálogos

Lo visto en `create-assignment-dialog.ts`:

- `UiDialogService` (`shared/ui/dialog/dialog.ts`) abre y confirma; el diálogo recibe datos con `UI_DIALOG_DATA` y se cierra con `UiDialogRef<T>`.
- `ui-modal` (`shared/ui/modal/modal.ts`) es el **marco visual**: `title`, `subtitle`, `(close)` y el slot `modalFooter` para los botones.
- Un diálogo que guarda datos es un **contenedor** (inyecta api/store, maneja `saving`, `error`, toast). Por eso va en `dialogs/`, no en `ui/`.
- Los datos de entrada se tipan con una interfaz exportada `XxxDialogData`. El cierre devuelve `boolean` o el resultado.

---

## 6. Convención de nombres

| Qué | Archivo (nuevo) | Clase | Ejemplo |
|---|---|---|---|
| Página | `*.page.ts` | `*Page` | `order-list.page.ts` → `OrderListPage` |
| Layout de módulo | `*.layout.ts` | `*Layout` | `orders.layout.ts` → `OrdersLayout` |
| Servicio HTTP | `*.api.ts` | `*Api` | `order.api.ts` → `OrderApi` |
| Store | `*.store.ts` | `*Store` | `route.store.ts` → `RouteStore` |
| Diálogo | `*.dialog.ts` | `*Dialog` | `create-assignment.dialog.ts` → `CreateAssignmentDialog` |
| Modelos | `*.models.ts` | interfaces y tipos | `order.models.ts` |
| Formato | `*.format.ts` | funciones | `order.format.ts` |
| Rutas | `<carpeta-del-feature>.routes.ts` | `*_ROUTES` | `orders/orders.routes.ts` → `ORDERS_ROUTES` |
| Componente presentacional | `<nombre>.ts` | `Ui*` en `shared/ui`, `*` en `ui/` del feature | `shared/ui/button/button.ts` → `UiButton` |
| Prueba | `<archivo>.spec.ts` junto al archivo | — | `order.format.spec.ts` |

Además:

- **Idioma:** archivos, clases, variables y comentarios técnicos en **inglés**; rutas URL (`/pedidos`, `/reparto`) y textos visibles en **español**. Los comentarios que explican reglas de negocio pueden ir en español (ya se hace así).
- **Selectores:** prefijo `app-` (`app-order-list`).
- **Clases CSS por página con prefijo corto** (`ord-`, `home-`, `cad-`) para evitar choques.
- **Archivos legacy no se renombran** (`order-admin.ts`, `route-store.ts`): conviven con los nuevos.
- **Referencias al backend:** los modelos y apis nuevos citan el documento del backend que los define (como ya se hace: «doc 30, sección 9.1»).

---

## 7. Cómo se aplica (nuevo vs. existente)

| Situación | Qué hacer |
|---|---|
| Feature o módulo **nuevo** | Estructura nueva completa (sección 5) |
| **Archivo nuevo** dentro de un feature existente | Va en su subcarpeta de capa; el resto del feature queda como está. Puede importar los archivos legacy planos |
| **Bug o cambio pequeño** en un archivo existente | Se edita ahí. No se migra, no se parte, no se renombra |
| Cambio funcional grande en un archivo existente | Si el archivo es una página, se puede extraer lo **nuevo** a archivos de la estructura nueva; lo viejo no se toca |
| Feature **rehecho** completo | Se migra entero a la estructura nueva |
| Migración completa de todo | **Fase final aparte** (sección 12). No se hace de a poco ni por iniciativa propia |

Coexistencia en una misma carpeta: en el `*.routes.ts`, las rutas nuevas apuntan a `./pages/...`; las viejas siguen apuntando a los archivos planos. No se mezclan estilos dentro de un mismo archivo.

**Modelos nuevos** nacen en `features/<x>/domain/`. Los existentes siguen en `shared/models/` hasta la fase final.

---

## 8. Patrones de código

### 8.1 Carga de datos

Reglas: filtros en **un solo** `computed`; la petición nueva **cancela** la anterior; estados de carga, error y vacío siempre resueltos (`ui-table` con `(retry)` y `ui-empty`).

**Así no** (patrón actual de `order-list.ts`): varios `effect` que llaman a `load()` a mano, sin cancelar.

```ts
private serverFiltersEffect = effect(() => {
  this.customerFilter(); this.statusFilter(); this.dayFilter(); // ...
  untracked(() => { this.page.set(0); this.load(); });
});
```

**Así sí:**

```ts
private readonly filters = computed(() => ({
  ...this.dateRange(),
  customerId: this.customerFilter()?.id,
  statusCode: this.statusFilter() || undefined,
  page: this.page(),
  size: this.size(),
}));

private readonly result$ = toObservable(this.filters).pipe(
  tap(() => { this.loading.set(true); this.error.set(false); }),
  switchMap((f) =>
    this.api.list(f).pipe(
      catchError(() => { this.error.set(true); return of(null); }),
    ),
  ),
  tap(() => this.loading.set(false)),
);
protected readonly result = toSignal(this.result$, { initialValue: null });
```

Notas:

- Los parámetros que llegan por la URL (`input()` con alias) deben **entrar al mismo `computed`** como valor inicial, para que no haya dos cargas (D3).
- Al cambiar un filtro hay que volver a `page = 0` en el manejador del cambio, no en un efecto que dispare otra carga.
- Si el usuario puede elegir **día o mes**, son excluyentes: al elegir uno se limpia el otro, o se usa un único selector de período (D4).
- `rxResource` queda como alternativa **a verificar en la documentación de Angular 22** antes de adoptarla. `switchMap` es la base.
- Una función llamada desde el template que construye un arreglo u objeto debe ser un `computed`, no un método.

### 8.2 Permisos

Código nuevo usa constantes, no strings. Ubicación prevista: `core/auth/permissions.ts` (pendiente de crear).

```ts
export const PERMISSIONS = {
  CUSTOMER_VIEW: 'customer.view',
  ORDER_MANAGE: 'order.manage',
  // ...
} as const;
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
```

Permisos vistos en `nav.config.ts` y `app.routes.ts` (verificar contra el backend):

`customer.view`, `customer.approve`, `customer.assign`, `order.view_all`, `order.create`, `order.manage`, `order.send_to_billing`, `promo.create`, `promo.approve`, `promo.allocate`, `segment.manage`, `delivery.deliver`, `delivery.settle`, `invoice.reconcile`, `notification.view_all`, `notification.send`, `price.view`, `product.edit`, `report.view`, `config.edit`, `stock.advance`, `user.manage`.

- El guard va en la **ruta padre** del feature (`app.routes.ts`), no en cada pantalla.
- Un permiso que se use en varios sitios (menú, ruta, botón) se define **una vez**: ver `PROMO_ANY_PERMISSION` como modelo, pero exportado y reutilizado, no copiado.
- Al cambiar el permiso de un módulo, se revisan **los tres sitios**: `app.routes.ts`, `nav.config.ts` y los tiles del dashboard (D7).

### 8.3 Navegación y dashboard

- `nav.config.ts` es la fuente de verdad. Un módulo nuevo se registra ahí **y** en `app.routes.ts`.
- Los tiles de acceso del dashboard deben generarse desde `NAV` (campo `description` por ítem, pendiente de añadir), no escribirse a mano.
- `comingSoon: true` marca un módulo apagado; si no queda ninguno, no se debe mostrar la sección «Próximamente».

### 8.4 Errores del API y avisos

- Errores globales: `errorInterceptor` (inferido). Avisos al usuario: `ToastService` (`core/ui/toast.ts`).
- El mensaje de un error de formulario se extrae con **un solo helper** compartido (pendiente de crear en `shared/utils/api-error.ts`), no con `err?.error?.errors` escrito en cada diálogo. Los campos que usa hoy el backend: `error.errors.<campo>`, `error.detail`, `error.message`.

### 8.5 Fechas

- Una sola implementación en `shared/utils/date.ts` (pendiente de crear): `todayIso()`, `lastDayOfMonth()`, etc., con `date-fns`.
- Siempre fecha **local**, nunca `toISOString()` para «hoy»: en Lima (UTC-5) después de las 19:00 daría el día siguiente.
- Los formateadores genéricos (`dateText`, `dateTimeText`, `timeText`) no deben vivir dentro de un feature (D6).

### 8.6 Tipos

- Catálogos cerrados del backend se tipan como unión literal, no `string`:

```ts
export type OrderStatusCode = 'OPEN' | 'SENT_TO_BILLING' | 'COUNTER_DELIVERED' | 'CANCELLED';
export type OrderOriginCode = 'FIELD' | 'COUNTER';
```

- Un modelo que extiende a otro lo hace con `extends` (como `AdminOrderSummary extends OrderSummary`).
- Los tipos locales de un componente se declaran en el mismo archivo (como `AssignCase` en el diálogo de asignación).

### 8.7 Componentes, signals y zoneless

- Solo **standalone components**; sin NgModules. Dependencias en el array `imports`.
- `inject()` en lugar de constructor para dependencias; `input()` / `output()` / `model` en lugar de decoradores; control de flujo `@if` / `@for (… track …)` / `@switch`.
- Estado local con `signal`, derivados con `computed`. `effect` solo para reaccionar a cambios y **siempre con `untracked`** para lo que no debe disparar el efecto.
- Zoneless: cualquier dato que cambie en un callback (`subscribe`, `setTimeout`, evento externo) debe escribirse en un signal.

### 8.8 UI y estilos

Observado en las páginas actuales; se mantiene en las nuevas (el detalle visual manda `DESIGN.md`):

- **Solo componentes del design system:** `UiButton` (`<button uiButton variant="primary|secondary|ghost" size="sm">`), `UiField`, `UiTypeahead`, `UiTable`, `UiStatus`, `UiEmpty`, `UiModal`, etc. Antes de usar algo de `@angular/material`, comprueba que no exista el equivalente en `shared/ui`. CDK (`overlay`, `BreakpointObserver`) sí se usa.
- **Tokens CSS** de `styles/_tokens.scss` (confirmar el nombre exacto allí): `--ink`, `--ink-muted`, `--hairline`, `--faint`, `--accent`, `--accent-ink`, `--bg`, `--divider`, `--status-ok`, `--status-danger`, `--sp-4`, `--sp-8`, `--fs-*`, `--fw-*`, `--touch-min`, `--dur-*`, `--ease-standard`. Sin colores ni espaciados fijos.
- Estructura de una página de listado: `<section class="xxx-page">` con `padding: var(--sp-8)` (`--sp-4` en móvil, `max-width: 767px`) → cabecera con `h1` y subtítulo → filtros en grilla `auto-fill` → `ui-table` → paginador. En móvil, la tabla se reemplaza por tarjetas.
- **Tamaño de archivo:** si el template pasa de ~80 líneas o el CSS de ~60, se separan a `.html` y `.scss`. Si una página crece sin control, se parte en componentes de `ui/`. El presupuesto `anyComponentStyle` (4 kB / 8 kB) es el límite real.

---

## 9. Pruebas

- Runner: `npm test` (`ng test`, Vitest con `vitest/globals`, `jsdom`). Ya está configurado; falta escribir las pruebas.
- El `.spec.ts` va **junto** al archivo que prueba.
- **Obligatorias** para todo archivo **nuevo** de estos tipos: `*.format.ts`, `*.store.ts`, utilidades de `shared/utils/`, guards, interceptores y el helper de errores del API.
- Recomendadas: páginas con lógica de filtros o validaciones (calcular `canSubmit`, `assignCase`, rangos de fecha).
- Una prueba cubre el caso normal, el caso vacío o nulo y un caso de error. Las funciones de `*.format.ts` son puras: no necesitan `TestBed`.

---

## 10. Cumplimiento y herramientas

**Imports:** hoy se usan **imports relativos** (`../../shared/ui/button/button`). Los alias siguen **sin configurar**. Cuando se activen, se añadirán así en `tsconfig.json`, sin mover ningún archivo:

```json
"compilerOptions": {
  "paths": {
    "@core/*": ["./src/app/core/*"],
    "@shared/*": ["./src/app/shared/*"],
    "@features/*": ["./src/app/features/*"]
  }
}
```

**`strict` (pendiente):** se activa en una rama aparte y por pasos, mergeando cada uno: 1) `strictTemplates` en `angularCompilerOptions`, 2) `strictNullChecks`, 3) `strict: true`. Es normal que aparezcan errores nuevos.

**ESLint (pendiente):** no está instalado. Cuando se instale, las reglas de la sección 4 se imponen con `eslint-plugin-boundaries` o `@softarc/sheriff`, primero en `warn` y luego en `error`.

**Checklist de PR (revísalo antes de dar algo por terminado):**

- [ ] ¿El archivo nuevo está en la capa correcta (`pages`, `data-access`, `domain`, `dialogs`, `ui`)?
- [ ] ¿Respeta la regla de dependencias (sin imports internos de otro feature, `core` sin `features`)?
- [ ] ¿La página evita `HttpClient` y lógica de formato?
- [ ] ¿Los permisos salen de `PERMISSIONS` y, si es un módulo nuevo, está en `nav.config.ts` y `app.routes.ts`?
- [ ] ¿La carga de datos cancela la petición anterior y resuelve carga, error y vacío?
- [ ] ¿Hay `.spec.ts` para los formatos, stores y utilidades nuevos?
- [ ] ¿Los estilos usan tokens y el CSS no se acerca a los 4 kB?
- [ ] ¿Se tocó un archivo legacy solo para lo necesario (sin mover ni renombrar)?

---

## 11. Decisiones pendientes

Mientras no se decidan, el agente usa el valor por defecto.

| Tema | Situación | Por defecto mientras tanto |
|---|---|---|
| `dialog` vs `modal` | **No son duplicados:** `dialog` es el mecanismo (servicio, `UI_DIALOG_DATA`, `UiDialogRef`) y `modal` es el marco visual (`ui-modal`) | Usar los dos juntos como en `create-assignment-dialog.ts` |
| Confirmaciones | `UiDialogService.confirm()` (lo usa el shell) puede solapar con `shared/components/confirm-dialog.ts` y `reason-dialog.ts` (inferido, no vi esos archivos) | Para confirmaciones nuevas, `UiDialogService.confirm()` |
| `stepper` vs `wizard-steps` | `shared/ui/stepper` y `promos/ui/wizard-steps` parecen cubrir lo mismo (inferido) | Usar `shared/ui/stepper`; no crear más steppers |
| Nombre de `*.routes.ts` | Hay singular (`order.routes`, `user.routes`, `notification.routes`) y plural (`promos.routes`, `segments.routes`) | El nombre de la carpeta del feature: `orders/orders.routes.ts` |
| `billing` | Tiene tres entradas (`/facturas`, `/validacion-facturacion`, `/factura/:id`) y dos archivos de rutas; probablemente son dos features | No añadir más pantallas a `billing` sin consultar |
| Material vs design system propio | `@angular/material` está instalado y existe `shared/ui` | `shared/ui` primero |
| Tokens en `localStorage` | `auth.ts` guarda access y refresh en `localStorage` | No cambiar sin decisión explícita; no copiar el patrón a otros datos sensibles |
| `NAV_BADGE` | El shell importa stores de features (D5) | Crear el token cuando se necesite un badge nuevo |
| Alias y `strict` | Pendientes (sección 10) | Imports relativos; no activar por cuenta propia |

---

## 12. Registro de migración

Estado de cada feature. Cambia a **Parcial** cuando un feature tiene archivos nuevos en la estructura nueva, y a **Migrado** cuando ya no tiene archivos legacy planos.

| Feature | Estado | Notas |
|---|---|---|
| assignments | Legacy (plano) | 17 archivos; `module-tabs`; importa `customers` y `promos/lookup` |
| auth | Legacy (plano) | `login`, `splash` |
| billing | Legacy (plano) | Posible división en dos features |
| catalog | Legacy (plano) | |
| company | Legacy (plano) | Pequeño; puede quedarse plano |
| customer-requests | Legacy (plano) | |
| customers | Legacy (plano) | |
| dashboard | Legacy (plano) | D2, D7, D8, D11, D12 |
| delivery | Legacy (plano) | |
| fleet | Legacy (plano) | |
| inventory | Legacy (plano) | |
| maintenance | Legacy (plano) | Pequeño; puede quedarse plano |
| notifications | Legacy (plano) | Convive con `core/notifications` |
| orders | Legacy (plano) | D2, D3, D4; candidato a feature piloto |
| promos | Legacy (plano) | Aloja `LookupService` (debería estar en `shared`) |
| sales | Legacy (plano) | Solo `allocation.ts`; la dotación está repartida con `promos` y `shared/models` |
| sales-reports | Legacy (plano) | |
| segments | Legacy (plano) | `segment.models.ts` duplicado |
| users | Legacy (plano) | |

### Fase final: migración completa (todavía no autorizada)

Solo se ejecuta cuando se ordene explícitamente, en este orden:

1. Activar alias, `strict` por pasos e instalar ESLint en modo `warn`.
2. Mover lo transversal: `LookupService` → `shared/data-access/lookup.api.ts`; fechas → `shared/utils/date.ts`; `core/ui/toast.ts` → `shared/ui/toast/`; `auth.models.ts` → `core/auth/`; crear `PERMISSIONS`.
3. Independizar el shell con `NAV_BADGE`.
4. Migrar `orders` como piloto y fijar la plantilla.
5. Migrar el resto de features, uno por uno.
6. Mover los modelos de `shared/models/` a `features/<x>/domain/`.
7. Unificar `shared/components/` en `shared/ui/`, resolver los pares de la sección 11 y reemplazar los `module-tabs` por rutas layout.
8. Subir ESLint de `warn` a `error`.

---

## 13. Alcance de la verificación

Este documento se redactó tras leer: `package.json`, `angular.json`, `tsconfig*.json`, `app.config.ts`, `app.routes.ts`, `assignments.routes.ts`, `nav.config.ts`, `shell.ts`, `auth.ts`, `dashboard.ts`, `order-list.ts`, `order.models.ts` y `create-assignment-dialog.ts`, además del árbol de carpetas.

**No se leyeron** (lo que se dice de ellos es inferido): `auth-guard`, `permission-guard`, interceptores, `ws.ts`, los stores, `lookup.ts`, `DESIGN.md`, `styles/*`, `electron/main.js`, `ngsw-config.json` y los componentes de `shared/ui` y `shared/components`. Si el comportamiento de alguno contradice este documento, **manda el código** y se corrige el documento.
