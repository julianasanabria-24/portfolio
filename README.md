# Portfolio

Sitio hecho con [Astro](https://astro.build). One-page + casos de estudio en `/work/[proyecto]`.

## Comandos

```bash
npm install      # una sola vez
npm run dev      # servidor local en http://localhost:4321
npm run build    # genera el sitio estático en dist/
npm run preview  # previsualiza la build
```

## Dónde editar el contenido

Todo el contenido vive en dos archivos JSON. Los componentes los leen y renderizan la página.

| Archivo | Qué contiene |
|---|---|
| `src/data/info.json` | Nombre, rol, frase, email, redes, foto, audio, endpoint del formulario, "Sobre mí", skills, testimonios y experimentos del Playground |
| `src/data/projects.json` | Categorías de los filtros y la lista de proyectos con sus diapositivas |
| `src/styles/global.css` | Colores y tipografías (bloque `:root`) |

> JSON no admite comentarios: usa comillas dobles y cuida las comas (ninguna después del último elemento). Si algo falla, la terminal de `npm run dev` indica la línea.

### Añadir un proyecto
Copia un bloque `{ ... }` dentro de `"projects"` en `projects.json` y cambia sus valores:
- `slug`: la URL (`/work/<slug>`), sin espacios ni tildes.
- `categories`: deben coincidir con las de `"categories"` para que funcionen los filtros.
- `featured`: `true` para que aparezca también en el carrusel de destacados.
- `image`: portada, p. ej. `"/work/<slug>/portada.webp"` (déjalo `""` para la portada de color).
- `slides`: las diapositivas del caso de estudio; cada una puede tener su `image`.

### Imágenes
- Proyectos: guárdalas en `public/work/<slug>/`.
- Foto personal: guárdala en `public/me.webp` y pon `"photo": "/me.webp"` en `info.json`.
- Usa WebP/AVIF, máx. ~1600 px de ancho.

### Audio del hero
Coloca la canción en `public/audio/trayectoria.mp3` (o cambia `audio.src` en `info.json`). Si no existe, el reproductor muestra "Muy pronto".

### Formularios
Crea un formulario gratuito en [Formspree](https://formspree.io) y pega la URL en `formEndpoint` (`info.json`).
Mientras esté vacío, el formulario de contacto abre el cliente de correo.

## Despliegue
Netlify o Vercel: conecta el repositorio, comando `npm run build`, carpeta `dist`.
