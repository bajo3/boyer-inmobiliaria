CREATE TABLE "indices" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text DEFAULT 'ipc' NOT NULL,
	"mes" text NOT NULL,
	"valor" numeric(8, 4) NOT NULL,
	"creado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "indices_tipo_mes_idx" ON "indices" USING btree ("tipo","mes");