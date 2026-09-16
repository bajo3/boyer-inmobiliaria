import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ────────────────────────────── enums ────────────────────────────── */

/**
 * La administrativa carga y reparte los leads; no vende.
 * El titular ve todo, incluido el panel y los datos internos de autorización.
 */
export const rolEnum = pgEnum("rol", ["titular", "administrativa", "vendedor"]);

export const tipoContactoEnum = pgEnum("tipo_contacto", [
  "comprador",
  "propietario",
  "inquilino",
  "ambos",
]);

export const canalEnum = pgEnum("canal", [
  "whatsapp",
  "instagram",
  "facebook",
  "zonaprop",
  "llamada",
  "mostrador",
  "web",
]);

export const operacionEnum = pgEnum("operacion", ["venta", "alquiler"]);

export const tipoPropiedadEnum = pgEnum("tipo_propiedad", [
  "casa",
  "departamento",
  "ph",
  "lote",
  "campo",
  "local",
  "galpon",
  "cochera",
  "quinta",
]);

export const estadoPropiedadEnum = pgEnum("estado_propiedad", [
  "borrador",
  "publicada",
  "reservada",
  "vendida",
  "suspendida",
]);

export const monedaEnum = pgEnum("moneda", ["USD", "ARS"]);

/**
 * El circuito completo, en cinco estados.
 *
 *   no_atendido  la administrativa la cargó, nadie la tocó todavía
 *   contactado   el vendedor ya habló con la persona
 *   recontactar  quedó en volver a llamar — siempre con fecha
 *   ganado       cerró la operación
 *   rechazado    no va más, con motivo
 *
 * Deliberadamente no hay "visita" ni "negociación": son cosas que pasan
 * dentro de "contactado" y se ven en el historial. Un estado de más es un
 * estado que nadie mantiene al día.
 */
export const estadoConsultaEnum = pgEnum("estado_consulta", [
  "no_atendido",
  "contactado",
  "recontactar",
  "ganado",
  "rechazado",
]);

/** Obligatorio para rechazar. Cinco opciones, ninguna es "otro". */
export const motivoRechazoEnum = pgEnum("motivo_rechazo", [
  "compro_en_otra",
  "no_calificaba",
  "nunca_respondio",
  "fuera_de_zona",
  "precio",
]);

export const tipoActividadEnum = pgEnum("tipo_actividad", [
  "nota",
  "llamada",
  "whatsapp",
  "email",
  "visita",
  "oferta",
  "cambio_estado",
]);

export const estadoVisitaEnum = pgEnum("estado_visita", [
  "agendada",
  "realizada",
  "cancelada",
  "no_asistio",
]);

export const interesEnum = pgEnum("interes", ["alto", "medio", "bajo"]);

export const etapaOperacionEnum = pgEnum("etapa_operacion", [
  "reserva",
  "boleto",
  "escritura",
  "caida",
]);

export const estadoContratoEnum = pgEnum("estado_contrato", [
  "activo",
  "finalizado",
  "rescindido",
]);

/** Cada cuánto se actualiza el monto. Lo más común hoy en Tandil es cuatrimestral. */
export const ajusteEnum = pgEnum("ajuste", [
  "trimestral",
  "cuatrimestral",
  "semestral",
  "anual",
  "sin_ajuste",
]);

/* ────────────────────────────── usuarios ────────────────────────────── */

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  rol: rolEnum("rol").notNull().default("vendedor"),
  telefono: text("telefono"),
  activo: boolean("activo").notNull().default(true),
  /**
   * Falso mientras el usuario siga con la contraseña que se le asignó al
   * crearlo. El sistema se lo recuerda arriba de todo hasta que la cambie.
   */
  passwordCambiado: boolean("password_cambiado").notNull().default(false),
  creadoAt: timestamp("creado_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────── contactos ────────────────────────────── */

export const contactos = pgTable(
  "contactos",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    /** Guardado siempre normalizado a E.164 (+549249…). Ver lib/telefono.ts */
    telefono: text("telefono"),
    email: text("email"),
    tipo: tipoContactoEnum("tipo").notNull().default("comprador"),
    /** Primer canal por el que llegó. No cambia nunca. */
    origen: canalEnum("origen").notNull().default("whatsapp"),
    vendedorId: integer("vendedor_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    notas: text("notas"),
    creadoAt: timestamp("creado_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contactos_telefono_idx").on(t.telefono),
    index("contactos_nombre_idx").on(t.nombre),
  ],
);

/* ────────────────────────────── propiedades ────────────────────────────── */

export const propiedades = pgTable(
  "propiedades",
  {
    id: serial("id").primaryKey(),
    /** BOY-0001, correlativo. Lo genera lib/codigo.ts */
    codigo: text("codigo").notNull(),
    operacion: operacionEnum("operacion").notNull().default("venta"),
    tipo: tipoPropiedadEnum("tipo").notNull(),
    direccion: text("direccion").notNull(),
    barrio: text("barrio"),
    precio: numeric("precio", { precision: 14, scale: 2 }),
    moneda: monedaEnum("moneda").notNull().default("USD"),
    expensas: numeric("expensas", { precision: 12, scale: 2 }),
    m2Totales: integer("m2_totales"),
    m2Cubiertos: integer("m2_cubiertos"),
    ambientes: integer("ambientes"),
    dormitorios: integer("dormitorios"),
    banos: integer("banos"),
    cocheras: integer("cocheras"),
    estado: estadoPropiedadEnum("estado").notNull().default("publicada"),
    descripcion: text("descripcion"),
    propietarioId: integer("propietario_id").references(() => contactos.id, {
      onDelete: "set null",
    }),
    /** ["zonaprop","argenprop","ml","web","instagram"] */
    publicadaEn: jsonb("publicada_en").$type<string[]>().default([]).notNull(),
    fotos: jsonb("fotos").$type<string[]>().default([]).notNull(),
    destacada: boolean("destacada").notNull().default(false),
    creadoAt: timestamp("creado_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("propiedades_codigo_idx").on(t.codigo),
    index("propiedades_estado_idx").on(t.estado),
    index("propiedades_barrio_idx").on(t.barrio),
  ],
);

/**
 * Tabla aparte a propósito: es la parte que nadie carga y después duele.
 * El panel avisa 30 días antes del vencimiento.
 */
export const autorizaciones = pgTable(
  "autorizaciones",
  {
    id: serial("id").primaryKey(),
    propiedadId: integer("propiedad_id")
      .notNull()
      .references(() => propiedades.id, { onDelete: "cascade" }),
    propietarioId: integer("propietario_id").references(() => contactos.id, {
      onDelete: "set null",
    }),
    desde: date("desde").notNull(),
    hasta: date("hasta").notNull(),
    exclusiva: boolean("exclusiva").notNull().default(false),
    comisionPct: numeric("comision_pct", { precision: 5, scale: 2 }),
    precioAutorizado: numeric("precio_autorizado", { precision: 14, scale: 2 }),
    /** Precio mínimo que aceptaría el propietario. NUNCA se muestra al cliente. */
    precioPiso: numeric("precio_piso", { precision: 14, scale: 2 }),
    notasInternas: text("notas_internas"),
  },
  (t) => [index("autorizaciones_hasta_idx").on(t.hasta)],
);

/* ────────────────────────────── consultas ────────────────────────────── */

export const consultas = pgTable(
  "consultas",
  {
    id: serial("id").primaryKey(),
    contactoId: integer("contacto_id")
      .notNull()
      .references(() => contactos.id, { onDelete: "cascade" }),
    propiedadId: integer("propiedad_id").references(() => propiedades.id, {
      onDelete: "set null",
    }),
    canal: canalEnum("canal").notNull(),
    mensajeOriginal: text("mensaje_original"),
    estado: estadoConsultaEnum("estado").notNull().default("no_atendido"),
    /** El vendedor que la trabaja. La asigna la administrativa al cargarla. */
    asignadaA: integer("asignada_a").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    /** Quién la cargó. Casi siempre la administrativa. */
    cargadaPor: integer("cargada_por").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    creadaAt: timestamp("creada_at", { withTimezone: true }).notNull().defaultNow(),
    /** Regla 1: el semáforo se calcula contra esto. */
    primeraRespuestaAt: timestamp("primera_respuesta_at", { withTimezone: true }),
    /** Regla 2: una consulta abierta sin esto aparece en rojo. */
    proximaAccion: text("proxima_accion"),
    proximaAccionAt: timestamp("proxima_accion_at", { withTimezone: true }),
    /** Regla 3: obligatorio para cerrar. */
    motivoRechazo: motivoRechazoEnum("motivo_rechazo"),
    cerradaAt: timestamp("cerrada_at", { withTimezone: true }),
  },
  (t) => [
    index("consultas_estado_idx").on(t.estado),
    index("consultas_asignada_idx").on(t.asignadaA),
    index("consultas_creada_idx").on(t.creadaAt),
    index("consultas_propiedad_idx").on(t.propiedadId),
  ],
);

export const actividades = pgTable(
  "actividades",
  {
    id: serial("id").primaryKey(),
    consultaId: integer("consulta_id")
      .notNull()
      .references(() => consultas.id, { onDelete: "cascade" }),
    usuarioId: integer("usuario_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    tipo: tipoActividadEnum("tipo").notNull(),
    contenido: text("contenido").notNull(),
    fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("actividades_consulta_idx").on(t.consultaId)],
);

/* ────────────────────────────── búsquedas y visitas ────────────────────────────── */

export const busquedas = pgTable("busquedas", {
  id: serial("id").primaryKey(),
  contactoId: integer("contacto_id")
    .notNull()
    .references(() => contactos.id, { onDelete: "cascade" }),
  operacion: operacionEnum("operacion").notNull().default("venta"),
  tipos: jsonb("tipos").$type<string[]>().default([]).notNull(),
  barrios: jsonb("barrios").$type<string[]>().default([]).notNull(),
  precioMin: numeric("precio_min", { precision: 14, scale: 2 }),
  precioMax: numeric("precio_max", { precision: 14, scale: 2 }),
  moneda: monedaEnum("moneda").notNull().default("USD"),
  dormitoriosMin: integer("dormitorios_min"),
  cochera: boolean("cochera").notNull().default(false),
  aptoCredito: boolean("apto_credito").notNull().default(false),
  activa: boolean("activa").notNull().default(true),
  notas: text("notas"),
  creadoAt: timestamp("creado_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visitas = pgTable(
  "visitas",
  {
    id: serial("id").primaryKey(),
    propiedadId: integer("propiedad_id")
      .notNull()
      .references(() => propiedades.id, { onDelete: "cascade" }),
    contactoId: integer("contacto_id")
      .notNull()
      .references(() => contactos.id, { onDelete: "cascade" }),
    consultaId: integer("consulta_id").references(() => consultas.id, {
      onDelete: "set null",
    }),
    usuarioId: integer("usuario_id").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    fechaHora: timestamp("fecha_hora", { withTimezone: true }).notNull(),
    estado: estadoVisitaEnum("estado").notNull().default("agendada"),
    /** Obligatorio al marcar "realizada". Es el dato que más vale. */
    feedback: text("feedback"),
    interes: interesEnum("interes"),
  },
  (t) => [index("visitas_fecha_idx").on(t.fechaHora)],
);

/* ────────────────────────────── operaciones ────────────────────────────── */

export const operaciones = pgTable("operaciones", {
  id: serial("id").primaryKey(),
  propiedadId: integer("propiedad_id")
    .notNull()
    .references(() => propiedades.id, { onDelete: "cascade" }),
  compradorId: integer("comprador_id").references(() => contactos.id, {
    onDelete: "set null",
  }),
  usuarioId: integer("usuario_id").references(() => usuarios.id, {
    onDelete: "set null",
  }),
  etapa: etapaOperacionEnum("etapa").notNull().default("reserva"),
  montoCerrado: numeric("monto_cerrado", { precision: 14, scale: 2 }),
  moneda: monedaEnum("moneda").notNull().default("USD"),
  senia: numeric("senia", { precision: 14, scale: 2 }),
  fechaReserva: date("fecha_reserva"),
  fechaBoleto: date("fecha_boleto"),
  fechaEscritura: date("fecha_escritura"),
  escribania: text("escribania"),
  comisionMonto: numeric("comision_monto", { precision: 14, scale: 2 }),
  comisionCobrada: boolean("comision_cobrada").notNull().default(false),
  creadoAt: timestamp("creado_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ────────────────────────────── alquileres ────────────────────────────── */

/**
 * Un contrato de alquiler vivo: quién alquila qué, cuánto paga y qué día.
 *
 * El alquiler es la parte del negocio que se repite todos los meses, así que
 * es también la que más se olvida: el cobro no falla por falta de ganas sino
 * porque nadie lleva la cuenta de quién ya pagó. De acá sale el recordatorio.
 */
export const contratos = pgTable(
  "contratos",
  {
    id: serial("id").primaryKey(),
    propiedadId: integer("propiedad_id")
      .notNull()
      .references(() => propiedades.id, { onDelete: "cascade" }),
    inquilinoId: integer("inquilino_id")
      .notNull()
      .references(() => contactos.id, { onDelete: "cascade" }),
    propietarioId: integer("propietario_id").references(() => contactos.id, {
      onDelete: "set null",
    }),
    monto: numeric("monto", { precision: 14, scale: 2 }).notNull(),
    moneda: monedaEnum("moneda").notNull().default("ARS"),
    expensas: numeric("expensas", { precision: 12, scale: 2 }),
    /** Día del mes en que vence. Si el mes es más corto, se usa el último día. */
    diaVencimiento: integer("dia_vencimiento").notNull().default(10),
    inicio: date("inicio").notNull(),
    fin: date("fin").notNull(),
    ajuste: ajusteEnum("ajuste").notNull().default("cuatrimestral"),
    proximoAjuste: date("proximo_ajuste"),
    comisionPct: numeric("comision_pct", { precision: 5, scale: 2 }),
    estado: estadoContratoEnum("estado").notNull().default("activo"),
    /**
     * Último recordatorio mandado y de qué período, para no avisarle dos veces
     * lo mismo a la misma persona.
     */
    recordatorioAt: timestamp("recordatorio_at", { withTimezone: true }),
    recordatorioPeriodo: text("recordatorio_periodo"),
    notas: text("notas"),
    creadoAt: timestamp("creado_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contratos_estado_idx").on(t.estado),
    index("contratos_inquilino_idx").on(t.inquilinoId),
  ],
);

/** Un pago por mes y por contrato. El período es "2026-09". */
export const pagos = pgTable(
  "pagos",
  {
    id: serial("id").primaryKey(),
    contratoId: integer("contrato_id")
      .notNull()
      .references(() => contratos.id, { onDelete: "cascade" }),
    periodo: text("periodo").notNull(),
    monto: numeric("monto", { precision: 14, scale: 2 }).notNull(),
    pagadoAt: timestamp("pagado_at", { withTimezone: true }).notNull().defaultNow(),
    registradoPor: integer("registrado_por").references(() => usuarios.id, {
      onDelete: "set null",
    }),
    notas: text("notas"),
  },
  (t) => [uniqueIndex("pagos_contrato_periodo_idx").on(t.contratoId, t.periodo)],
);

/* ────────────────────────────── índices ────────────────────────────── */

/**
 * Variación mensual del IPC (INDEC) y del ICL (BCRA), para calcular ajustes.
 *
 * Vive en la base y no en el código porque los publica un tercero todos los
 * meses: si hubiera que tocar el código para actualizar un número, en marzo
 * ya estaría desactualizado.
 */
export const indices = pgTable(
  "indices",
  {
    id: serial("id").primaryKey(),
    /** "ipc" o "icl". */
    tipo: text("tipo").notNull().default("ipc"),
    /** "2026-09" */
    mes: text("mes").notNull(),
    /** Variación porcentual del mes. 2.4 significa 2,4 %. */
    valor: numeric("valor", { precision: 8, scale: 4 }).notNull(),
    creadoAt: timestamp("creado_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("indices_tipo_mes_idx").on(t.tipo, t.mes)],
);

/* ────────────────────────────── relations ────────────────────────────── */

export const usuariosRel = relations(usuarios, ({ many }) => ({
  consultas: many(consultas),
  contactos: many(contactos),
}));

export const contactosRel = relations(contactos, ({ one, many }) => ({
  vendedor: one(usuarios, {
    fields: [contactos.vendedorId],
    references: [usuarios.id],
  }),
  consultas: many(consultas),
  busquedas: many(busquedas),
}));

export const propiedadesRel = relations(propiedades, ({ one, many }) => ({
  propietario: one(contactos, {
    fields: [propiedades.propietarioId],
    references: [contactos.id],
  }),
  consultas: many(consultas),
  visitas: many(visitas),
  autorizaciones: many(autorizaciones),
}));

export const autorizacionesRel = relations(autorizaciones, ({ one }) => ({
  propiedad: one(propiedades, {
    fields: [autorizaciones.propiedadId],
    references: [propiedades.id],
  }),
  propietario: one(contactos, {
    fields: [autorizaciones.propietarioId],
    references: [contactos.id],
  }),
}));

export const consultasRel = relations(consultas, ({ one, many }) => ({
  contacto: one(contactos, {
    fields: [consultas.contactoId],
    references: [contactos.id],
  }),
  propiedad: one(propiedades, {
    fields: [consultas.propiedadId],
    references: [propiedades.id],
  }),
  vendedor: one(usuarios, {
    fields: [consultas.asignadaA],
    references: [usuarios.id],
  }),
  actividades: many(actividades),
  visitas: many(visitas),
}));

export const actividadesRel = relations(actividades, ({ one }) => ({
  consulta: one(consultas, {
    fields: [actividades.consultaId],
    references: [consultas.id],
  }),
  usuario: one(usuarios, {
    fields: [actividades.usuarioId],
    references: [usuarios.id],
  }),
}));

export const visitasRel = relations(visitas, ({ one }) => ({
  propiedad: one(propiedades, {
    fields: [visitas.propiedadId],
    references: [propiedades.id],
  }),
  contacto: one(contactos, {
    fields: [visitas.contactoId],
    references: [contactos.id],
  }),
  vendedor: one(usuarios, {
    fields: [visitas.usuarioId],
    references: [usuarios.id],
  }),
}));

export const busquedasRel = relations(busquedas, ({ one }) => ({
  contacto: one(contactos, {
    fields: [busquedas.contactoId],
    references: [contactos.id],
  }),
}));

export const contratosRel = relations(contratos, ({ one, many }) => ({
  propiedad: one(propiedades, {
    fields: [contratos.propiedadId],
    references: [propiedades.id],
  }),
  inquilino: one(contactos, {
    fields: [contratos.inquilinoId],
    references: [contactos.id],
  }),
  propietario: one(contactos, {
    fields: [contratos.propietarioId],
    references: [contactos.id],
  }),
  pagos: many(pagos),
}));

export const pagosRel = relations(pagos, ({ one }) => ({
  contrato: one(contratos, {
    fields: [pagos.contratoId],
    references: [contratos.id],
  }),
}));

export const operacionesRel = relations(operaciones, ({ one }) => ({
  propiedad: one(propiedades, {
    fields: [operaciones.propiedadId],
    references: [propiedades.id],
  }),
  comprador: one(contactos, {
    fields: [operaciones.compradorId],
    references: [contactos.id],
  }),
}));

/* ────────────────────────────── tipos ────────────────────────────── */

export type Usuario = typeof usuarios.$inferSelect;
export type Contacto = typeof contactos.$inferSelect;
export type Propiedad = typeof propiedades.$inferSelect;
export type Autorizacion = typeof autorizaciones.$inferSelect;
export type Consulta = typeof consultas.$inferSelect;
export type Actividad = typeof actividades.$inferSelect;
export type Visita = typeof visitas.$inferSelect;
export type Busqueda = typeof busquedas.$inferSelect;
export type Operacion = typeof operaciones.$inferSelect;
export type Contrato = typeof contratos.$inferSelect;
export type Pago = typeof pagos.$inferSelect;
export type Indice = typeof indices.$inferSelect;
