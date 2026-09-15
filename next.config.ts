import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Se cargan como módulos de Node, sin pasar por webpack. PGlite en particular
  // resuelve su sistema de archivos con URLs y empaquetado se rompe.
  serverExternalPackages: ["postgres", "bcryptjs", "@electric-sql/pglite"],
};

export default nextConfig;
