CREATE TYPE "public"."canal" AS ENUM('whatsapp', 'instagram', 'facebook', 'zonaprop', 'llamada', 'mostrador', 'web');--> statement-breakpoint
CREATE TYPE "public"."estado_consulta" AS ENUM('no_atendido', 'contactado', 'recontactar', 'ganado', 'rechazado');--> statement-breakpoint
CREATE TYPE "public"."estado_propiedad" AS ENUM('borrador', 'publicada', 'reservada', 'vendida', 'suspendida');--> statement-breakpoint
CREATE TYPE "public"."estado_visita" AS ENUM('agendada', 'realizada', 'cancelada', 'no_asistio');--> statement-breakpoint
CREATE TYPE "public"."etapa_operacion" AS ENUM('reserva', 'boleto', 'escritura', 'caida');--> statement-breakpoint
CREATE TYPE "public"."interes" AS ENUM('alto', 'medio', 'bajo');--> statement-breakpoint
CREATE TYPE "public"."moneda" AS ENUM('USD', 'ARS');--> statement-breakpoint
CREATE TYPE "public"."motivo_rechazo" AS ENUM('compro_en_otra', 'no_calificaba', 'nunca_respondio', 'fuera_de_zona', 'precio');--> statement-breakpoint
CREATE TYPE "public"."operacion" AS ENUM('venta', 'alquiler');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('titular', 'administrativa', 'vendedor');--> statement-breakpoint
CREATE TYPE "public"."tipo_actividad" AS ENUM('nota', 'llamada', 'whatsapp', 'email', 'visita', 'oferta', 'cambio_estado');--> statement-breakpoint
CREATE TYPE "public"."tipo_contacto" AS ENUM('comprador', 'propietario', 'ambos');--> statement-breakpoint
CREATE TYPE "public"."tipo_propiedad" AS ENUM('casa', 'departamento', 'ph', 'lote', 'campo', 'local', 'galpon', 'cochera', 'quinta');--> statement-breakpoint
CREATE TABLE "actividades" (
	"id" serial PRIMARY KEY NOT NULL,
	"consulta_id" integer NOT NULL,
	"usuario_id" integer,
	"tipo" "tipo_actividad" NOT NULL,
	"contenido" text NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autorizaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"propiedad_id" integer NOT NULL,
	"propietario_id" integer,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"exclusiva" boolean DEFAULT false NOT NULL,
	"comision_pct" numeric(5, 2),
	"precio_autorizado" numeric(14, 2),
	"precio_piso" numeric(14, 2),
	"notas_internas" text
);
--> statement-breakpoint
CREATE TABLE "busquedas" (
	"id" serial PRIMARY KEY NOT NULL,
	"contacto_id" integer NOT NULL,
	"operacion" "operacion" DEFAULT 'venta' NOT NULL,
	"tipos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"barrios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"precio_min" numeric(14, 2),
	"precio_max" numeric(14, 2),
	"moneda" "moneda" DEFAULT 'USD' NOT NULL,
	"dormitorios_min" integer,
	"cochera" boolean DEFAULT false NOT NULL,
	"apto_credito" boolean DEFAULT false NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"notas" text,
	"creado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultas" (
	"id" serial PRIMARY KEY NOT NULL,
	"contacto_id" integer NOT NULL,
	"propiedad_id" integer,
	"canal" "canal" NOT NULL,
	"mensaje_original" text,
	"estado" "estado_consulta" DEFAULT 'no_atendido' NOT NULL,
	"asignada_a" integer,
	"cargada_por" integer,
	"creada_at" timestamp with time zone DEFAULT now() NOT NULL,
	"primera_respuesta_at" timestamp with time zone,
	"proxima_accion" text,
	"proxima_accion_at" timestamp with time zone,
	"motivo_rechazo" "motivo_rechazo",
	"cerrada_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contactos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"email" text,
	"tipo" "tipo_contacto" DEFAULT 'comprador' NOT NULL,
	"origen" "canal" DEFAULT 'whatsapp' NOT NULL,
	"vendedor_id" integer,
	"notas" text,
	"creado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"propiedad_id" integer NOT NULL,
	"comprador_id" integer,
	"usuario_id" integer,
	"etapa" "etapa_operacion" DEFAULT 'reserva' NOT NULL,
	"monto_cerrado" numeric(14, 2),
	"moneda" "moneda" DEFAULT 'USD' NOT NULL,
	"senia" numeric(14, 2),
	"fecha_reserva" date,
	"fecha_boleto" date,
	"fecha_escritura" date,
	"escribania" text,
	"comision_monto" numeric(14, 2),
	"comision_cobrada" boolean DEFAULT false NOT NULL,
	"creado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propiedades" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"operacion" "operacion" DEFAULT 'venta' NOT NULL,
	"tipo" "tipo_propiedad" NOT NULL,
	"direccion" text NOT NULL,
	"barrio" text,
	"precio" numeric(14, 2),
	"moneda" "moneda" DEFAULT 'USD' NOT NULL,
	"expensas" numeric(12, 2),
	"m2_totales" integer,
	"m2_cubiertos" integer,
	"ambientes" integer,
	"dormitorios" integer,
	"banos" integer,
	"cocheras" integer,
	"estado" "estado_propiedad" DEFAULT 'publicada' NOT NULL,
	"descripcion" text,
	"propietario_id" integer,
	"publicada_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fotos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"destacada" boolean DEFAULT false NOT NULL,
	"creado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol" DEFAULT 'vendedor' NOT NULL,
	"telefono" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visitas" (
	"id" serial PRIMARY KEY NOT NULL,
	"propiedad_id" integer NOT NULL,
	"contacto_id" integer NOT NULL,
	"consulta_id" integer,
	"usuario_id" integer,
	"fecha_hora" timestamp with time zone NOT NULL,
	"estado" "estado_visita" DEFAULT 'agendada' NOT NULL,
	"feedback" text,
	"interes" "interes"
);
--> statement-breakpoint
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_consulta_id_consultas_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autorizaciones" ADD CONSTRAINT "autorizaciones_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autorizaciones" ADD CONSTRAINT "autorizaciones_propietario_id_contactos_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "busquedas" ADD CONSTRAINT "busquedas_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_asignada_a_usuarios_id_fk" FOREIGN KEY ("asignada_a") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_cargada_por_usuarios_id_fk" FOREIGN KEY ("cargada_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_vendedor_id_usuarios_id_fk" FOREIGN KEY ("vendedor_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operaciones" ADD CONSTRAINT "operaciones_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operaciones" ADD CONSTRAINT "operaciones_comprador_id_contactos_id_fk" FOREIGN KEY ("comprador_id") REFERENCES "public"."contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operaciones" ADD CONSTRAINT "operaciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_propietario_id_contactos_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_contacto_id_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_consulta_id_consultas_id_fk" FOREIGN KEY ("consulta_id") REFERENCES "public"."consultas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actividades_consulta_idx" ON "actividades" USING btree ("consulta_id");--> statement-breakpoint
CREATE INDEX "autorizaciones_hasta_idx" ON "autorizaciones" USING btree ("hasta");--> statement-breakpoint
CREATE INDEX "consultas_estado_idx" ON "consultas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "consultas_asignada_idx" ON "consultas" USING btree ("asignada_a");--> statement-breakpoint
CREATE INDEX "consultas_creada_idx" ON "consultas" USING btree ("creada_at");--> statement-breakpoint
CREATE INDEX "consultas_propiedad_idx" ON "consultas" USING btree ("propiedad_id");--> statement-breakpoint
CREATE INDEX "contactos_telefono_idx" ON "contactos" USING btree ("telefono");--> statement-breakpoint
CREATE INDEX "contactos_nombre_idx" ON "contactos" USING btree ("nombre");--> statement-breakpoint
CREATE UNIQUE INDEX "propiedades_codigo_idx" ON "propiedades" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "propiedades_estado_idx" ON "propiedades" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "propiedades_barrio_idx" ON "propiedades" USING btree ("barrio");--> statement-breakpoint
CREATE INDEX "visitas_fecha_idx" ON "visitas" USING btree ("fecha_hora");