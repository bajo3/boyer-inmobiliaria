CREATE TYPE "public"."ajuste" AS ENUM('trimestral', 'cuatrimestral', 'semestral', 'anual', 'sin_ajuste');--> statement-breakpoint
CREATE TYPE "public"."estado_contrato" AS ENUM('activo', 'finalizado', 'rescindido');--> statement-breakpoint
ALTER TYPE "public"."tipo_contacto" ADD VALUE 'inquilino' BEFORE 'ambos';--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" serial PRIMARY KEY NOT NULL,
	"propiedad_id" integer NOT NULL,
	"inquilino_id" integer NOT NULL,
	"propietario_id" integer,
	"monto" numeric(14, 2) NOT NULL,
	"moneda" "moneda" DEFAULT 'ARS' NOT NULL,
	"expensas" numeric(12, 2),
	"dia_vencimiento" integer DEFAULT 10 NOT NULL,
	"inicio" date NOT NULL,
	"fin" date NOT NULL,
	"ajuste" "ajuste" DEFAULT 'cuatrimestral' NOT NULL,
	"proximo_ajuste" date,
	"comision_pct" numeric(5, 2),
	"estado" "estado_contrato" DEFAULT 'activo' NOT NULL,
	"recordatorio_at" timestamp with time zone,
	"recordatorio_periodo" text,
	"notas" text,
	"creado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" serial PRIMARY KEY NOT NULL,
	"contrato_id" integer NOT NULL,
	"periodo" text NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"pagado_at" timestamp with time zone DEFAULT now() NOT NULL,
	"registrado_por" integer,
	"notas" text
);
--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_propiedad_id_propiedades_id_fk" FOREIGN KEY ("propiedad_id") REFERENCES "public"."propiedades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_inquilino_id_contactos_id_fk" FOREIGN KEY ("inquilino_id") REFERENCES "public"."contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_propietario_id_contactos_id_fk" FOREIGN KEY ("propietario_id") REFERENCES "public"."contactos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contratos_estado_idx" ON "contratos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "contratos_inquilino_idx" ON "contratos" USING btree ("inquilino_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pagos_contrato_periodo_idx" ON "pagos" USING btree ("contrato_id","periodo");