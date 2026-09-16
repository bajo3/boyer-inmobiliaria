CREATE TABLE "configuracion" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"asignacion_automatica" boolean DEFAULT false NOT NULL,
	"actualizado_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" integer
);
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "recibe_leads" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_actualizado_por_usuarios_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;