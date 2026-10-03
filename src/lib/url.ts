// Antepone la ruta base del sitio (p. ej. /portfolio en GitHub Pages) a las rutas internas.
// Las URLs externas (http…) y vacías se devuelven tal cual.
export const url = (path: string) => {
  if (!path || /^https?:\/\//.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base + (path.startsWith('/') ? path : `/${path}`);
};
