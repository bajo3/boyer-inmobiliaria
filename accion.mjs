import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env={}; for(const l of readFileSync(".env","utf8").split("\n")){const i=l.indexOf("="); if(i>0&&!l.trim().startsWith("#")) env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^["']|["']$/g,"");}
const base="https://boyer-inmobiliaria.vercel.app";
const token=await new SignJWT({uid:2}).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.AUTH_SECRET));
const cookie=`boyer_sesion=${token}`;

// 1. El id de la acción sale del JS que carga la pantalla.
const html = await (await fetch(base+"/documentos",{headers:{cookie}})).text();
const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(m=>m[0]))];
let id;
for (const c of chunks) {
  const js = await (await fetch(base+c)).text();
  const m = js.match(/\("([0-9a-f]{40,})"[^()]*?"crearRecibo"\)/);
  if (m) { id = m[1]; break; }
}
console.log("acción crearRecibo:", id ? id.slice(0,12)+"…" : "NO ENCONTRADA");
if (!id) process.exit(1);

// 2. El contrato de Carla, que este mes todavía no pagó.
const sql = postgres(env.DATABASE_URL,{max:1,ssl:"require",prepare:false});
const [c] = await sql`select c.id from contratos c join contactos i on i.id=c.inquilino_id where i.nombre='Carla Domínguez' limit 1`;
const periodo = "2026-09";

async function llamar() {
  const fd = new FormData();
  fd.append("0", JSON.stringify([{}, "$K1"]));
  fd.append("1_contratoId", String(c.id));
  fd.append("1_periodo", periodo);
  fd.append("1_fecha", "2026-09-16");
  fd.append("1_monto", "365000");
  fd.append("1_notas", "prueba automática");
  const r = await fetch(base+"/documentos", { method:"POST", redirect:"manual",
    headers: { cookie, "Next-Action": id, Accept: "text/x-component" }, body: fd });
  return { status: r.status, redirige: r.headers.get("x-action-redirect"), cuerpo: (await r.text()).slice(0,300) };
}

const primera = await llamar();
console.log("1er intento →", primera.status, "redirige a:", primera.redirige);

const [pago] = await sql`select id, monto, pagado_at, notas from pagos where contrato_id=${c.id} and periodo=${periodo}`;
console.log("pago en la base:", pago ? `id ${pago.id}, monto ${pago.monto}, notas "${pago.notas}"` : "NO SE CREÓ");

if (pago) {
  const rec = await (await fetch(base+`/imprimir/recibo/${pago.id}`,{headers:{cookie}})).text();
  console.log("recibo imprimible:", rec.includes("Carla Domínguez") && rec.includes("TRESCIENTOS SESENTA Y CINCO MIL") ? "OK, con nombre e importe en letras" : "FALTA CONTENIDO");
}

const segunda = await llamar();
console.log("2º intento mismo mes →", segunda.status, segunda.cuerpo.includes("ya está cobrado") ? "rechaza el duplicado ✓" : segunda.cuerpo);

// 3. Dejar la demo como estaba: Carla vuelve a "vence en X días".
if (pago) { await sql`delete from pagos where id=${pago.id}`; console.log("pago de prueba borrado"); }
await sql.end();
