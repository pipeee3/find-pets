// ─────────────────────────────────────────────────────────────────────────────
// demo-api.js — "Servidor falso" para la VERSIÓN DEMO de Find Pets.
//
// Intercepta las llamadas fetch que van al backend (Railway) y las responde
// aquí mismo, guardando los datos en el localStorage del navegador.
// Así login, registro, reportes, perfil, etc. funcionan SIN backend ni MySQL.
//
// ⚠️ Solo para demostraciones: los datos viven únicamente en este navegador
// y las contraseñas NO están protegidas de verdad. No usar en producción.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
    const API_BASE = 'https://find-pets-production.up.railway.app/api';
    const KEY = 'findpets_demo_db_v3';
    const realFetch = window.fetch.bind(window);

    // ── "Hash" simple (solo demo, NO es seguro) ──────────────────────────────
    function hash(s) {
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        return 'd' + (h >>> 0).toString(36) + s.length;
    }

    // ── Base de datos en localStorage (con respaldo en memoria) ──────────────
    let memDb = null;

    function hace(dias) {
        return new Date(Date.now() - dias * 86400000).toISOString();
    }

    function seed() {
        return {
            nextUserId: 2,
            nextPetId: 2,
            usuarios: [
                { id: 1, nombre: 'Usuario Demo', email: 'demo@findpets.com', password: hash('demo123'),
                  telefono: '311 234 5678', created_at: hace(30) }
            ],
            mascotas: [
                { id: 1, nombre: 'Firulais', tipo: 'perro', raza: null,
                  descripcion: 'Se perdió y responde a su nombre. Es muy amistoso. Si lo ves, por favor escríbeme.',
                  ubicacion: 'Bogotá', estado: 'perdido', resuelto: 0, contacto: '311 234 5678',
                  foto: '../assets/images/aislado-feliz-sonriente-perro-fondo-blanco-retrato-1_1562-690.avif',
                  usuario_id: 1, created_at: hace(0) }
            ]
        };
    }

    // Reportes extra de ejemplo. Se SUMAN a los datos ya guardados en el navegador
    // (sin borrar nada) y cada uno se agrega una sola vez; si luego lo borras, no vuelve.
    function extras() {
        return [
            { id: 101, nombre: 'Luna', tipo: 'gato', raza: 'Mestizo',
              descripcion: 'Gatita juguetona y cariñosa, vacunada y esterilizada. Busca un hogar con mucho amor.',
              ubicacion: 'Usaquén, Bogotá', estado: 'adopcion', resuelto: 0, contacto: '311 234 5678',
              foto: '../assets/images/socializar_gatito-830x466.jpg', usuario_id: 1, created_at: hace(1) },
            { id: 102, nombre: null, tipo: 'perro', raza: 'Golden Retriever',
              descripcion: 'Lo encontré jugando en el parque, sin collar. Está sano y bien cuidado. Busco a su dueño.',
              ubicacion: 'Suba, Bogotá', estado: 'encontrado', resuelto: 0, contacto: '311 234 5678',
              foto: '../assets/images/feliz-golden-retriever-jugando-al-aire-libre-otono_191555-5149.avif',
              usuario_id: 1, created_at: hace(2) },
            { id: 103, nombre: 'Michi', tipo: 'gato', raza: 'Doméstico',
              descripcion: 'Gato negro de ojos verdes que se escapó por la ventana. Es muy tímido, no lo persigan.',
              ubicacion: 'Kennedy, Bogotá', estado: 'perdido', resuelto: 0, contacto: '311 234 5678',
              foto: '../assets/images/gato-sobre-mesa-fondo-oscuro_865967-52566.avif',
              usuario_id: 1, created_at: hace(3) },
            { id: 104, nombre: 'Rocky', tipo: 'perro', raza: 'Golden Retriever',
              descripcion: 'Perro joven, sociable y juguetón. Se da en adopción responsable, con seguimiento.',
              ubicacion: 'Teusaquillo, Bogotá', estado: 'adopcion', resuelto: 0, contacto: '311 234 5678',
              foto: '../assets/images/pngtree-golden-retriever-dog-happy-picture-image_2664316.jpg',
              usuario_id: 1, created_at: hace(4) }
        ];
    }

    function agregarExtras() {
        const db = memDb;
        if (!Array.isArray(db.extrasAgregados)) db.extrasAgregados = [];
        let cambio = false;
        extras().forEach(function (m) {
            if (db.extrasAgregados.indexOf(m.id) === -1) {
                db.extrasAgregados.push(m.id);
                db.mascotas.push(m);
                cambio = true;
            }
        });
        if (cambio) save();
    }

    function load() {
        if (memDb) return memDb;
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) { memDb = JSON.parse(raw); agregarExtras(); return memDb; }
        } catch (e) { /* sin localStorage: se usa memoria */ }
        memDb = seed();
        save();
        agregarExtras();
        return memDb;
    }

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(memDb)); return true; }
        catch (e) { return false; } // por ejemplo, si se llena el almacenamiento
    }

    // ── Utilidades ───────────────────────────────────────────────────────────
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function respond(status, body) {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    function getHeader(headers, name) {
        if (!headers) return null;
        if (typeof headers.get === 'function') return headers.get(name);
        for (const k in headers) if (k.toLowerCase() === name.toLowerCase()) return headers[k];
        return null;
    }

    function userIdFromRequest(options) {
        const auth = getHeader(options && options.headers, 'Authorization');
        const token = auth && auth.split(' ')[1];
        if (!token || !token.startsWith('demo.')) return null;
        const id = parseInt(token.slice(5), 10);
        return load().usuarios.some(u => u.id === id) ? id : null;
    }

    // Comprime la foto para que quepa en localStorage (máx. ~5 MB en total)
    function fileToDataUrl(file, maxSide) {
        maxSide = maxSide || 800;
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onerror = () => resolve(null);
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => resolve(reader.result);
                img.onload = () => {
                    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                    const c = document.createElement('canvas');
                    c.width = Math.round(img.width * scale);
                    c.height = Math.round(img.height * scale);
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    resolve(c.toDataURL('image/jpeg', 0.7));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function parseBody(body) {
        if (!body) return {};
        if (typeof FormData !== 'undefined' && body instanceof FormData) {
            const obj = {};
            for (const [k, v] of body.entries()) {
                if (typeof v === 'string') obj[k] = v;
                else if (v && v.size > 0) obj[k] = await fileToDataUrl(v);
            }
            return obj;
        }
        try { return JSON.parse(body); } catch (e) { return {}; }
    }

    function conDueno(m, extra) {
        const u = load().usuarios.find(x => x.id === m.usuario_id) || {};
        const out = { ...m, dueno: u.nombre || 'Anónimo', dueno_telefono: u.telefono || null };
        if (extra) out.dueno_email = u.email || null;
        return out;
    }

    // ── Rutas (mismas que el backend real) ───────────────────────────────────
    async function route(method, path, query, options) {
        const db = load();
        const body = (method === 'POST' || method === 'PUT') ? await parseBody(options && options.body) : {};
        let m;

        // REGISTRO
        if (method === 'POST' && path === '/register') {
            const { nombre, email, password, telefono } = body;
            if (!nombre || !email || !password)
                return respond(400, { error: 'Nombre, email y contraseña son obligatorios' });
            if (password.length < 6)
                return respond(400, { error: 'La contraseña debe tener al menos 6 caracteres' });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                return respond(400, { error: 'El correo electrónico no es válido' });
            const mail = email.trim().toLowerCase();
            if (db.usuarios.some(u => u.email === mail))
                return respond(400, { error: 'El email ya está registrado' });
            db.usuarios.push({
                id: db.nextUserId++, nombre: nombre.trim(), email: mail, password: hash(password),
                telefono: telefono ? String(telefono).trim() : null, created_at: new Date().toISOString()
            });
            save();
            return respond(200, { message: 'Usuario registrado correctamente' });
        }

        // LOGIN
        if (method === 'POST' && path === '/login') {
            const { email, password } = body;
            if (!email || !password)
                return respond(400, { error: 'Email y contraseña son obligatorios' });
            const u = db.usuarios.find(x => x.email === email.trim().toLowerCase());
            if (!u || u.password !== hash(password))
                return respond(400, { error: 'Credenciales incorrectas' });
            return respond(200, { token: 'demo.' + u.id, nombre: u.nombre, id: u.id });
        }

        // ESTADÍSTICAS (pública)
        if (method === 'GET' && path === '/estadisticas') {
            const p = db.mascotas;
            return respond(200, {
                total: p.length,
                perdidos: p.filter(x => x.estado === 'perdido' && !x.resuelto).length,
                encontrados: p.filter(x => x.estado === 'encontrado' && !x.resuelto).length,
                adopcion: p.filter(x => x.estado === 'adopcion' && !x.resuelto).length,
                resueltos: p.filter(x => x.resuelto).length
            });
        }

        // ÚLTIMAS MASCOTAS (pública)
        if (method === 'GET' && path === '/mascotas/ultimas') {
            const lista = db.mascotas.filter(x => !x.resuelto)
                .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
            return respond(200, lista.map(x => conDueno(x)));
        }

        // LISTAR MASCOTAS con filtros y paginación (pública)
        if (method === 'GET' && path === '/mascotas') {
            const estado = query.get('estado'), tipo = query.get('tipo');
            const resuelto = query.get('resuelto'), buscar = (query.get('buscar') || '').toLowerCase();
            const pagina = parseInt(query.get('pagina') || '1', 10);
            const limite = parseInt(query.get('limite') || '12', 10);
            let lista = db.mascotas.filter(x => {
                if (estado && x.estado !== estado) return false;
                if (tipo && x.tipo !== tipo) return false;
                if (resuelto !== null && (x.resuelto ? 'true' : 'false') !== resuelto) return false;
                if (buscar && ![x.nombre, x.descripcion, x.ubicacion, x.raza]
                    .some(c => (c || '').toLowerCase().includes(buscar))) return false;
                return true;
            }).sort((a, b) => b.created_at.localeCompare(a.created_at));
            const total = lista.length;
            lista = lista.slice((pagina - 1) * limite, pagina * limite).map(x => conDueno(x));
            return respond(200, { mascotas: lista, total, pagina, totalPaginas: Math.ceil(total / limite) });
        }

        // DETALLE DE UNA MASCOTA (pública)
        if (method === 'GET' && (m = path.match(/^\/mascotas\/(\d+)$/))) {
            const x = db.mascotas.find(p => p.id === parseInt(m[1], 10));
            if (!x) return respond(404, { error: 'Mascota no encontrada' });
            return respond(200, conDueno(x, true));
        }

        // ── Rutas que requieren sesión ──────────────────────────────────────
        const uid = userIdFromRequest(options);
        if (!uid) return respond(401, { error: 'No autorizado' });
        const yo = db.usuarios.find(u => u.id === uid);

        if (method === 'GET' && path === '/perfil') {
            const { id, nombre, email, telefono, created_at } = yo;
            return respond(200, { id, nombre, email, telefono, created_at });
        }

        if (method === 'PUT' && path === '/perfil') {
            if (!body.nombre) return respond(400, { error: 'El nombre es obligatorio' });
            yo.nombre = body.nombre.trim();
            yo.telefono = body.telefono || null;
            if (body.password && body.password.length >= 6) yo.password = hash(body.password);
            save();
            return respond(200, { message: 'Perfil actualizado' });
        }

        if (method === 'GET' && path === '/mis-mascotas') {
            const lista = db.mascotas.filter(x => x.usuario_id === uid)
                .sort((a, b) => b.created_at.localeCompare(a.created_at));
            return respond(200, lista);
        }

        if (method === 'POST' && path === '/mascotas') {
            const { nombre, tipo, raza, descripcion, ubicacion, estado, contacto, foto } = body;
            if (!tipo || !descripcion || !ubicacion)
                return respond(400, { error: 'Tipo, descripción y ubicación son obligatorios' });
            const nueva = {
                id: db.nextPetId++, nombre: nombre || null, tipo, raza: raza || null, descripcion, ubicacion,
                estado: estado || 'perdido', resuelto: 0, contacto: contacto || null, foto: foto || null,
                usuario_id: uid, created_at: new Date().toISOString()
            };
            db.mascotas.push(nueva);
            if (!save()) {
                db.mascotas.pop(); db.nextPetId--;
                return respond(500, { error: 'No hay espacio en el navegador. Prueba con una foto más pequeña.' });
            }
            return respond(200, { message: 'Reporte guardado', id: nueva.id });
        }

        if (method === 'PUT' && (m = path.match(/^\/mascotas\/(\d+)\/resuelto$/))) {
            const x = db.mascotas.find(p => p.id === parseInt(m[1], 10) && p.usuario_id === uid);
            if (!x) return respond(403, { error: 'No autorizado' });
            x.resuelto = 1; save();
            return respond(200, { message: 'Marcado como resuelto' });
        }

        if (method === 'PUT' && (m = path.match(/^\/mascotas\/(\d+)$/))) {
            const x = db.mascotas.find(p => p.id === parseInt(m[1], 10) && p.usuario_id === uid);
            if (!x) return respond(403, { error: 'No autorizado' });
            const { nombre, tipo, raza, descripcion, ubicacion, estado, contacto, foto } = body;
            if (!tipo || !descripcion || !ubicacion)
                return respond(400, { error: 'Tipo, descripción y ubicación son obligatorios' });
            const antes = { ...x };
            Object.assign(x, { nombre: nombre || null, tipo, raza: raza || null, descripcion, ubicacion,
                               estado: estado || x.estado, contacto: contacto || null, foto: foto || x.foto });
            if (!save()) {
                Object.assign(x, antes);
                return respond(500, { error: 'No hay espacio en el navegador. Prueba con una foto más pequeña.' });
            }
            return respond(200, { message: 'Reporte actualizado' });
        }

        if (method === 'DELETE' && (m = path.match(/^\/mascotas\/(\d+)$/))) {
            const i = db.mascotas.findIndex(p => p.id === parseInt(m[1], 10) && p.usuario_id === uid);
            if (i === -1) return respond(403, { error: 'No autorizado' });
            db.mascotas.splice(i, 1); save();
            return respond(200, { message: 'Eliminado correctamente' });
        }

        return respond(404, { error: 'Ruta no encontrada (demo)' });
    }

    // ── Intercepta fetch: lo que va al backend se responde aquí ──────────────
    window.fetch = async function (input, options) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (!url.startsWith(API_BASE)) return realFetch(input, options);
        await sleep(120); // pequeña pausa para que se sienta como una petición real
        try {
            const u = new URL(url);
            const path = u.pathname.replace(/^\/api/, '');
            const method = ((options && options.method) || 'GET').toUpperCase();
            return await route(method, path, u.searchParams, options || {});
        } catch (e) {
            console.error('[demo-api]', e);
            return respond(500, { error: 'Error interno en la demo' });
        }
    };

    // Para empezar de cero desde la consola del navegador: resetDemo()
    window.resetDemo = function () {
        try { localStorage.removeItem(KEY); } catch (e) { /* nada */ }
        memDb = null;
        location.reload();
    };
})();
