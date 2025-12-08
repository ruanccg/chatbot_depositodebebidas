// chatbot.js - DEPÓSITO DE BEBIDAS PRIME (versão ATACADO apenas)
// Recomendações (opcionais):
// export HEADLESS=false
// export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
// export OWNER_NUMBER="+5588XXXXXXXX@c.us"

const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const { Client, List, LocalAuth } = require("whatsapp-web.js");

// ---- Config ----
const DEBUG_HEADLESS = (process.env.HEADLESS || "true").toLowerCase() === "true";
const OWNER_NUMBER = process.env.OWNER_NUMBER || null;
const ORDERS_CSV = path.join(__dirname, "orders.csv");

// ---- DEPOSITO e CATALOGO (ATACADO) ----
const DEPOSITO = {
  nome: "Depósito de Bebidas Prime",
  telefone: "(88) 9 9999-9999 (WhatsApp)",
  horario: "Seg — Sex: 08:00 — 19:00\nSáb: 08:00 — 14:00\nDom: Fechado",
  infoEntrega:
    "Atendemos *somente* os bairros listados abaixo. Se seu endereço não estiver na lista, oferecemos retirada no local:\n\n" +
    "Vila São Roque, Vilinha, Canoeiro, Trizidela, Expoagra, Vila Tucum, Aeroporto, Ronierd Barros, Joana Batista, Conjunto Parque Grajaú, Conjunto Frei Alberto Beretta, Centro, Rodoviária, Extrema.\n\n" +
    "Taxa de entrega e prazos são informados no fechamento do pedido. Para retirada na loja: nenhum custo.",
  categories: {
    "Whiskies 🥃": [
      { code: "W01", name: "Old Parr 12 anos 1L", price: 138.0 },
      { code: "W02", name: "Johnnie Walker Red Label 1L", price: 99.0 },
      { code: "W03", name: "Johnnie Walker Black Label 1L", price: 168.0 },
      { code: "W04", name: "Ballantine’s Finest 1L", price: 85.0 },
      { code: "W05", name: "Chivas Regal 12 anos 1L", price: 148.0 },
    ],
    "Espumantes & Champagnes 🍾": [
      { code: "E01", name: "Chandon Brut 750ml", price: 88.0 },
      { code: "E02", name: "Chandon Rosé 750ml", price: 102.0 },
      { code: "E03", name: "Salton Prosecco 750ml", price: 36.0 },
      { code: "E04", name: "Salton Brut 750ml", price: 32.0 },
      { code: "E05", name: "Mumm Cordon Rouge 750ml", price: 128.0 },
    ],
    "Vinhos 🍷": [
      { code: "V01", name: "Vinho Tinto Chileno Reservado 750ml", price: 31.0 },
      { code: "V02", name: "Vinho Argentino Malbec 750ml", price: 40.0 },
      { code: "V03", name: "Vinho Português Periquita 750ml", price: 36.0 },
      { code: "V04", name: "Vinho Verde Português 750ml", price: 31.0 },
    ],
    "Destilados / Licor 🥃": [
      { code: "D01", name: "Campari 900ml", price: 40.0 },
      { code: "D02", name: "Jurupinga 1L", price: 19.0 },
      { code: "D03", name: "Contini 900ml", price: 39.0 },
      { code: "D04", name: "Vodka Smirnoff 1L", price: 35.0 },
      { code: "D05", name: "Vodka Absolut 1L", price: 80.0 },
      { code: "D06", name: "Vodka Cîroc 750ml", price: 165.0 },
    ],
    "Prontos para Beber (RTD) 🍹": [
      { code: "R01", name: "Smirnoff Ice 269ml", price: 6.2 },
      { code: "R02", name: "Beats Senses 269ml", price: 7.0 },
      { code: "R03", name: "Beats Pink 269ml", price: 7.0 },
      { code: "R04", name: "Gin Tônica Lata 350ml", price: 8.0 },
    ],
    "Cervejas (lata/garrafa) 🍺": [
      { code: "C01", name: "Skol Lata 350ml", price: 4.0 },
      { code: "C02", name: "Brahma Lata 350ml", price: 4.0 },
      { code: "C03", name: "Itaipava Lata 350ml", price: 3.6 },
      { code: "C04", name: "Heineken Lata 350ml", price: 5.9 },
      { code: "C05", name: "Heineken Garrafa 600ml", price: 9.0 },
      { code: "C06", name: "Budweiser 330ml", price: 5.4 },
      { code: "C07", name: "Stella Artois 275ml", price: 7.0 },
    ],
    "Refrigerantes 🥤": [
      { code: "RF01", name: "Coca-Cola Lata 350ml", price: 4.5 },
      { code: "RF02", name: "Coca-Cola 1L", price: 6.8 },
      { code: "RF03", name: "Coca-Cola 2L", price: 9.0 },
      { code: "RF04", name: "Guaraná Lata 350ml", price: 4.0 },
      { code: "RF05", name: "Sprite Lata 350ml", price: 4.0 },
    ],
    "Energéticos ⚡": [
      { code: "EN01", name: "Red Bull 250ml", price: 9.0 },
      { code: "EN02", name: "Red Bull Tropical 250ml", price: 10.5 },
      { code: "EN03", name: "Monster Tradicional 473ml", price: 8.0 },
      { code: "EN04", name: "Monster Mango Loco 473ml", price: 8.0 },
    ],
    "Gelo ❄️": [
      { code: "G01", name: "Saco Gelo 1kg", price: 6.0 },
      { code: "G02", name: "Saco Gelo 5kg", price: 15.0 },
    ],
  },
};

// ---- Áreas de entrega permitidas (normalizadas, sem acento) ----
const ALLOWED_NEIGHBORHOODS = [
  "vila sao roque", "vilinha", "canoeiro", "trizidela", "expoagra", "vila tucum",
  "aeroporto", "ronierd barros", "joana batista", "conjunto parque grajau",
  "conjunto frei alberto beretta", "centro", "rodoviaria", "extrema"
];

// ---- Utils ----
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function formatCurrency(v) {
  return "R$ " + v.toFixed(2).replace(".", ",");
}

function generateOrderCode() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const t = String(now.getTime()).slice(-5);
  return `P${y}${m}${d}-${t}`;
}

function ensureOrdersCsv() {
  if (!fs.existsSync(ORDERS_CSV)) {
    const header = "order_code,datetime,client,phone,address,items,total,payment_method,notes\n";
    fs.writeFileSync(ORDERS_CSV, header, { encoding: "utf8" });
  }
}

function saveOrderToCsv(obj) {
  ensureOrdersCsv();
  const line = [
    obj.order_code,
    obj.datetime,
    `"${(obj.client || "").replace(/"/g, '""')}"`,
    obj.phone,
    `"${(obj.address || "").replace(/"/g, '""')}"`,
    `"${JSON.stringify(obj.items).replace(/"/g, '""')}"`,
    obj.total.toFixed(2),
    obj.payment_method || "",
    `"${(obj.notes || "").replace(/"/g, '""')}"`,
  ].join(",") + "\n";
  fs.appendFileSync(ORDERS_CSV, line, { encoding: "utf8" });
}

// remove acentos e normaliza para comparação
function removeAccents(str = "") {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Verifica se o endereço informado pertence a um dos bairros permitidos
function addressInAllowedNeighborhood(addressText) {
  if (!addressText) return false;
  const norm = removeAccents(addressText);
  for (const nb of ALLOWED_NEIGHBORHOODS) {
    if (norm.includes(nb)) return true;
  }
  return false;
}

// busca produto pelo nome (fuzzy simples) - usa normalização
function findProductByName(inputText) {
  const text = removeAccents(inputText || "");
  const flat = [];
  for (const [cat, arr] of Object.entries(DEPOSITO.categories)) {
    for (const p of arr) {
      flat.push({ ...p, category: cat, nameNorm: removeAccents(p.name) });
    }
  }
  const byCode = flat.find((p) => text.includes(p.code.toLowerCase()));
  if (byCode) return byCode;
  let best = null;
  for (const p of flat) {
    const name = p.nameNorm;
    if (text === name) return p;
    if (name.includes(text) || text.includes(name)) return p;
    const tokens = text.split(/\s+/);
    const matches = tokens.filter((t) => name.includes(t)).length;
    if (matches > 0 && (!best || matches > best.matches)) best = { ...p, matches };
  }
  return best ? { code: best.code, name: best.name, price: best.price, category: best.category } : null;
}

function extractQuantity(text) {
  const m = (text || "").match(/(\d+)\s*(x|un|unidades|uni|kg|g)?/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

function suggestUpsell(product) {
  const cat = product.category;
  const arr = DEPOSITO.categories[cat] || [];
  const sorted = arr.slice().sort((a, b) => a.price - b.price);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].code === product.code && i < sorted.length - 1) {
      return sorted[i + 1];
    }
  }
  return null;
}

// ---- Estado por usuário ----
const users = new Map(); // phone -> { clientName, address }
const pedidoState = new Map(); // phone -> { step, items, total, ... }

// ---- Helpers de mensagem / listas ----
function buildCategoriesList() {
  const rows = [];
  for (const cat of Object.keys(DEPOSITO.categories)) {
    rows.push({ id: `cat_${rows.length}`, title: cat, description: `Ver produtos da categoria ${cat}` });
  }
  return new List(
    `Categorias — ${DEPOSITO.nome}`,
    "Ver categorias",
    [{ title: "Categorias", rows }],
    `${DEPOSITO.nome}`,
    "Escolha uma categoria"
  );
}

// >>> nova função: cria texto que mostra todas as categorias (visível no chat)
function buildCategoriesText() {
  const cats = Object.keys(DEPOSITO.categories);
  let txt = "📦 *Categorias disponíveis:*\n\n";
  cats.forEach((cat, i) => {
    txt += `${i + 1}️⃣ ${cat}\n`;
  });
  txt += "\nDigite o *número* ou o *nome* da categoria ou clique na opção abaixo.";
  return txt;
}

function buildProductsListForCategory(catName) {
  const arr = DEPOSITO.categories[catName] || [];
  const rows = arr.map((p, i) => ({ id: `prod_${p.code}`, title: `${i + 1}️⃣ ${p.name}`, description: `${formatCurrency(p.price)} (atacado)` }));
  return new List(`Produtos — ${catName}`, "Ver produtos", [{ title: catName, rows }], `${DEPOSITO.nome}`, "Escolha um produto");
}

// ---- Client ----
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: DEBUG_HEADLESS,
    executablePath: process.env.CHROME_PATH || undefined,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    timeout: 0,
  },
});

// ---- Eventos ----
client.on("qr", (qr) => {
  console.log("QR gerado — escaneie no WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log(`${DEPOSITO.nome} — Bot conectado! (headless=${DEBUG_HEADLESS})`);
});

client.on("auth_failure", (m) => {
  console.error("Falha na autenticação:", m);
});

client.initialize().catch((e) => console.error("Erro init:", e));

// ---- Fluxo de mensagens ----
client.on("message", async (msg) => {
  try {
    const from = msg.from;
    const textRaw = (msg.body || "").trim();
    const textNorm = removeAccents(textRaw);
    console.log(`[MSG] from=${from} text="${textRaw}" textNorm="${textNorm}"`);

    if (!from.endsWith("@c.us")) return; // ignora grupos

    // --- Se o cliente já está em fluxo de pedido ---
    if (pedidoState.has(from)) {
      const state = pedidoState.get(from);

      // (fluxo igual ao anterior: aguardando_produto, confirm_item, endereço, nome, pagamento, confirmar)
      // para brevidade o fluxo completo foi preservado do arquivo anterior.
      // Implementação completa:
      if (state.step === "aguardando_produto") {
        const qty = extractQuantity(textRaw);
        const prod = findProductByName(textRaw);
        if (prod) {
          const quantity = qty || 1;
          state.items.push({ code: prod.code, name: prod.name, price: prod.price, qty: quantity, category: prod.category });
          state.total = state.items.reduce((s, it) => s + it.price * it.qty, 0);
          state.step = "confirm_item";
          state.pending_upsell = suggestUpsell(prod);
          pedidoState.set(from, state);

          await delay(300);
          await msg.reply(`✅ Adicionado: ${prod.name}\nQuantidade: ${quantity}\nSubtotal: ${formatCurrency(prod.price * quantity)}`);

          if (state.pending_upsell) {
            await delay(200);
            await msg.reply(`Sugestão: que tal também *${state.pending_upsell.name}* por ${formatCurrency(state.pending_upsell.price)}? Responda *SIM* para adicionar, *NÃO* para pular.`);
          } else {
            await delay(200);
            await msg.reply('Deseja adicionar mais itens? Digite o nome do produto ou *continuar* para seguir.');
          }
          return;
        } else {
          if (textNorm.match(/\b(catalogo|menu|categorias|produtos)\b/)) {
            console.log("Enviando categorias (pedido flow).");
            await client.sendMessage(from, buildCategoriesText());
            await client.sendMessage(from, buildCategoriesList());
            return;
          }
          await msg.reply("Não encontrei esse produto. Digite o nome exato, use o catálogo ou digite *catálogo* para ver categorias.");
          return;
        }
      }

      if (state.step === "confirm_item") {
        if (state.pending_upsell && textNorm.match(/^(sim|s)$/i)) {
          const up = state.pending_upsell;
          state.items.push({ code: up.code, name: up.name, price: up.price, qty: 1, category: up.category });
          state.total = state.items.reduce((s, it) => s + it.price * it.qty, 0);
          state.pending_upsell = null;
          pedidoState.set(from, state);
          await msg.reply(`✅ Upsell adicionado: ${up.name} (1 unidade). Deseja adicionar mais? Digite produto ou *continuar*.`);
          return;
        } else if (state.pending_upsell && textNorm.match(/^(nao|não|n)$/i)) {
          state.pending_upsell = null;
          pedidoState.set(from, state);
          await msg.reply("Ok. Deseja adicionar mais itens? Digite o produto ou *continuar* para avançar.");
          return;
        }

        if (textNorm.match(/\b(continuar|prosseguir|finalizar|ok|confirmar)\b/)) {
          state.step = "aguardar_endereco";
          pedidoState.set(from, state);
          const user = users.get(from);
          if (user && user.address) {
            if (addressInAllowedNeighborhood(user.address)) {
              state.address = user.address;
              state.step = "aguardar_pagamento";
              pedidoState.set(from, state);
              await msg.reply(`Usando seu endereço cadastrado: ${user.address}\nQual a forma de pagamento? Responda *PIX*, *CARTÃO* ou *DINHEIRO*.`);
              return;
            } else {
              state.step = "aguardar_endereco_dados";
              pedidoState.set(from, state);
              await msg.reply(`Seu endereço cadastrado (${user.address}) parece *fora* da nossa área de entrega. 🚫\nVocê pode digitar *RETIRAR* para retirada na loja ou enviar outro endereço dentro dos bairros atendidos.\n\nBairros: Vila São Roque, Vilinha, Canoeiro, Trizidela, Expoagra, Vila Tucum, Aeroporto, Ronierd Barros, Joana Batista, Conjunto Parque Grajaú, Conjunto Frei Alberto Beretta, Centro, Rodoviária, Extrema.`);
              return;
            }
          } else {
            state.step = "aguardar_endereco_dados";
            pedidoState.set(from, state);
            await msg.reply("Por favor, informe o endereço completo para entrega (Rua, número, bairro, complemento) ou digite *RETIRAR* para retirada na loja.");
            return;
          }
        }

        const maybeProd = findProductByName(textRaw);
        if (maybeProd) {
          state.step = "aguardando_produto";
          pedidoState.set(from, state);
          await client.sendMessage(from, "Detectei um novo produto — adicionando na próxima mensagem.");
          return;
        }

        await msg.reply("Digite o nome de outro produto para adicionar ou *continuar* para avançar.");
        return;
      }

      if (state.step === "aguardar_endereco_dados") {
        if (textNorm.match(/^retirar|retirada$/i)) {
          state.address = "RETIRADA NA LOJA";
          state.step = "aguardar_nome";
          pedidoState.set(from, state);
          await msg.reply("Retirada escolhida. Qual o seu nome para o pedido?");
          return;
        }

        const providedAddress = textRaw;
        if (addressInAllowedNeighborhood(providedAddress)) {
          state.address = providedAddress;
          const prev = users.get(from) || {};
          users.set(from, { clientName: prev.clientName || null, address: providedAddress });
          state.step = "aguardar_nome";
          pedidoState.set(from, state);
          await msg.reply("Endereço válido. Agora me diga seu *nome completo* para finalizar o cadastro do pedido.");
          return;
        } else {
          await msg.reply(`Infelizmente seu endereço não está na nossa área de entrega. 😕\nOpções:\n1️⃣ Envie outro endereço dentro dos bairros atendidos.\n2️⃣ Digite *RETIRAR* para retirar na loja.\n\nBairros atendidos: Vila São Roque, Vilinha, Canoeiro, Trizidela, Expoagra, Vila Tucum, Aeroporto, Ronierd Barros, Joana Batista, Conjunto Parque Grajaú, Conjunto Frei Alberto Beretta, Centro, Rodoviária, Extrema.`);
          pedidoState.set(from, state);
          return;
        }
      }

      if (state.step === "aguardar_nome") {
        state.client = textRaw;
        const prev = users.get(from) || {};
        users.set(from, { clientName: state.client, address: state.address || prev.address || null });
        state.step = "aguardar_pagamento";
        pedidoState.set(from, state);
        await msg.reply("Obrigado! Agora informe a forma de pagamento: *PIX*, *CARTÃO* ou *DINHEIRO*.");
        return;
      }

      if (state.step === "aguardar_pagamento") {
        const method = textNorm.match(/pix/) ? "PIX" : textNorm.match(/cartao|visa|mastercard/) ? "CARTÃO" : textNorm.match(/dinheiro|troco/) ? "DINHEIRO" : null;
        if (!method) {
          await msg.reply("Forma de pagamento não reconhecida. Digite *PIX*, *CARTÃO* ou *DINHEIRO*.");
          return;
        }
        state.payment_method = method;
        state.step = "confirmar_pedido";
        pedidoState.set(from, state);

        const itemsTxt = state.items.map((it, i) => `${i + 1}️⃣ ${it.name} — ${it.qty} x ${formatCurrency(it.price)} = ${formatCurrency(it.qty * it.price)}`).join("\n");
        await msg.reply(`🧾 Resumo do pedido:\n${itemsTxt}\n\nTotal: ${formatCurrency(state.total)}\nEndereço: ${state.address}\nPagamento: ${state.payment_method}\n\nResponda *CONFIRMAR* para finalizar ou *CANCELAR* para abortar.`);
        return;
      }

      if (state.step === "confirmar_pedido") {
        if (textNorm.match(/^(confirmar|confirmo|sim)$/i)) {
          const orderCode = generateOrderCode();
          const now = new Date().toISOString();
          const orderObj = {
            order_code: orderCode,
            datetime: now,
            client: state.client || "",
            phone: from,
            address: state.address || "",
            items: state.items,
            total: state.total,
            payment_method: state.payment_method || "",
            notes: state.notes || "",
          };
          saveOrderToCsv(orderObj);

          await msg.reply(`✅ Pedido *${orderCode}* confirmado! Obrigado ${state.client || ""}. Entraremos em contato para combinar entrega/pagamento.\nTempo estimado: 45-70 minutos.\nDeseja acrescentar mais algo? Digite o produto ou *NÃO* para encerrar.`);

          if (OWNER_NUMBER) {
            const summary = `NOVO PEDIDO ${orderCode}\nDe: ${state.client || from}\nTel: ${from}\nTotal: ${formatCurrency(state.total)}\nEndereço: ${state.address || "RETIRADA"}\nItens: ${state.items.map(it => `${it.qty}x ${it.name}`).join(", ")}`;
            try { await client.sendMessage(OWNER_NUMBER, summary); } catch (e) { console.warn("Erro ao notificar owner:", e?.message || e); }
          }

          pedidoState.set(from, { step: "aguardando_produto", items: [], total: 0, client: state.client, address: state.address });
          return;
        } else if (textNorm.match(/^(cancelar|nao|não)$/i)) {
          await msg.reply("Pedido cancelado. Digite *menu* para voltar ao início.");
          pedidoState.delete(from);
          return;
        } else {
          await msg.reply("Digite *CONFIRMAR* para finalizar ou *CANCELAR* para abortar.");
          return;
        }
      }

    } // fim bloco pedidoState

    // ---- Comandos gerais / menus (ATACADO apenas) ----
    if (textNorm.match(/^(oi|ola|menu|inicio|comecar|comecar)$/i)) {
      const welcome =
`🍻 *Boas-vindas ao ${DEPOSITO.nome}!* 🍻
Eu sou a *Tati*, sua assistente virtual. 🤖✨

O que deseja fazer hoje?
1️⃣ *Atacado* – Compras em volume (preços especiais)
2️⃣ *🕒 Nosso horário* / *📍 Endereço*
3️⃣ *👤 Atendente humano* (falar com alguém)

Digite o número ou a opção (ex: *1* ou *atacado*).`;
      await delay(200);
      await msg.reply(welcome);
      return;
    }

    if (textNorm === "1" || textNorm.match(/\b(atacado)\b/)) {
      await delay(200);
      await msg.reply("Atacado selecionado. Escolha uma categoria para ver produtos por atacado:");
      // mostra texto com categorias (visível) e em seguida a List interativa
      await client.sendMessage(from, buildCategoriesText());
      await client.sendMessage(from, buildCategoriesList());
      return;
    }

    if (textNorm.match(/\b(horario|onde|endereco|endereço)\b/)) {
      await msg.reply(`🕒 Horário:\n${DEPOSITO.horario}\n\n📍 Retire na loja ou peça entrega.\n\n${DEPOSITO.infoEntrega}`);
      return;
    }

    if (textNorm.match(/\b(atendente|humano|operador|pessoal)\b/)) {
      await msg.reply("Aguarde, vou notificar um atendente. 👨‍💼");
      if (OWNER_NUMBER) {
        await client.sendMessage(OWNER_NUMBER, `Cliente ${from} pediu atendimento humano.`);
      }
      return;
    }

    // catálogo / categorias — aceitar "catálogo" com acento e sem
    if (textNorm.match(/\b(catalogo|categorias|produtos|menu categorias)\b/)) {
      console.log("Usuário pediu catálogo; enviando categories text + list.");
      await client.sendMessage(from, buildCategoriesText());
      await client.sendMessage(from, buildCategoriesList());
      return;
    }

    // aceitar se o usuário digitou o nome da categoria ou o número dela
    const cats = Object.keys(DEPOSITO.categories);
    // por número (1,2,...)
    if (/^\d+$/.test(textRaw.trim())) {
      const idx = parseInt(textRaw.trim(), 10) - 1;
      if (idx >= 0 && idx < cats.length) {
        const catName = cats[idx];
        await client.sendMessage(from, buildProductsListForCategory(catName));
        return;
      }
    }
    // por nome da categoria (aceita acentos)
    for (const catName of cats) {
      const catNorm = removeAccents(catName);
      if (textNorm.includes(catNorm) || textNorm === catNorm) {
        console.log(`Usuário digitou categoria: ${catName} (matched by name)`);
        await client.sendMessage(from, buildProductsListForCategory(catName));
        return;
      }
    }

    // se usuário clicou na List (cat_# ou prod_CODE)
    if (textRaw.startsWith("cat_")) {
      const idx = parseInt(textRaw.split("_")[1], 10);
      const catName = Object.keys(DEPOSITO.categories)[idx];
      if (catName) {
        await client.sendMessage(from, buildProductsListForCategory(catName));
        return;
      }
    }
    if (textRaw.startsWith("prod_")) {
      const code = textRaw.split("_")[1];
      let prod = null;
      for (const [cat, arr] of Object.entries(DEPOSITO.categories)) {
        const found = arr.find((p) => p.code === code);
        if (found) { prod = { ...found, category: cat }; break; }
      }
      if (prod) {
        pedidoState.set(from, { step: "confirm_item", items: [{ code: prod.code, name: prod.name, price: prod.price, qty: 1, category: prod.category }], total: prod.price, client: null, address: null });
        await msg.reply(`✅ Adicionado: ${prod.name} — 1 x ${formatCurrency(prod.price)}\nDeseja adicionar mais itens? Digite o produto ou *continuar* para finalizar.`);
        return;
      }
    }

    // tentar entender mensagens livres (ex: "Quero 3 Skol")
    const maybeQty = extractQuantity(textRaw);
    const maybeProd = findProductByName(textRaw);
    if (maybeProd) {
      pedidoState.set(from, { step: "confirm_item", items: [{ code: maybeProd.code, name: maybeProd.name, price: maybeProd.price, qty: maybeQty || 1, category: maybeProd.category }], total: (maybeQty || 1) * maybeProd.price, client: null, address: null });
      await msg.reply(`✅ Adicionado: ${maybeProd.name} — ${maybeQty || 1} x ${formatCurrency(maybeProd.price)}\nDeseja adicionar mais itens? Digite o produto ou *continuar* para finalizar.`);
      return;
    }

    // iniciar pedido direto
    if (textNorm.match(/\b(fazer pedido|pedir|pedido)\b/)) {
      pedidoState.set(from, { step: "aguardando_produto", items: [], total: 0, client: null, address: null, payment_method: null, notes: null, pending_upsell: null });
      await msg.reply("Ótimo — diga o *nome do produto* que deseja (ex: CERVEJA LATA 350ml) ou digite *catálogo* para ver categorias.");
      return;
    }

    // fallback
    await msg.reply("Não entendi. Digite *menu* para começar, *catálogo* para ver categorias, ou *fazer pedido* para iniciar.");
  } catch (err) {
    console.error("Erro no handler:", err?.message || err);
  }
});

// ---- Global handlers ----
process.on("unhandledRejection", (r) => console.error("UnhandledRejection:", r));
process.on("SIGINT", async () => { console.log("Encerrando..."); try { await client.destroy(); } catch (e) {} process.exit(0); });
