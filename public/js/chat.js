(() => {
  const style = document.createElement('style');
  style.textContent = `
    .cy-chat-btn {
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      background: linear-gradient(135deg, #5b2c98, #0e7490);
      color: #fff; border: 1px solid #22d3ee; border-radius: 999px;
      padding: 12px 18px; font-weight: 700; cursor: pointer;
      box-shadow: 0 8px 22px rgba(0,0,0,.3);
    }
    .cy-chat-box {
      position: fixed; bottom: 78px; right: 20px; width: 340px; max-width: 92vw;
      background: #161624; color: #f3f4f6; border: 1px solid #06b6d4;
      border-radius: 16px; display: none; flex-direction: column;
      overflow: hidden; z-index: 9999; box-shadow: 0 14px 32px rgba(0,0,0,.45);
    }
    .cy-chat-header {
      background: linear-gradient(90deg, #3b1d6e, #0e7490);
      padding: 12px 14px; font-weight: 700;
      display: flex; justify-content: space-between; align-items: center;
    }
    .cy-chat-chips {
      display: flex; gap: 6px; padding: 8px 10px; overflow-x: auto;
      background: #1e1e30; border-bottom: 1px solid #2d2d44;
    }
    .cy-chip {
      background: #2b2346; color: #e9d5ff; border: 1px solid #7e22ce;
      border-radius: 999px; padding: 4px 10px; font-size: 0.75rem;
      white-space: nowrap; cursor: pointer;
    }
    .cy-chat-msgs {
      padding: 12px; height: 250px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 8px; font-size: 0.88rem;
    }
    .cy-msg-bot {
      background: #242438; padding: 9px 11px; border-radius: 12px;
      border-left: 3px solid #06b6d4; white-space: pre-line; line-height: 1.4;
    }
    .cy-msg-user {
      background: #0e7490; color: #fff; padding: 9px 11px;
      border-radius: 12px; align-self: flex-end; max-width: 85%;
    }
    .cy-chat-form { display: flex; border-top: 1px solid #2e2e42; }
    .cy-chat-form input {
      flex: 1; padding: 11px; border: none; background: #10101a; color: #fff; outline: none;
    }
    .cy-chat-form button {
      background: #06b6d4; color: #0f172a; border: none; padding: 0 15px; font-weight: 700; cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  class AsistenteCompraYa {
    constructor() {
      this.catalogo = [];
    }

    async cargarCatalogo() {
      if (this.catalogo.length > 0) return this.catalogo;
      const res = await fetch('/api/productos');
      const data = await res.json();
      const lista = Array.isArray(data) ? data : data.productos || [];
      this.catalogo = lista.filter((p) => Number(p.stock) > 0);
      return this.catalogo;
    }

    extraerPresupuesto(texto) {
      const limpio = texto.replace(/\./g, '').replace(/,/g, '');
      const match = limpio.match(/\$?\s*(\d{4,9})/);
      return match ? Number(match[1]) : null;
    }

    armarCombo(presupuesto) {
      const categorias = ['Teclados', 'Mouse', 'Auriculares', 'Mousepads', 'Micrófonos', 'Monitores'];
      const elegidos = [];
      let total = 0;

      for (const cat of categorias) {
        const prod = this.catalogo.find(
          (p) => p.categoria.toLowerCase() === cat.toLowerCase() && (!presupuesto || total + Number(p.precio) <= presupuesto)
        );
        if (prod) {
          elegidos.push(prod);
          total += Number(prod.precio);
        }
        if (elegidos.length === 4) break;
      }

      if (elegidos.length === 0) {
        return 'No encontré productos dentro de ese presupuesto. Probá con un monto mayor.';
      }

      const detalle = elegidos
        .map((p) => `• [${p.categoria}] ${p.nombre}: $${Number(p.precio).toLocaleString('es-AR')}`)
        .join('\n');

      return `Te armé este combo en stock:\n${detalle}\n\nTotal estimado: $${total.toLocaleString('es-AR')}`;
    }

    async responder(consulta) {
      await this.cargarCatalogo();
      const texto = consulta.toLowerCase();
      const presupuesto = this.extraerPresupuesto(texto);

      if (texto.includes('combo') || texto.includes('setup') || texto.includes('armame')) {
        return this.armarCombo(presupuesto);
      }

      let filtrados = this.catalogo.filter((p) => {
        const porCat = texto.includes(p.categoria.toLowerCase());
        const porNombre = p.nombre.toLowerCase().split(' ').some((w) => w.length > 3 && texto.includes(w));
        const porPrecio = presupuesto ? Number(p.precio) <= presupuesto : true;
        return (porCat || porNombre) && porPrecio;
      });

      if (filtrados.length === 0 && presupuesto) {
        filtrados = this.catalogo.filter((p) => Number(p.precio) <= presupuesto);
      }
      if (filtrados.length === 0) {
        filtrados = this.catalogo.slice(0, 4);
      }

      return (
        'Opciones disponibles en stock:\n' +
        filtrados
          .slice(0, 4)
          .map((p) => `• ${p.nombre} — $${Number(p.precio).toLocaleString('es-AR')} (${p.stock} disp.)`)
          .join('\n')
      );
    }
  }

  const asistente = new AsistenteCompraYa();

  const btn = document.createElement('button');
  btn.className = 'cy-chat-btn';
  btn.textContent = 'Asistente IA';

  const box = document.createElement('div');
  box.className = 'cy-chat-box';
  box.innerHTML = `
    <div class="cy-chat-header">
      <span>Asistente CompraYa</span>
      <button type="button" id="cy-chat-close" style="background:none;border:none;color:#fff;cursor:pointer;">✕</button>
    </div>
    <div class="cy-chat-chips">
      <button type="button" class="cy-chip" data-q="Armame un combo por $250000">Combo $250.000</button>
      <button type="button" class="cy-chip" data-q="Auriculares en stock">Auriculares</button>
      <button type="button" class="cy-chip" data-q="Placas de video">Placas de video</button>
    </div>
    <div class="cy-chat-msgs" id="cy-chat-msgs"></div>
    <form class="cy-chat-form" id="cy-chat-form">
      <input type="text" id="cy-chat-input" placeholder="Pedí un combo o producto..." required />
      <button type="submit">Enviar</button>
    </form>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(box);

  const msgs = box.querySelector('#cy-chat-msgs');
  const form = box.querySelector('#cy-chat-form');
  const input = box.querySelector('#cy-chat-input');

  const agregarMensaje = (texto, clase) => {
    const div = document.createElement('div');
    div.className = clase;
    div.textContent = texto;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  };

  agregarMensaje('¡Hola! Soy el asistente de CompraYa. Consultame por productos en stock o pedime un combo por presupuesto.', 'cy-msg-bot');

  const procesar = async (q) => {
    agregarMensaje(q, 'cy-msg-user');
    try {
      const rta = await asistente.responder(q);
      agregarMensaje(rta, 'cy-msg-bot');
    } catch {
      agregarMensaje('No pude consultar el catálogo en este momento.', 'cy-msg-bot');
    }
  };

  btn.addEventListener('click', () => {
    box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
  });
  box.querySelector('#cy-chat-close').addEventListener('click', () => {
    box.style.display = 'none';
  });
  box.querySelectorAll('.cy-chip').forEach((c) => {
    c.addEventListener('click', () => procesar(c.getAttribute('data-q')));
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    procesar(q);
  });
})();
