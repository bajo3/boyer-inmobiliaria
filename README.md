# CRM Boyer

Sistema interno de **María Paz Boyer — Negocios Inmobiliarios** (Tandil).
Implementa la Fase 1 del [plan](../plan-crm-boyer.pdf): que ninguna consulta se
pierda y que quede registrado qué pasó con cada una.

## El circuito

La administrativa carga el lead y se lo pasa a un vendedor. De ahí en más el
estado se mueve solo, según lo que el vendedor registra:

```
No atendido  →  Contactado  →  Re-contactar  →  Ganado
                                             ↘  Rechazado (con motivo)
```

No hay que elegir el estado a mano en ningún momento: registrar un contacto
pasa a "Contactado", y si además se deja una fecha, queda en "Re-contactar".
Las únicas dos acciones explícitas son **Ganado** y **Rechazar**.

## Qué hace

- **Bandeja de consultas** ordenada por urgencia, no por fecha.
- **Semáforo de primera respuesta**: verde < 1 h hábil, amarillo < 4 h, rojo después.
- **Próxima acción obligatoria**: una consulta abierta sin próximo paso con fecha aparece en rojo.
- **Rechazo con motivo** de una lista fija de cinco. Sin motivo no se rechaza.
- **WhatsApp con plantillas**: links `wa.me` con el mensaje ya escrito.
- **Propiedades** con propietario, autorización y aviso 30 días antes del vencimiento.
- **Contactos** con perfil de búsqueda (la base del matching de la Fase 2).
- **Agenda** de visitas.
- **Buscador** en la bandeja por nombre, teléfono, código o calle.
- **Corregir, reasignar y borrar** consultas — solo administrativa y titular.
- **Cambio de contraseña** en `/cuenta`, con aviso hasta que cada uno cambie la inicial.
- **Panel** con las seis preguntas de control, solo para el perfil titular.

### Los tres roles

| Rol | Qué hace | Abre en |
|---|---|---|
| `administrativa` | Carga los leads y los reparte entre los vendedores | Todas |
| `vendedor` | Trabaja los suyos. No ve precio piso ni notas internas | Mías |
| `titular` | Ve todo, más el Panel | Todas |

## Arrancar

```bash
npm install
cp .env.example .env     # completar DATABASE_URL y AUTH_SECRET
npm run db:migrate
npm run db:seed
npm run dev
```

Entrar en http://localhost:3000 con el mail del usuario titular y el
`SEED_PASSWORD` del `.env`.

### Base de datos

Sirve cualquier Postgres, y `DATABASE_URL` define cuál:

```bash
# Postgres de verdad — lo que va en producción y lo recomendado para trabajar
DATABASE_URL="postgresql://usuario:password@host:5432/postgres"

# Postgres embebido (PGlite) — cero instalación, para una primera mirada
DATABASE_URL="pglite://./.pglite"
```

Para producción: **Supabase**, **Railway** o **Neon**. El plan gratuito sobra
para tres usuarios y 47 propiedades.

Para desarrollo, lo más cómodo es un contenedor:

```bash
docker run -d --name pg-boyer -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:17
```

> **Sobre el modo embebido.** PGlite es Postgres compilado a WASM: el SQL es el
> mismo y alcanza perfectamente para recorrer el sistema sin instalar nada. Pero
> corre dentro del proceso de Node y no tolera dos instancias sobre el mismo
> directorio de datos. Cuando Fast Refresh hace un reload completo, eso llega a
> pasar y el motor aborta con `RuntimeError: Aborted()`; se sale borrando
> `.pglite/` y volviendo a correr `db:migrate` y `db:seed`. Por eso es para
> mirar, no para desarrollar varias horas seguidas.

### Ojo con `DATABASE_URL`

Si tenés un `DATABASE_URL` exportado en la terminal de otro proyecto, en
condiciones normales le gana al `.env` y la app arranca contra la base
equivocada sin avisar. Por eso, **en desarrollo el `.env` del proyecto tiene
prioridad** (ver `src/db/env.ts`). En producción no hay archivo `.env` y mandan
las variables reales del entorno. Los scripts `db:migrate` y `db:seed` imprimen
a qué base apuntan antes de tocar nada.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run db:generate` | Genera la migración SQL desde el schema |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Usuarios + las 37 propiedades del relevamiento |
| `npm run db:seed -- --demo` | Además, consultas de ejemplo |
| `npm run db:studio` | Explorador visual de la base |

> `db:seed -- --demo` mezcla contactos inventados con los reales.
> **Nunca correrlo sobre la base de la inmobiliaria.**

## Estructura

```
src/
  db/schema.ts        Las 9 tablas y sus enums
  db/seed.ts          Carga inicial
  lib/sla.ts          Las 4 reglas del plan, en código
  lib/telefono.ts     Normalización a E.164 (evita contactos duplicados)
  lib/whatsapp.ts     Plantillas y links wa.me
  actions/            Server actions: acá se aplican las reglas
  app/(app)/          Pantallas privadas
  components/         Formularios y piezas de UI
drizzle/              Migraciones SQL versionadas
```

## Antes de ponerlo en producción

Las dos decisiones que el plan marca como **bloqueantes** siguen abiertas y están
hardcodeadas con valores provisorios en `src/db/seed.ts`:

1. **Cuál de los tres teléfonos es el oficial.** Todo el sistema se apoya en un
   único número de WhatsApp.
2. **Quiénes son los vendedores y qué ve cada uno.** Hoy el perfil `vendedor` no
   ve el precio piso ni las notas internas de las autorizaciones; el `titular` sí.

Además:

- Que cada usuario cambie su contraseña desde `/cuenta` (el sistema se lo
  recuerda con un aviso arriba de todo hasta que lo haga).
- Cargar las 10 propiedades que faltan (el relevamiento juntó 37 de 47).
- Revisar la ventana del SLA en `src/lib/sla.ts`: hoy mide de 9 a 18, L-V. La
  oficina atiende 9–13, pero el WhatsApp se contesta desde el celular.
