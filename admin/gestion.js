// Panel de gestión del portfolio: edita src/data/info.json y src/data/projects.json.
// Con Chrome/Edge guarda directamente en los archivos (File System Access API).
// En otros navegadores permite subir los JSON y descargarlos ya editados.

(() => {
  'use strict';

  const FILES = ['info', 'projects'];

  const state = {
    data: { info: null, projects: null },
    handles: { info: null, projects: null }, // FileSystemFileHandle o null (modo subir/descargar)
    dirty: { info: false, projects: false },
    tab: 'info',
    current: 0, // proyecto seleccionado
  };

  // Plantillas para elementos nuevos de cada lista
  const TEMPLATES = {
    socials: () => ({ label: '', url: 'https://' }),
    body: () => '',
    testimonials: () => ({ quote: '', author: '', role: '' }),
    playground: () => ({ title: 'Nuevo experimento', tag: '', color: '#FFDA3F' }),
    slides: () => ({ kicker: '', title: '', text: '', image: '' }),
  };

  const newProject = () => ({
    slug: `proyecto-${Date.now().toString(36)}`,
    title: 'Nuevo proyecto',
    summary: '',
    year: String(new Date().getFullYear()),
    categories: [],
    featured: false,
    color: '#FFDA3F',
    image: '',
    result: '',
    slides: [TEMPLATES.slides()],
  });

  // ===== Utilidades =====
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const keys = (path) => path.split('.').map((k) => (/^\d+$/.test(k) ? Number(k) : k));
  const getPath = (obj, path) => (path === '' ? obj : keys(path).reduce((o, k) => (o == null ? o : o[k]), obj));
  const setPath = (obj, path, value) => {
    const ks = keys(path);
    const last = ks.pop();
    getPath(obj, ks.join('.'))[last] = value;
  };
  const join = (...parts) => parts.filter((p) => p !== '' && p != null).join('.');

  const slugify = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const toHex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#ffffff');

  let toastTimer;
  function toast(msg, isError = false) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.append(el);
    }
    el.textContent = msg;
    el.classList.toggle('error', isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3000);
  }

  // ===== Componentes de formulario (devuelven HTML) =====
  // Cada input lleva data-root (info|projects) y data-path para saber qué dato modifica.

  function input(root, path, label, { type = 'text', hint = '', full = false, placeholder = '' } = {}) {
    const value = getPath(state.data[root], path);
    const attrs = `data-root="${root}" data-path="${esc(path)}"`;
    let control;
    if (type === 'textarea') {
      control = `<textarea ${attrs} rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
    } else if (type === 'color') {
      control = `<span class="color-row">
          <input type="color" ${attrs} data-sync="color" value="${esc(toHex(value))}" aria-label="${esc(label)}">
          <input type="text" ${attrs} value="${esc(value)}" placeholder="#FFDA3F">
        </span>`;
    } else {
      control = `<input type="${type}" ${attrs} value="${esc(value)}" placeholder="${esc(placeholder)}">`;
    }
    return `<label class="f${full ? ' full' : ''}">${esc(label)}${hint ? ` <small>${esc(hint)}</small>` : ''}${control}</label>`;
  }

  function checkbox(root, path, label) {
    const checked = getPath(state.data[root], path) ? 'checked' : '';
    return `<label class="check"><input type="checkbox" data-root="${root}" data-path="${esc(path)}" ${checked}> ${esc(label)}</label>`;
  }

  function tagsEditor(root, path, placeholder = 'Escribe y pulsa Enter') {
    const list = getPath(state.data[root], path) || [];
    return `<div class="tags">
        ${list
          .map(
            (t, i) =>
              `<span class="tag">${esc(t)}<button type="button" data-action="tag-remove" data-root="${root}" data-path="${esc(path)}" data-index="${i}" aria-label="Quitar ${esc(t)}">×</button></span>`,
          )
          .join('')}
        <input type="text" data-tag-add data-root="${root}" data-path="${esc(path)}" placeholder="${esc(placeholder)}" aria-label="Añadir etiqueta">
      </div>`;
  }

  // Botones de mover / eliminar para un elemento de lista
  function itemControls(root, path, i, length, what = 'elemento') {
    const a = `data-root="${root}" data-path="${esc(path)}" data-index="${i}"`;
    return `
      <button type="button" class="icon" data-action="up" ${a} ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
      <button type="button" class="icon" data-action="down" ${a} ${i === length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
      <button type="button" class="icon btn-danger" data-action="remove" data-what="${esc(what)}" ${a} aria-label="Eliminar">✕</button>`;
  }

  // Lista editable genérica. renderItem(itemPath, item, i) devuelve el HTML de los campos.
  function listEditor(root, path, { tpl, addLabel, title, renderItem, what }) {
    const list = getPath(state.data[root], path) || [];
    const items = list
      .map((item, i) => {
        const itemPath = join(path, i);
        return `<div class="item">
          <div class="item-head"><strong>${esc(title(item, i))}</strong>${itemControls(root, path, i, list.length, what)}</div>
          ${renderItem(itemPath, item, i)}
        </div>`;
      })
      .join('');
    return `${items || '<p class="muted">Todavía no hay elementos.</p>'}
      <button type="button" class="btn btn-small add" data-action="add" data-root="${root}" data-path="${esc(path)}" data-tpl="${tpl}">+ ${esc(addLabel)}</button>`;
  }

  // ===== Vista: Mi información =====
  function renderInfo() {
    const r = 'info';
    return `
      <fieldset>
        <legend>Datos personales</legend>
        <div class="grid">
          ${input(r, 'name', 'Nombre')}
          ${input(r, 'role', 'Rol', { placeholder: 'Diseñadora digital' })}
          ${input(r, 'location', 'Ciudad')}
          ${input(r, 'email', 'Email', { type: 'email' })}
          ${input(r, 'tagline', 'Frase de presentación', { type: 'textarea', full: true })}
          ${input(r, 'photo', 'Foto', { hint: 'ruta en public/, p. ej. /me.webp (vacío = recuadro)', placeholder: '/me.webp' })}
          ${input(r, 'formEndpoint', 'Endpoint del formulario', { hint: 'URL de Formspree (vacío = abre el correo)', placeholder: 'https://formspree.io/f/…' })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Audio del hero</legend>
        <div class="grid">
          ${input(r, 'audio.src', 'Archivo', { hint: 'ruta en public/', placeholder: '/audio/trayectoria.mp3' })}
          ${input(r, 'audio.title', 'Título')}
        </div>
      </fieldset>

      <fieldset>
        <legend>Redes sociales</legend>
        ${listEditor(r, 'socials', {
          tpl: 'socials',
          addLabel: 'Añadir red',
          what: 'esta red',
          title: (s) => s.label || 'Nueva red',
          renderItem: (p) => `<div class="grid">${input(r, join(p, 'label'), 'Nombre')}${input(r, join(p, 'url'), 'URL', { type: 'url' })}</div>`,
        })}
      </fieldset>

      <fieldset>
        <legend>Sobre mí</legend>
        <div class="grid">${input(r, 'about.intro', 'Introducción (titular)', { type: 'textarea', full: true })}</div>
        <p class="hint">Párrafos:</p>
        ${listEditor(r, 'about.body', {
          tpl: 'body',
          addLabel: 'Añadir párrafo',
          what: 'este párrafo',
          title: (_, i) => `Párrafo ${i + 1}`,
          renderItem: (p) => `<textarea data-root="${r}" data-path="${esc(p)}" rows="3">${esc(getPath(state.data[r], p))}</textarea>`,
        })}
      </fieldset>

      <fieldset>
        <legend>Skills</legend>
        <p class="hint">Lo que hago (aparecen como stickers de colores):</p>
        ${tagsEditor(r, 'about.skills.design')}
        <p class="hint">Cómo trabajo:</p>
        ${tagsEditor(r, 'about.skills.soft')}
      </fieldset>

      <fieldset>
        <legend>Testimonios</legend>
        ${listEditor(r, 'testimonials', {
          tpl: 'testimonials',
          addLabel: 'Añadir testimonio',
          what: 'este testimonio',
          title: (t) => t.author || 'Nuevo testimonio',
          renderItem: (p) => `<div class="grid">
              ${input(r, join(p, 'quote'), 'Cita', { type: 'textarea', full: true })}
              ${input(r, join(p, 'author'), 'Autor/a')}
              ${input(r, join(p, 'role'), 'Cargo o relación')}
            </div>`,
        })}
      </fieldset>

      <fieldset>
        <legend>Playground</legend>
        ${listEditor(r, 'playground', {
          tpl: 'playground',
          addLabel: 'Añadir experimento',
          what: 'este experimento',
          title: (x) => x.title || 'Nuevo experimento',
          renderItem: (p) => `<div class="grid">
              ${input(r, join(p, 'title'), 'Título')}
              ${input(r, join(p, 'tag'), 'Etiqueta')}
              ${input(r, join(p, 'color'), 'Color', { type: 'color' })}
            </div>`,
        })}
      </fieldset>`;
  }

  // ===== Vista: Proyectos =====
  function renderProjects() {
    const r = 'projects';
    const { projects, categories } = state.data.projects;
    state.current = Math.min(state.current, Math.max(0, projects.length - 1));

    const list = projects
      .map(
        (p, i) => `<li><button type="button" data-select="${i}" aria-current="${i === state.current}">
          <span class="swatch" style="background:${esc(p.color)}"></span>
          <span class="name">${esc(p.title || '(sin título)')}</span>
          ${p.featured ? '<span class="star" title="Destacado">★</span>' : ''}
        </button></li>`,
      )
      .join('');

    const p = projects[state.current];
    const base = `projects.${state.current}`;
    const editor = !p
      ? '<p class="muted">No hay proyectos. Crea el primero.</p>'
      : `
        <div class="editor-head">
          <h2>${esc(p.title || '(sin título)')}</h2>
          <a class="btn btn-small" href="http://localhost:4321/work/${esc(p.slug)}/" target="_blank" rel="noopener">Ver ↗</a>
          <button type="button" class="btn btn-small" data-action="duplicate">Duplicar</button>
          ${itemControls(r, 'projects', state.current, projects.length, 'este proyecto')}
        </div>

        <fieldset>
          <legend>Datos del proyecto</legend>
          <div class="grid">
            ${input(r, join(base, 'title'), 'Título')}
            <label class="f">Slug <small>URL: /work/slug</small>
              <span class="color-row">
                <input type="text" data-root="${r}" data-path="${base}.slug" value="${esc(p.slug)}">
                <button type="button" class="icon" data-action="slugify" title="Generar desde el título" aria-label="Generar slug desde el título">↻</button>
              </span>
            </label>
            ${input(r, join(base, 'year'), 'Año')}
            ${input(r, join(base, 'color'), 'Color de portada', { type: 'color' })}
            ${input(r, join(base, 'summary'), 'Resumen', { type: 'textarea', full: true })}
            ${input(r, join(base, 'result'), 'Resultado medible', { full: true, placeholder: '+40% de …' })}
            ${input(r, join(base, 'image'), 'Imagen de portada', { full: true, hint: 'ruta en public/ (vacío = portada de color)', placeholder: `/work/${p.slug}/portada.webp` })}
            <div class="full">${checkbox(r, join(base, 'featured'), 'Destacado (aparece en el carrusel de trabajos destacados)')}</div>
            <div class="full">
              <p class="hint">Categorías (filtros del portafolio):</p>
              <div class="checks">
                ${categories
                  .map(
                    (c) => `<label><input type="checkbox" data-cat="${esc(c)}" ${p.categories.includes(c) ? 'checked' : ''}> ${esc(c)}</label>`,
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Diapositivas del caso de estudio</legend>
          ${listEditor(r, join(base, 'slides'), {
            tpl: 'slides',
            addLabel: 'Añadir diapositiva',
            what: 'esta diapositiva',
            title: (s, i) => `${i + 1}. ${s.kicker || ''}${s.title ? ' — ' + s.title : ''}`,
            renderItem: (sp) => `<div class="grid">
                ${input(r, join(sp, 'kicker'), 'Etiqueta', { placeholder: 'El reto / Proceso / Resultado' })}
                ${input(r, join(sp, 'title'), 'Título')}
                ${input(r, join(sp, 'text'), 'Texto', { type: 'textarea', full: true })}
                ${input(r, join(sp, 'image'), 'Imagen', { full: true, hint: 'ruta en public/ (vacío = recuadro)' })}
              </div>`,
          })}
        </fieldset>`;

    return `
      <fieldset>
        <legend>Categorías de los filtros</legend>
        ${tagsEditor(r, 'categories', 'Nueva categoría y Enter')}
      </fieldset>
      <div class="projects-layout">
        <aside class="plist">
          <ol>${list}</ol>
          <button type="button" class="btn btn-small add" data-action="new-project">+ Nuevo proyecto</button>
        </aside>
        <section>${editor}</section>
      </div>`;
  }

  // ===== Render =====
  function render() {
    const view = $('#view');
    const scroll = window.scrollY;
    view.innerHTML = state.tab === 'info' ? renderInfo() : renderProjects();
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === state.tab)));
    window.scrollTo(0, scroll);
    updateStatus();
  }

  function updateStatus() {
    const dirtyFiles = FILES.filter((f) => state.dirty[f]);
    const status = $('#status');
    const errors = validate();
    const box = $('#errors');

    box.hidden = errors.length === 0;
    box.innerHTML = errors.length
      ? `<strong>Corrige esto antes de guardar:</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
      : '';

    if (dirtyFiles.length) {
      status.textContent = `● Cambios sin guardar en ${dirtyFiles.map((f) => f + '.json').join(' y ')}`;
      status.classList.add('dirty');
    } else {
      status.textContent = state.handles.info ? '✓ Todo guardado' : '✓ Sin cambios';
      status.classList.remove('dirty');
    }
    $('#save').disabled = dirtyFiles.length === 0 || errors.length > 0;
  }

  function markDirty(root) {
    state.dirty[root] = true;
    updateStatus();
  }

  // ===== Validación =====
  function validate() {
    const errs = [];
    const info = state.data.info;
    const pj = state.data.projects;
    if (!info || !pj) return errs;

    if (!String(info.name || '').trim()) errs.push('Mi información: el nombre está vacío.');
    if (info.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) errs.push('Mi información: el email no es válido.');

    const seen = new Set();
    pj.projects.forEach((p, i) => {
      const name = p.title || `Proyecto ${i + 1}`;
      if (!String(p.title || '').trim()) errs.push(`Proyecto ${i + 1}: el título está vacío.`);
      if (!p.slug) errs.push(`${name}: el slug está vacío.`);
      else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug))
        errs.push(`${name}: el slug "${p.slug}" solo puede tener minúsculas, números y guiones (usa ↻).`);
      else if (seen.has(p.slug)) errs.push(`${name}: el slug "${p.slug}" está repetido.`);
      seen.add(p.slug);
      if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(p.color || '')) errs.push(`${name}: el color debe tener formato #RRGGBB.`);
      p.categories
        .filter((c) => !pj.categories.includes(c))
        .forEach((c) => errs.push(`${name}: usa la categoría "${c}", que ya no existe.`));
    });
    info.playground?.forEach((x, i) => {
      if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(x.color || '')) errs.push(`Playground ${i + 1}: el color debe tener formato #RRGGBB.`);
    });
    return errs;
  }

  // ===== Eventos de edición =====
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.path || !el.dataset.root || el.dataset.tagAdd !== undefined) return;
    const { root, path } = el.dataset;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    setPath(state.data[root], path, value);

    // Mantiene sincronizados el selector de color y su campo de texto
    if (path.endsWith('color')) {
      el.closest('.color-row')
        ?.querySelectorAll('input')
        .forEach((o) => {
          if (o === el) return;
          if (o.type === 'color') o.value = toHex(value);
          else o.value = value;
        });
    }
    markDirty(root);

    // Actualiza en vivo la lista lateral de proyectos
    if (root === 'projects' && /^projects\.\d+\.(title|color|featured)$/.test(path)) {
      const i = Number(path.split('.')[1]);
      const btn = $(`[data-select="${i}"]`);
      const p = state.data.projects.projects[i];
      if (btn) {
        btn.querySelector('.name').textContent = p.title || '(sin título)';
        btn.querySelector('.swatch').style.background = p.color;
        const star = btn.querySelector('.star');
        if (p.featured && !star) btn.insertAdjacentHTML('beforeend', '<span class="star" title="Destacado">★</span>');
        if (!p.featured && star) star.remove();
      }
      if (path.endsWith('title')) $('.editor-head h2').textContent = p.title || '(sin título)';
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    // Casillas de categorías del proyecto
    if (el.dataset.cat !== undefined) {
      const p = state.data.projects.projects[state.current];
      const checked = [...document.querySelectorAll('[data-cat]')].filter((c) => c.checked).map((c) => c.dataset.cat);
      p.categories = checked;
      markDirty('projects');
    }
  });

  // Añadir etiqueta con Enter
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (el.dataset?.tagAdd !== undefined && e.key === 'Enter') {
      e.preventDefault();
      const value = el.value.trim();
      if (!value) return;
      const list = getPath(state.data[el.dataset.root], el.dataset.path);
      if (list.includes(value)) return toast(`"${value}" ya existe`, true);
      list.push(value);
      markDirty(el.dataset.root);
      render();
      $(`[data-tag-add][data-path="${el.dataset.path}"]`)?.focus();
    }
    // Ctrl/Cmd + S para guardar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!$('#save').disabled) save();
    }
  });

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      state.tab = tab.dataset.tab;
      render();
      return;
    }

    const sel = e.target.closest('[data-select]');
    if (sel) {
      state.current = Number(sel.dataset.select);
      render();
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, root, path } = btn.dataset;
    const i = Number(btn.dataset.index);
    const list = root ? getPath(state.data[root], path) : null;
    const isProjects = root === 'projects' && path === 'projects';

    switch (action) {
      case 'add':
        list.push(TEMPLATES[btn.dataset.tpl]());
        markDirty(root);
        break;
      case 'remove':
        if (!confirm(`¿Eliminar ${btn.dataset.what || 'este elemento'}?`)) return;
        list.splice(i, 1);
        if (isProjects) state.current = Math.max(0, i - 1);
        markDirty(root);
        break;
      case 'up':
      case 'down': {
        const j = action === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        if (isProjects) state.current = j;
        markDirty(root);
        break;
      }
      case 'tag-remove': {
        const tag = list[i];
        list.splice(i, 1);
        // Si se elimina una categoría, quítala también de los proyectos
        if (root === 'projects' && path === 'categories') {
          state.data.projects.projects.forEach((p) => (p.categories = p.categories.filter((c) => c !== tag)));
        }
        markDirty(root);
        break;
      }
      case 'new-project': {
        const p = newProject();
        state.data.projects.projects.push(p);
        state.current = state.data.projects.projects.length - 1;
        markDirty('projects');
        break;
      }
      case 'duplicate': {
        const copy = structuredClone(state.data.projects.projects[state.current]);
        copy.title += ' (copia)';
        copy.slug = `${copy.slug}-copia`;
        state.data.projects.projects.splice(state.current + 1, 0, copy);
        state.current += 1;
        markDirty('projects');
        break;
      }
      case 'slugify': {
        const p = state.data.projects.projects[state.current];
        p.slug = slugify(p.title);
        markDirty('projects');
        break;
      }
      default:
        return;
    }
    render();
  });

  // ===== Abrir archivos =====
  const hasFS = 'showDirectoryPicker' in window;
  if (!hasFS) {
    $('#open-dir').hidden = true;
    $('#fs-msg').innerHTML =
      'Tu navegador no permite guardar directamente en archivos. Usa <strong>Chrome o Edge</strong> para hacerlo, o sube los dos JSON y descárgalos al terminar.';
  }

  function start() {
    $('#welcome').hidden = true;
    $('#app').hidden = false;
    FILES.forEach((f) => (state.dirty[f] = false));
    render();
  }

  function checkShape(name, data) {
    if (name === 'info' && typeof data.name !== 'string') throw new Error('info.json no tiene el formato esperado.');
    if (name === 'projects' && !Array.isArray(data.projects)) throw new Error('projects.json no tiene el formato esperado.');
  }

  $('#open-dir').addEventListener('click', async () => {
    let dir;
    try {
      dir = await window.showDirectoryPicker({ id: 'portfolio-data', mode: 'readwrite' });
    } catch {
      return; // el usuario canceló
    }
    try {
      for (const name of FILES) {
        let handle;
        try {
          handle = await dir.getFileHandle(`${name}.json`);
        } catch {
          throw new Error(`No encuentro ${name}.json en la carpeta "${dir.name}". Selecciona la carpeta src/data.`);
        }
        const data = JSON.parse(await (await handle.getFile()).text());
        checkShape(name, data);
        state.data[name] = data;
        state.handles[name] = handle;
      }
      start();
      toast(`Carpeta "${dir.name}" abierta`);
    } catch (err) {
      toast(err.message, true);
    }
  });

  $('#file-input').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    try {
      for (const file of files) {
        const name = file.name.replace(/\.json$/i, '');
        if (!FILES.includes(name)) throw new Error(`"${file.name}" no es info.json ni projects.json.`);
        const data = JSON.parse(await file.text());
        checkShape(name, data);
        state.data[name] = data;
        state.handles[name] = null;
      }
      const missing = FILES.filter((f) => !state.data[f]);
      if (missing.length) throw new Error(`Falta ${missing.map((m) => m + '.json').join(' y ')}. Selecciona los dos archivos.`);
      start();
    } catch (err) {
      toast(err instanceof SyntaxError ? 'Uno de los archivos no es un JSON válido.' : err.message, true);
    }
    e.target.value = '';
  });

  // ===== Guardar =====
  async function save() {
    if (validate().length) return toast('Hay errores por corregir', true);
    const toSave = FILES.filter((f) => state.dirty[f]);
    try {
      for (const name of toSave) {
        const text = JSON.stringify(state.data[name], null, 2) + '\n';
        const handle = state.handles[name];
        if (handle) {
          const w = await handle.createWritable();
          await w.write(text);
          await w.close();
        } else {
          download(`${name}.json`, text);
        }
        state.dirty[name] = false;
      }
      updateStatus();
      toast(state.handles.info ? 'Guardado ✓ La web se actualizará sola con npm run dev' : 'Descargado ✓ Reemplaza los archivos en src/data');
    } catch (err) {
      toast(`No se pudo guardar: ${err.message}`, true);
    }
  }

  function download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('#save').addEventListener('click', save);

  window.addEventListener('beforeunload', (e) => {
    if (FILES.some((f) => state.dirty[f])) e.preventDefault();
  });
})();
