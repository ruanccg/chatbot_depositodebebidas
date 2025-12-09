/**
 * Chatbot WhatsApp - Depósito de Bebidas (modo atacado)
 * - Em português
 * - Produtos inclusos do cardápio (convertidos para atacado)
 * - Mínimo por item: 6 (configurável)
 * - Persistência em CSV simples para pedidos e usuários
 * - Comando LGPD: apagar_meus_dados -> marca 'removido' no CSV de usuários/pedidos
 *
 * Para rodar:
 * 1) npm install
 * 2) npm start
 *
 * Observações:
 * - Este é um MVP simples: armazenamento em CSV básico. Para produção, usar banco de dados.
 * - Apagar do CSV fisicamente é mais complexo; aqui fazemos marcação "removido".
 */

const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const moment = require('moment-timezone');
const { parse } = require('csv-parse/sync');
const stringify = require('csv-stringify/lib/sync');

moment.tz.setDefault('America/Fortaleza');

// ---------- Configurações ----------
const MINIMO_POR_ITEM = 6; // mínimo de atacado por item
const ARQ_PEDIDOS = path.resolve(__dirname, 'pedidos.csv');
const ARQ_USUARIOS = path.resolve(__dirname, 'usuarios.csv');
const SESSIONS_FILE = path.resolve(__dirname, 'sessions.json');
const LAST_ID_FILE = path.resolve(__dirname, 'last_id.txt');

const CATALOG_CATEGORIES = [
  { id: 1, key: 'whiskies', nome: 'Whiskies 🥃' },
  { id: 2, key: 'espumantes', nome: 'Espumantes & Champagnes 🍾' },
  { id: 3, key: 'vinhos', nome: 'Vinhos 🍷' },
  { id: 4, key: 'destilados', nome: 'Destilados / Licor 🥃' },
  { id: 5, key: 'rtd', nome: 'Prontos para Beber (RTD) 🍹' },
  { id: 6, key: 'cervejas_long', nome: 'Cervejas Long Neck' },
  { id: 7, key: 'cervejas', nome: 'Cervejas (lata/garrafa) 🍺' },
  { id: 8, key: 'refrigerantes', nome: 'Refrigerantes 🥤' },
  { id: 9, key: 'energeticos', nome: 'Energéticos ⚡' },
  { id: 10, key: 'gelo', nome: 'Gelo ❄️' }
];

// ---------- Produtos - atacado (preços já informados) ----------
const PRODUTOS = {
  whiskies: [
    { codigo: 'W001', nome: 'Old Parr 12 anos 1L', preco: 150.00, estoque: 20 },
    { codigo: 'W002', nome: 'Johnnie Walker Red Label 1L', preco: 110.00, estoque: 30 },
    { codigo: 'W003', nome: 'Johnnie Walker Black Label', preco: 180.00, estoque: 15 },
    { codigo: 'W004', nome: "Ballantine's Finest", preco: 95.00, estoque: 40 },
    { codigo: 'W005', nome: 'Chivas Regal 12 anos', preco: 160.00, estoque: 10 }
  ],
  espumantes: [
    { codigo: 'E001', nome: 'Chandon Brut', preco: 95.00, estoque: 25 },
    { codigo: 'E002', nome: 'Chandon Rosé', preco: 110.00, estoque: 18 },
    { codigo: 'E003', nome: 'Salton Prosecco', preco: 40.00, estoque: 50 },
    { codigo: 'E004', nome: 'Salton Brut', preco: 35.00, estoque: 60 },
    { codigo: 'E005', nome: 'Mumm Cordon Rouge', preco: 140.00, estoque: 12 }
  ],
  vinhos: [
    { codigo: 'V001', nome: 'Vinho Tinto Chileno Reservado', preco: 35.00, estoque: 60 },
    { codigo: 'V002', nome: 'Vinho Argentino Malbec', preco: 45.00, estoque: 50 },
    { codigo: 'V003', nome: 'Vinho Português Periquita', preco: 40.00, estoque: 40 },
    { codigo: 'V004', nome: 'Vinho Verde Português', preco: 35.00, estoque: 45 }
  ],
  destilados: [
    { codigo: 'D001', nome: 'Campari 900ml', preco: 45.00, estoque: 30 },
    { codigo: 'D002', nome: 'Jurupinga', preco: 22.00, estoque: 30 },
    { codigo: 'D003', nome: 'Contini 900ml', preco: 43.00, estoque: 25 },
    { codigo: 'D004', nome: 'Vodka Smirnoff 1L', preco: 40.00, estoque: 50 },
    { codigo: 'D005', nome: 'Vodka Absolut 1L', preco: 90.00, estoque: 15 },
    { codigo: 'D006', nome: 'Vodka Cîroc 750ml', preco: 180.00, estoque: 8 }
  ],
  rtd: [
    { codigo: 'RDT01', nome: 'Smirnoff Ice', preco: 7.00, estoque: 200 },
    { codigo: 'RDT02', nome: 'Beats Senses', preco: 8.00, estoque: 150 },
    { codigo: 'RDT03', nome: 'Beats Pink', preco: 8.00, estoque: 150 },
    { codigo: 'RDT04', nome: 'Gin Tônica Lata', preco: 9.00, estoque: 120 }
  ],
  cervejas_long: [
    { codigo: 'CL001', nome: 'Budweiser 330ml', preco: 6.00, estoque: 200 },
    { codigo: 'CL002', nome: 'Heineken 330ml', preco: 7.00, estoque: 150 },
    { codigo: 'CL003', nome: 'Stella Artois 275ml', preco: 8.00, estoque: 120 },
    { codigo: 'CL004', nome: 'Spaten 330ml', preco: 6.50, estoque: 80 },
    { codigo: 'CL005', nome: 'Eisenbahn Pilsen', preco: 7.50, estoque: 90 }
  ],
  cervejas: [
    { codigo: 'C001', nome: 'Skol Lata 350ml', preco: 4.50, estoque: 300 },
    { codigo: 'C002', nome: 'Brahma Lata 350ml', preco: 4.50, estoque: 300 },
    { codigo: 'C003', nome: 'Itaipava Lata 350ml', preco: 4.00, estoque: 300 },
    { codigo: 'C004', nome: 'Heineken Lata 350ml', preco: 6.50, estoque: 150 },
    { codigo: 'C005', nome: 'Heineken Garrafa 600ml', preco: 10.00, estoque: 80 }
  ],
  refrigerantes: [
    { codigo: 'RF001', nome: 'Coca-Cola Lata', preco: 5.00, estoque: 200 },
    { codigo: 'RF002', nome: 'Coca-Cola 1L', preco: 7.50, estoque: 150 },
    { codigo: 'RF003', nome: 'Coca-Cola 2L', preco: 10.00, estoque: 100 },
    { codigo: 'RF004', nome: 'Guaraná Lata', preco: 4.50, estoque: 200 },
    { codigo: 'RF005', nome: 'Sprite Lata', preco: 4.50, estoque: 200 }
  ],
  energeticos: [
    { codigo: 'EN001', nome: 'Red Bull 250ml', preco: 10.00, estoque: 120 },
    { codigo: 'EN002', nome: 'Red Bull Tropical', preco: 12.00, estoque: 80 },
    { codigo: 'EN003', nome: 'Monster Tradicional', preco: 9.00, estoque: 100 },
    { codigo: 'EN004', nome: 'Monster Mango Loco', preco: 9.00, estoque: 100 }
  ],
  gelo: [
    { codigo: 'G001', nome: 'Saco 1kg', preco: 7.00, estoque: 100 },
    { codigo: 'G002', nome: 'Saco 5kg', preco: 18.00, estoque: 50 }
  ]
};

// ---------- FAQ prontas ----------
const FAQ = {
  troca: "Política de Troca: Aceitamos troca em até 7 dias úteis mediante apresentação do cupom e produto em perfeitas condições. Para trocar, digite 'troca' e informaremos o procedimento.",
  devolucao: "Política de Devolução: Devoluções somente em caso de defeito de fabricação. Entre em contato pelo telefone (xx) xxxx-xxxx para registrar o problema. Caso aprovado, faremos a coleta/estimativa conforme o caso.",
  promocoes: "Promoções: Trabalhamos com descontos por volume para compras atacadistas. Consulte descontos por WhatsApp ou digite 'promoções' para ver ofertas ativas."
};

// ---------- Utilitários de persistência ----------
function ensureFile(filePath, headers) {
  if (!fs.existsSync(filePath)) {
    const csv = stringify([], { header: true, columns: headers });
    fs.writeFileSync(filePath, csv, 'utf8');
  }
}

function readCSV(filePath) {
  ensureFile(filePath, []);
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return [];
  return parse(text, { columns: true, skip_empty_lines: true });
}

function appendCSV(filePath, obj) {
  const rows = readCSV(filePath);
  rows.push(obj);
  const cols = Object.keys(rows[0] || obj);
  const csv = stringify(rows, { header: true, columns: cols });
  fs.writeFileSync(filePath, csv, 'utf8');
}

function updateCSV(filePath, predicate, updater) {
  const rows = readCSV(filePath);
  let changed = false;
  const newRows = rows.map(r => {
    if (predicate(r)) {
      changed = true;
      return updater(r);
    }
    return r;
  });
  if (changed) {
    const cols = Object.keys(newRows[0] || {});
    const csv = stringify(newRows, { header: true, columns: cols });
    fs.writeFileSync(filePath, csv, 'utf8');
  }
  return changed;
}

function saveSessions(sessions) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function nextPedidoId() {
  // gera ID curto incremental: P000001, P000002...
  let last = 0;
  if (fs.existsSync(LAST_ID_FILE)) {
    const s = fs.readFileSync(LAST_ID_FILE, 'utf8').trim();
    last = parseInt(s || '0', 10);
  }
  last = last + 1;
  fs.writeFileSync(LAST_ID_FILE, String(last), 'utf8');
  return 'P' + String(last).padStart(6, '0');
}

// Garantir arquivos CSV
ensureFile(ARQ_PEDIDOS, ['codigo','cliente','telefone','endereco','itens','total','status','removido','timestamp']);
ensureFile(ARQ_USUARIOS, ['telefone','nome','removido','timestamp']);

// Carrega sessões
let sessions = loadSessions();

// ---------- WhatsApp client ----------
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "deposito-bebidas" }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  }
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('QR gerado no terminal. Escaneie pelo WhatsApp Web.');
});

client.on('ready', () => {
  console.log('WhatsApp client pronto!');
});

// ---------- Helpers de mensagem ----------
function saudacao() {
  return `🍻 Boas-vindas ao Depósito de Bebidas Prime! 🍻
Eu sou a Tati, sua assistente virtual. 🤖✨

O que deseja fazer hoje?
1️⃣ Atacado – Compras em volume (preços especiais)
2️⃣ 🕒 Nosso horário / 📍 Endereço
3️⃣ 👤 Atendente humano (falar com alguém)

Digite o número ou a opção (ex: 1 ou atacado).
Para ver todas as categorias digite "catálogo" ou "catalogo".`;
}

function listarCategoriasTexto() {
  let s = "📦 Categorias disponíveis:\n\n";
  CATALOG_CATEGORIES.forEach(c => s += `${c.id}️⃣ ${c.nome}\n`);
  s += `\nDigite o número da categoria ou o nome (ex: 7 ou refrigerantes).`;
  return s;
}

function listarProdutosPorCategoria(key) {
  const arr = PRODUTOS[key];
  if (!arr) return "Categoria não encontrada.";
  let s = `📋 Produtos - ${CATALOG_CATEGORIES.find(c=>c.key===key)?.nome || key}\n\n`;
  arr.forEach(p => {
    s += `• ${p.codigo} — ${p.nome} — R$ ${p.preco.toFixed(2)} — estoque: ${p.estoque}\n`;
  });
  s += `\nPara iniciar pedido digite "fazer pedido" ou "pedido".\nSe quiser pedir um item, digite o código e a quantidade separados por espaço (ex: ${arr[0].codigo} 6).\n*Lembrete:* mínimo por item: ${MINIMO_POR_ITEM} unidades (atacado).`;
  return s;
}

function procurarProdutoPorCodigo(codigo) {
  codigo = String(codigo).toUpperCase().trim();
  for (const key of Object.keys(PRODUTOS)) {
    const p = PRODUTOS[key].find(x => x.codigo.toUpperCase() === codigo);
    if (p) return { produto: p, categoria: key };
  }
  return null;
}

// ---------- Fluxo / Estado por chat ----------
function getSession(chatId) {
  if (!sessions[chatId]) {
    sessions[chatId] = { state: 'idle', pedidosTemp: [], cliente: null, categoria_selecionada: null, awaiting: null, handoff: false };
    saveSessions(sessions);
  }
  return sessions[chatId];
}

function resetSession(chatId) {
  sessions[chatId] = { state: 'idle', pedidosTemp: [], cliente: null, categoria_selecionada: null, awaiting: null, handoff: false };
  saveSessions(sessions);
}

// ---------- Comandos LGPD ----------
function marcarRemovidoUsuario(phone) {
  // marca em usuarios.csv
  const changed = updateCSV(ARQ_USUARIOS, r => r.telefone === phone, r => ({ ...r, removido: 'true', timestamp: moment().format() }));
  return changed;
}

// ---------- Processamento de mensagem ----------
client.on('message', async message => {
  try {
    const chat = await message.getChat();
    const contact = message.author || message.from;
    const chatId = chat.id._serialized;
    const fromNumber = (message.from || '').split('@')[0];
    const textoOriginal = message.body ? String(message.body).trim() : '';
    const texto = textoOriginal.toLowerCase();

    // Se sessão estiver em handoff (humano), não responder mais (apenas confirmação inicial)
    const sess = getSession(chatId);
    if (sess.handoff) {
      // opcional: enviar apenas uma vez uma mensagem confirmando repasse
      // não enviar mais mensagens enquanto handoff=true
      return;
    }

    // Responder comandos rápidos
    if (texto === 'menu' || texto === 'inicio' || texto === 'oi' || texto === 'olá' || texto === 'ola') {
      resetSession(chatId);
      await client.sendMessage(chatId, saudacao());
      return;
    }

    // LGPD apagar dados
    if (texto === 'apagar_meus_dados' || texto === 'apagar meus dados') {
      // marcar usuário removido
      // adiciona registro em usuarios.csv se não existir
      const users = readCSV(ARQ_USUARIOS);
      const exists = users.find(u => u.telefone === fromNumber);
      if (!exists) {
        appendCSV(ARQ_USUARIOS, { telefone: fromNumber, nome: '', removido: 'true', timestamp: moment().format() });
      } else {
        updateCSV(ARQ_USUARIOS, r => r.telefone === fromNumber, r => ({ ...r, removido: 'true', timestamp: moment().format() }));
      }
      // também marca pedidos anteriores (apenas marcação)
      updateCSV(ARQ_PEDIDOS, r => r.telefone === fromNumber, r => ({ ...r, removido: 'true' }));
      sess.handoff = false;
      sess.state = 'idle';
      saveSessions(sessions);
      await client.sendMessage(chatId, 'Seus dados foram marcados como removidos conforme solicitação (marcação "removido"). Para remoção física, entre em contato com o administrador.');
      return;
    }

    // FAQ simples
    if (texto.includes('troca')) {
      await client.sendMessage(chatId, FAQ.troca);
      return;
    }
    if (texto.includes('devolu') || texto.includes('devolução') || texto.includes('devolucao')) {
      await client.sendMessage(chatId, FAQ.devolucao);
      return;
    }
    if (texto.includes('promo') || texto.includes('promoções') || texto.includes('promocao')) {
      await client.sendMessage(chatId, FAQ.promocoes);
      return;
    }

    // horario / endereço
    if (texto === '2' || texto.includes('horario') || texto.includes('horário') || texto.includes('endereço') || texto.includes('endereco')) {
      const horario = "⏰ Horário de funcionamento: Segunda a Sábado — 09:00 às 20:00.\n📍 Endereço: Rua Exemplo, 123 - Bairro - Cidade.\n\nDeseja mais alguma coisa? (ex: catálogo, fazer pedido, falar com atendente)";
      await client.sendMessage(chatId, horario);
      return;
    }

    // falar com atendente -> handoff
    if (texto === '3' || texto.includes('atendente') || texto.includes('falar com')) {
      // marca handoff e avisa
      sess.handoff = true;
      saveSessions(sessions);
      await client.sendMessage(chatId, '🤝 Aguarde, iremos repassar para um atendente humano. Um atendente entrará em contato em breve. Enquanto isso, não enviaremos mais mensagens automáticas para este chat.');
      // aqui você pode integrar com sistema de atendimento humano (por ex. enviar email, webhook)
      return;
    }

    // catálogo ou catalogo
    if (texto === 'catálogo' || texto === 'catalogo' || texto === 'catálogo' || texto === 'catalogo') {
      await client.sendMessage(chatId, listarCategoriasTexto());
      return;
    }

    // se usuário escolheu "1" ou "atacado"
    if (texto === '1' || texto.includes('atacado')) {
      sess.state = 'catálogo';
      saveSessions(sessions);
      await client.sendMessage(chatId, `Atacado selecionado. Escolha uma categoria para ver produtos por atacado:\n\n${listarCategoriasTexto()}`);
      return;
    }

    // escolher categoria por número
    const numMatch = texto.match(/^([0-9]{1,2})$/);
    if (numMatch && sess.state === 'catálogo') {
      const num = parseInt(numMatch[1], 10);
      const cat = CATALOG_CATEGORIES.find(c => c.id === num);
      if (cat) {
        sess.categoria_selecionada = cat.key;
        saveSessions(sessions);
        await client.sendMessage(chatId, `Categoria selecionada: ${cat.nome}\n\n${listarProdutosPorCategoria(cat.key)}`);
        return;
      }
    }

    // escolher categoria por nome
    for (const cat of CATALOG_CATEGORIES) {
      if (texto.includes(cat.key) || texto.includes(cat.nome.toLowerCase().split(' ')[0])) {
        sess.categoria_selecionada = cat.key;
        sess.state = 'catálogo';
        saveSessions(sessions);
        await client.sendMessage(chatId, `Categoria selecionada: ${cat.nome}\n\n${listarProdutosPorCategoria(cat.key)}`);
        return;
      }
    }

    // iniciar pedido
    if (texto.includes('fazer pedido') || texto.includes('fazer pedido') || texto === 'pedido') {
      sess.state = 'pedido_iniciado';
      sess.pedidosTemp = [];
      sess.awaiting = 'codigo_ou_codigoQuantidade';
      saveSessions(sessions);
      await client.sendMessage(chatId, 'Ok! Para pedir um item digite o código e a quantidade separados por espaço. Ex: R001 6\nOu digite "finalizar" quando quiser concluir o pedido.');
      return;
    }

    // se estiver no fluxo de pedido e digitar um código + quantidade
    const codigoQtdMatch = textoOriginal.match(/^([A-Za-z0-9_]+)\s+([0-9]+)$/);
    if (codigoQtdMatch && (sess.state === 'pedido_iniciado' || sess.awaiting === 'codigo_ou_codigoQuantidade' || sess.state === 'catálogo')) {
      const codigoEntrada = codigoQtdMatch[1].toUpperCase();
      const qtd = parseInt(codigoQtdMatch[2], 10);

      const found = procurarProdutoPorCodigo(codigoEntrada);
      if (!found) {
        await client.sendMessage(chatId, 'Código não encontrado. Verifique o catálogo e tente novamente.');
        return;
      }
      // verificar mínimo por item
      if (qtd < MINIMO_POR_ITEM) {
        await client.sendMessage(chatId, `Quantidade mínima por item (atacado) é ${MINIMO_POR_ITEM}. Selecione ao menos ${MINIMO_POR_ITEM} unidades.`);
        return;
      }
      if (qtd > found.produto.estoque) {
        await client.sendMessage(chatId, `Desculpe, estoque insuficiente. Estoque atual: ${found.produto.estoque}`);
        return;
      }
      // adicionar ao pedido temporário
      sess.pedidosTemp = sess.pedidosTemp || [];
      const item = { codigo: found.produto.codigo, nome: found.produto.nome, qtd, preco: found.produto.preco };
      sess.pedidosTemp.push(item);
      saveSessions(sessions);
      // calcular subtotal temporário
      const subtotal = sess.pedidosTemp.reduce((s, it) => s + it.qtd * it.preco, 0);
      await client.sendMessage(chatId, `Adicionado ${qtd}x ${found.produto.nome} ao pedido. Subtotal: R$ ${subtotal.toFixed(2)}.\nDigite seu nome para finalizar o pedido ou continue adicionando itens.`);
      // continue flow expecting name/or more codes
      sess.state = 'pedido_iniciado';
      return;
    }

    // aceitar anexo de código de item (somente código)
    const codigoOnlyMatch = textoOriginal.match(/^([A-Za-z0-9_]+)$/);
    if (codigoOnlyMatch && (sess.state === 'pedido_iniciado' || sess.state === 'catálogo')) {
      // se apenas código sem quantidade, pedir quantidade
      const code = codigoOnlyMatch[1].toUpperCase();
      const found = procurarProdutoPorCodigo(code);
      if (found) {
        await client.sendMessage(chatId, `Você selecionou ${found.produto.nome}. Quantas unidades (mínimo ${MINIMO_POR_ITEM})? Ex: ${code} ${MINIMO_POR_ITEM}`);
        return;
      }
    }

    // Se o usuário digitou o nome (após adicionar itens) -> tratar como nome do cliente para finalizar
    if (sess.state === 'pedido_iniciado' && sess.pedidosTemp && sess.pedidosTemp.length > 0 && textoOriginal && !textoOriginal.match(/^(status|apagar_meus_dados|fazer pedido|pedido|finalizar|catalogo|catálogo)$/i)) {
      // assumimos que o texto é o nome do cliente
      sess.cliente = { nome: textoOriginal };
      sess.state = 'pedido_coletando_endereco';
      saveSessions(sessions);
      await client.sendMessage(chatId, 'Ok, qual o endereço para entrega (ou escreva "retirada")?');
      return;
    }

    // depois do endereço
    if (sess.state === 'pedido_coletando_endereco') {
      sess.cliente.endereco = textoOriginal;
      sess.state = 'pedido_coletando_pagamento';
      saveSessions(sessions);
      await client.sendMessage(chatId, 'Forma de pagamento: 1) Dinheiro 2) Cartão na entrega 3) PIX (digite 1,2 ou 3)');
      return;
    }

    // forma de pagamento
    if (sess.state === 'pedido_coletando_pagamento') {
      if (texto === '1' || texto === '2' || texto === '3') {
        sess.cliente.pagamento = texto === '1' ? 'Dinheiro' : texto === '2' ? 'Cartão' : 'PIX';
        // se dinheiro, perguntar troco
        if (sess.cliente.pagamento === 'Dinheiro') {
          sess.state = 'pedido_coletando_troco';
          saveSessions(sessions);
          await client.sendMessage(chatId, 'Você pagará em dinheiro. Precisará de troco? Se sim, informe para qual valor (ex: 50). Se não, digite "não".');
          return;
        } else {
          // finalizar pedido
          // criar pedido
          const codigoPedido = nextPedidoId();
          const itensStr = sess.pedidosTemp.map(i => `${i.codigo}x${i.qtd}`).join(';');
          const total = sess.pedidosTemp.reduce((s,i)=>s + i.qtd * i.preco, 0);
          const pedidoObj = {
            codigo: codigoPedido,
            cliente: sess.cliente.nome || '',
            telefone: fromNumber,
            endereco: sess.cliente.endereco || '',
            itens: itensStr,
            total: total.toFixed(2),
            status: 'Recebido',
            removido: 'false',
            timestamp: moment().format()
          };
          appendCSV(ARQ_PEDIDOS, pedidoObj);
          // salvar usuario se não existir
          const users = readCSV(ARQ_USUARIOS);
          if (!users.find(u => u.telefone === fromNumber)) {
            appendCSV(ARQ_USUARIOS, { telefone: fromNumber, nome: sess.cliente.nome || '', removido: 'false', timestamp: moment().format() });
          }
          // reduzir estoque local (não persistimos em arquivo PRODUTOS - pois é memória; atualize se quiser)
          sess.pedidosTemp.forEach(it => {
            const p = procurarProdutoPorCodigo(it.codigo);
            if (p) p.produto.estoque = Math.max(0, p.produto.estoque - it.qtd);
          });
          // limpar sessão
          resetSession(chatId);
          await client.sendMessage(chatId, `✅ Pedido confirmado!\nCódigo: ${codigoPedido}\nTotal: R$ ${total.toFixed(2)}\nTempo estimado: 45 minutos.\nDigite "status ${codigoPedido}" para checar o pedido.`);
          return;
        }
      } else {
        await client.sendMessage(chatId, 'Forma de pagamento inválida. Digite 1 (Dinheiro), 2 (Cartão) ou 3 (PIX).');
        return;
      }
    }

    // coletar troco (quando pagamento dinheiro)
    if (sess.state === 'pedido_coletando_troco') {
      if (texto === 'não' || texto === 'nao') {
        sess.cliente.troco = 'Não';
      } else {
        // se número
        const num = textoOriginal.replace(',', '.').match(/[\d.]+/);
        sess.cliente.troco = num ? num[0] : textoOriginal;
      }
      // finalizar pedido com troco info
      const codigoPedido = nextPedidoId();
      const itensStr = sess.pedidosTemp.map(i => `${i.codigo}x${i.qtd}`).join(';');
      const total = sess.pedidosTemp.reduce((s,i)=>s + i.qtd * i.preco, 0);
      const pedidoObj = {
        codigo: codigoPedido,
        cliente: sess.cliente.nome || '',
        telefone: fromNumber,
        endereco: sess.cliente.endereco || '',
        itens: itensStr,
        total: total.toFixed(2),
        status: 'Recebido',
        removido: 'false',
        timestamp: moment().format()
      };
      appendCSV(ARQ_PEDIDOS, pedidoObj);
      // salvar usuario se não existir
      const users = readCSV(ARQ_USUARIOS);
      if (!users.find(u => u.telefone === fromNumber)) {
        appendCSV(ARQ_USUARIOS, { telefone: fromNumber, nome: sess.cliente.nome || '', removido: 'false', timestamp: moment().format() });
      }
      // reduzir estoque local
      sess.pedidosTemp.forEach(it => {
        const p = procurarProdutoPorCodigo(it.codigo);
        if (p) p.produto.estoque = Math.max(0, p.produto.estoque - it.qtd);
      });
      resetSession(chatId);
      await client.sendMessage(chatId, `✅ Pedido confirmado!\nCódigo: ${codigoPedido}\nTotal: R$ ${total.toFixed(2)}\nTroco solicitado: ${sess.cliente.troco}\nTempo estimado: 45 minutos.\nDigite "status ${codigoPedido}" para checar o pedido.`);
      return;
    }

    // status <codigo>
    if (texto.startsWith('status')) {
      const parts = textoOriginal.split(/\s+/);
      if (parts.length < 2) {
        await client.sendMessage(chatId, 'Use: status <codigo>. Ex: status P000001');
        return;
      }
      const code = parts[1].toUpperCase();
      const pedidos = readCSV(ARQ_PEDIDOS);
      const ped = pedidos.find(p => p.codigo === code);
      if (!ped) {
        await client.sendMessage(chatId, `Pedido ${code} não encontrado.`);
        return;
      }
      await client.sendMessage(chatId, `Status do pedido ${code}: ${ped.status}\nItens: ${ped.itens}\nTotal: R$ ${parseFloat(ped.total).toFixed(2)}`);
      return;
    }

    // comando "finalizar" (quando no fluxo)
    if (texto === 'finalizar' && sess.pedidosTemp && sess.pedidosTemp.length > 0) {
      await client.sendMessage(chatId, 'Para finalizar preciso do seu nome. Por favor digite seu nome completo.');
      return;
    }

    // se mensagem não foi reconhecida, enviar sugestão de comandos
    await client.sendMessage(chatId, `Não entendi. Você pode digitar "menu" para voltar ao início, "catálogo" para ver categorias, "fazer pedido" para iniciar compra, "status <código>" para checar pedido ou "apagar_meus_dados" para remoção de dados.`);
  } catch (err) {
    console.error('Erro ao processar mensagem:', err);
  }
});

client.initialize();
