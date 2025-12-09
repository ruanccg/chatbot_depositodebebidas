// chatbot.js - DEPÓSITO DE BEBIDAS PRIME (versão ATACADO apenas)
// Observações:
// - Configure variáveis de ambiente opcionais:
//   HEADLESS (true|false), CHROME_PATH (caminho do Chrome), OWNER_NUMBER (ex: "+5588XXXXXXXX@c.us")
// - Para GDPR/LGPD: comando apagar_meus_dados apaga da memória local (users map) e registra no removed_users.log

const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const { Client, List, LocalAuth } = require("whatsapp-web.js");

// ---- Configurações ----
const DEBUG_HEADLESS = (process.env.HEADLESS || "true").toLowerCase() === "true";
const OWNER_NUMBER = process.env.OWNER_NUMBER || null;
const ORDERS_CSV = path.join(__dirname, "orders.csv");
const REMOVED_USERS_LOG = path.join(__dirname, "removed_users.log");

// ---- Ajuste de delays (reduzidos para respostas mais rápidas) ----
const DELAY_CURTO = 80;   // curto
const DELAY_MEDIO = 150;  // médio

// ---- DEPÓSITO e CATÁLOGO (ATACADO) ----
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
      { code: "W05", name: "Chivas Regal 12 anos 1L", price: 148.0 }
    ],
    "Espumantes & Champagnes 🍾": [
      { code: "E01", name: "Chandon Brut 750ml", price: 88.0 },
      { code: "E02", name: "Chandon Rosé 750ml", price: 102.0 },
      { code: "E03", name: "Salton Prosecco 750ml", price: 36.0 },
      { code: "E04", name: "Salton Brut 750ml", price: 32.0 },
      { code: "E05", name: "Mumm Cordon Rouge 750ml", price: 128.0 }
    ],
    "Vinhos 🍷": [
      { code: "V01", name: "Vinho Tinto Chileno Reservado 750ml", price: 31.0 },
      { code: "V02", name: "Vinho Argentino Malbec 750ml", price: 40.0 },
      { code: "V03", name: "Vinho Português Periquita 750ml", price: 36.0 },
      { code: "V04", name: "Vinho Verde Português 750ml", price: 31.0 }
    ],
    "Destilados / Licor 🥃": [
      { code: "D01", name: "Campari 900ml", price: 40.0 },
      { code: "D02", name: "Jurupinga 1L", price: 19.0 },
      { code: "D03", name: "Contini 900ml", price: 39.0 },
      { code: "D04", name: "Vodka Smirnoff 1L", price: 35.0 },
      { code: "D05", name: "Vodka Absolut 1L", price: 80.0 },
      { code: "D06", name: "Vodka Cîroc 750ml", price: 165.0 }
    ],
    "Prontos para Beber (RTD) 🍹": [
      { code: "R01", name: "Smirnoff Ice 269ml", price: 6.2 },
      { code: "R02", name: "Beats Senses 269ml", price: 7.0 },
      { code: "R03", name: "Beats Pink 269ml", price: 7.0 },
      { code: "R04", name: "Gin Tônica Lata 350ml", price: 8.0 }
    ],
    "Cervejas (lata/garrafa) 🍺": [
      { code: "C01", name: "Skol Lata 350ml", price: 4.0 },
      { code: "C02", name: "Brahma Lata 350ml", price: 4.0 },
      { code: "C03", name: "Itaipava Lata 350ml", price: 3.6 },
      { code: "C04", name: "Heineken Lata 350ml", price: 5.9 },
      { code: "C05", name: "Heineken Garrafa 600ml", price: 9.0 },
      { code: "C06", name: "Budweiser 330ml", price: 5.4 },
      { code: "C07", name: "Stella Artois 275ml", price: 7.0 }
    ],
    "Refrigerantes 🥤": [
      { code: "RF01", name: "Coca-Cola Lata 350ml", price: 4.5 },
      { code: "RF02", name: "Coca-Cola 1L", price: 6.8 },
      { code: "RF03", name: "Coca-Cola 2L", price: 9.0 },
      { code: "RF04", name: "Guaraná Lata 350ml", price: 4.0 },
      { code: "RF05", name: "Sprite Lata 350ml", price: 4.0 }
    ],
    "Energéticos ⚡": [
      { code: "EN01", name: "Red Bull 250ml", price: 9.0 },
      { code: "EN02", name: "Red Bull Tropical 250ml", price: 10.5 },
      { code: "EN03", name: "Monster Tradicional 473ml", price: 8.0 },
      { code: "EN04", name: "Monster Mango Loco 473ml", price: 8.0 }
    ],
    "Gelo ❄️": [
      { code: "G01", name: "Saco Gelo 1kg", price: 6.0 },
      { code: "G02", name: "Saco Gelo 5kg", price: 15.0 }
    ]
  }
};

// ---- Bairros permitidos (normalizados, sem acento) ----
const BAIRROS_PERMITIDOS = [
  "vila sao roque", "vilinha", "canoeiro", "trizidela", "expoagra", "vila tucum",
  "aeroporto", "ronierd barros", "joana batista", "conjunto parque grajau",
  "conjunto frei alberto beretta", "centro", "rodoviaria", "extrema"
];

// ---- Utilitários ----
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function formatarMoeda(v) {
  return "R$ " + v.toFixed(2).replace(".", ",");
}

function gerarCodigoPedido() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const t = String(now.getTime()).slice(-5);
  return `P${y}${m}${d}-${t}`;
}

function garantirOrdersCsv() {
  if (!fs.existsSync(ORDERS_CSV)) {
    const header = "order_code,datetime,client,phone,address,items,total,payment_method,notes\n";
    fs.writeFileSync(ORDERS_CSV, header, { encoding: "utf8" });
  }
}

function salvarPedidoCsv(obj) {
  garantirOrdersCsv();
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

// Remover acentos e normalizar para comparação
function removerAcentos(str = "") {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Verifica se endereço informado pertence a bairro permitido
function enderecoEmBairroPermitido(enderecoTexto) {
  if (!enderecoTexto) return false;
  const norm = removerAcentos(enderecoTexto);
  for (const nb of BAIRROS_PERMITIDOS) {
    if (norm.includes(nb)) return true;
  }
  return false;
}

// Busca produto pelo nome ou código (fuzzy simples)
function buscarProdutoPorNome(inputText) {
  const text = removerAcentos(inputText || "");
  const flat = [];
  for (const [cat, arr] of Object.entries(DEPOSITO.categories)) {
    for (const p of arr) {
      flat.push({ ...p, category: cat, nameNorm: removerAcentos(p.name) });
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

function extrairQuantidade(text) {
  const m = (text || "").match(/(\d+)\s*(x|un|unidades|uni|kg|g)?/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

function sugerirUpsell(produto) {
  const cat = produto.category;
  const arr = DEPOSITO.categories[cat] || [];
  const sorted = arr.slice().sort((a, b) => a.price - b.price);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].code === produto.code && i < sorted.length - 1) {
      return sorted[i + 1];
    }
  }
  return null;
}

// ---- Estado por usuário ----
const usuarios = new Map(); // phone -> { clientName, address }
const estadoPedido = new Map(); // phone -> { step, items, total, ... }

// ---- Funções de catálogo / listas ----
function construirListaCategorias() {
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

function construirTextoCategorias() {
  const cats = Object.keys(DEPOSITO.categories);
  let txt = "📦 *Categorias disponíveis:*\n\n";
  cats.forEach((cat, i) => {
    txt += `${i + 1}️⃣ ${cat}\n`;
  });
  txt += "\nDigite o *número* ou o *nome* da categoria ou clique na opção abaixo.";
  return txt;
}

function construirListaProdutosParaCategoria(catName) {
  const arr = DEPOSITO.categories[catName] || [];
  const rows = arr.map((p, i) => ({ id: `prod_${p.code}`, title: `${i + 1}️⃣ ${p.name}`, description: `${formatarMoeda(p.price)} (atacado)` }));
  return new List(`Produtos — ${catName}`, "Ver produtos", [{ title: catName, rows }], `${DEPOSITO.nome}`, "Escolha um produto");
}

// ---- GDPR / LGPD: apagar dados do usuário (memória) ----
function apagarDadosDoUsuario(phone) {
  const had = usuarios.has(phone) || estadoPedido.has(phone);
  usuarios.delete(phone);
  estadoPedido.delete(phone);
  const now = new Date().toISOString();
  const logLine = `${now},${phone}\n`;
  try {
    fs.appendFileSync(REMOVED_USERS_LOG, logLine, { encoding: "utf8" });
  } catch (e) {
    console.warn("Erro ao registrar remoção:", e?.message || e);
  }
  return had;
}

// ---- FAQ prontas ----
const FAQ = {
  troca: "🔁 *Trocas*: Aceitamos troca de produtos em até 7 dias úteis mediante apresentação do comprovante e produto em perfeito estado. Para iniciar a troca, informe o código do pedido e a razão da troca.",
  devolucao: "↩️ *Devoluções*: Devoluções serão analisadas caso o produto chegue avariado. Envie foto do produto e do lacre. Caso confirmado, reembolso ou troca a combinar.",
  promocoes: "🎉 *Promoções*: Promoções são divulgadas no WhatsApp e nas nossas redes. Pergunte sempre por 'promoções' ou 'ofertas' para ver as atuais."
};

// ---- Cliente WhatsApp ----
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
    const textNorm = removerAcentos(textRaw);
    console.log(`[MSG] from=${from} text="${textRaw}" textNorm="${textNorm}"`);

    // ignorar grupos e mensagens não-whatsapp
    if (!from.endsWith("@c.us")) return;

    // Comando RGPD/LGPD: apagar meus dados
    if (textNorm.match(/\b(apagar_meus_dados|apagar meus dados|apagar_meus_dados)\b/)) {
      const had = apagarDadosDoUsuario(from);
      if (had) {
        await delay(DELAY_CURTO);
        await msg.reply("✅ Seus dados foram removidos da memória do bot. Algumas informações (pedidos antigos) continuam no arquivo de pedidos por segurança e auditoria, mas seu cadastro foi apagado. Para cancelamento completo de backups, contate o responsável.");
      } else {
        await delay(DELAY_CURTO);
        await msg.reply("Não encontrei dados seus salvos na memória do bot. Se quiser, posso verificar registros antigos (contate o responsável).");
      }
      return;
    }

    // Perguntas frequentes (FAQ)
    if (textNorm.match(/\b(troca|trocas)\b/)) {
      await delay(DELAY_CURTO);
      await msg.reply(FAQ.troca);
      return;
    }
    if (textNorm.match(/\b(devoluc|devolução|devolucao)\b/)) {
      await delay(DELAY_CURTO);
      await msg.reply(FAQ.devolucao);
      return;
    }
    if (textNorm.match(/\b(promoc|promoções|promocoes|oferta|ofertas)\b/)) {
      await delay(DELAY_CURTO);
      await msg.reply(FAQ.promocoes);
      return;
    }

    // Se o usuário já está em fluxo de pedido
    if (estadoPedido.has(from)) {
      const estado = estadoPedido.get(from);

      if (estado.step === "aguardando_produto") {
        const qtd = extrairQuantidade(textRaw);
        const prod = buscarProdutoPorNome(textRaw);
        if (prod) {
          const quantidade = qtd || 1;
          estado.items.push({ code: prod.code, name: prod.name, price: prod.price, qty: quantidade, category: prod.category });
          estado.total = estado.items.reduce((s, it) => s + it.price * it.qty, 0);
          estado.step = "confirmar_item";
          estado.pending_upsell = sugerirUpsell(prod);
          estadoPedido.set(from, estado);

          await delay(DELAY_CURTO);
          await msg.reply(`✅ Adicionado: ${prod.name}\nQuantidade: ${quantidade}\nSubtotal: ${formatarMoeda(prod.price * quantidade)}`);

          if (estado.pending_upsell) {
            await delay(DELAY_CURTO);
            await msg.reply(`Sugestão: que tal também *${estado.pending_upsell.name}* por ${formatarMoeda(estado.pending_upsell.price)}? Responda *SIM* para adicionar, *NÃO* para pular.`);
          } else {
            await delay(DELAY_CURTO);
            await msg.reply('Deseja adicionar mais itens? Digite o nome do produto ou *continuar* para seguir.');
          }
          return;
        } else {
          if (textNorm.match(/\b(catalogo|menu|categorias|produtos)\b/)) {
            console.log("Enviando categorias (pedido flow).");
            await client.sendMessage(from, construirTextoCategorias());
            await client.sendMessage(from, construirListaCategorias());
            return;
          }
          await msg.reply("Não encontrei esse produto. Digite o nome exato, use o catálogo ou digite *catálogo* para ver categorias.");
          return;
        }
      }

      if (estado.step === "confirmar_item") {
        if (estado.pending_upsell && textNorm.match(/^(sim|s)$/i)) {
          const up = estado.pending_upsell;
          estado.items.push({ code: up.code, name: up.name, price: up.price, qty: 1, category: up.category });
          estado.total = estado.items.reduce((s, it) => s + it.price * it.qty, 0);
          estado.pending_upsell = null;
          estadoPedido.set(from, estado);
          await msg.reply(`✅ Upsell adicionado: ${up.name} (1 unidade). Deseja adicionar mais? Digite produto ou *continuar*.`);
          return;
        } else if (estado.pending_upsell && textNorm.match(/^(nao|não|n)$/i)) {
          estado.pending_upsell = null;
          estadoPedido.set(from, estado);
          await msg.reply("Ok. Deseja adicionar mais itens? Digite o produto ou *continuar* para avançar.");
          return;
        }

        if (textNorm.match(/\b(continuar|prosseguir|finalizar|ok|confirmar)\b/)) {
          estado.step = "aguardar_endereco";
          estadoPedido.set(from, estado);
          const user = usuarios.get(from);
          if (user && user.address) {
            if (enderecoEmBairroPermitido(user.address)) {
              estado.address = user.address;
              estado.step = "aguardar_pagamento";
              estadoPedido.set(from, estado);
              await msg.reply(`Usando seu endereço cadastrado: ${user.address}\nQual a forma de pagamento? Responda *PIX*, *CARTÃO* ou *DINHEIRO*.`);
              return;
            } else {
              estado.step = "aguardar_endereco_dados";
              estadoPedido.set(from, estado);
              await msg.reply(`Seu endereço cadastrado (${user.address}) parece *fora* da nossa área de entrega. 🚫\nVocê pode digitar *RETIRAR* para retirada na loja ou enviar outro endereço dentro dos bairros atendidos.\n\nBairros: Vila São Roque, Vilinha, Canoeiro, Trizidela, Expoagra, Vila Tucum, Aeroporto, Ronierd Barros, Joana Batista, Conjunto Parque Grajaú, Conjunto Frei Alberto Beretta, Centro, Rodoviária, Extrema.`);
              return;
            }
          } else {
            estado.step = "aguardar_endereco_dados";
            estadoPedido.set(from, estado);
            await msg.reply("Por favor, informe o endereço completo para entrega (Rua, número, bairro, complemento) ou digite *RETIRAR* para retirada na loja.");
            return;
          }
        }

        const maybeProd = buscarProdutoPorNome(textRaw);
        if (maybeProd) {
          estado.step = "aguardando_produto";
          estadoPedido.set(from, estado);
          await client.sendMessage(from, "Detectei um novo produto — adicionando na próxima mensagem.");
          return;
        }

        await msg.reply("Digite o nome de outro produto para adicionar ou *continuar* para avançar.");
        return;
      }

      if (estado.step === "aguardar_endereco_dados") {
        if (textNorm.match(/^retirar|retirada$/i)) {
          estado.address = "RETIRADA NA LOJA";
          estado.step = "aguardar_nome";
          estadoPedido.set(from, estado);
          await msg.reply("Retirada escolhida. Qual o seu nome para o pedido?");
          return;
        }

        const enderecoFornecido = textRaw;
        if (enderecoEmBairroPermitido(enderecoFornecido)) {
          estado.address = enderecoFornecido;
          const prev = usuarios.get(from) || {};
          usuarios.set(from, { clientName: prev.clientName || null, address: enderecoFornecido });
          estado.step = "aguardar_nome";
          estadoPedido.set(from, estado);
          await msg.reply("Endereço válido. Agora me diga seu *nome completo* para finalizar o cadastro do pedido.");
          return;
        } else {
          await msg.reply(`Infelizmente seu endereço não está na nossa área de entrega. 😕\nOpções:\n1️⃣ Envie outro endereço dentro dos bairros atendidos.\n2️⃣ Digite *RETIRAR* para retirar na loja.\n\nBairros atendidos: Vila São Roque, Vilinha, Canoeiro, Trizidela, Expoagra, Vila Tucum, Aeroporto, Ronierd Barros, Joana Batista, Conjunto Parque Grajaú, Conjunto Frei Alberto Beretta, Centro, Rodoviária, Extrema.`);
          estadoPedido.set(from, estado);
          return;
        }
      }

      if (estado.step === "aguardar_nome") {
        estado.client = textRaw;
        const prev = usuarios.get(from) || {};
        usuarios.set(from, { clientName: estado.client, address: estado.address || prev.address || null });
        estado.step = "aguardar_pagamento";
        estadoPedido.set(from, estado);
        await msg.reply("Obrigado! Agora informe a forma de pagamento: *PIX*, *CARTÃO* ou *DINHEIRO*.");
        return;
      }

      if (estado.step === "aguardar_pagamento") {
        const method = textNorm.match(/pix/) ? "PIX" : textNorm.match(/cartao|visa|mastercard/) ? "CARTÃO" : textNorm.match(/dinheiro|troco/) ? "DINHEIRO" : null;
        if (!method) {
          await msg.reply("Forma de pagamento não reconhecida. Digite *PIX*, *CARTÃO* ou *DINHEIRO*.");
          return;
        }
        estado.payment_method = method;
        estado.step = "confirmar_pedido";
        estadoPedido.set(from, estado);

        const itemsTxt = estado.items.map((it, i) => `${i + 1}️⃣ ${it.name} — ${it.qty} x ${formatarMoeda(it.price)} = ${formatarMoeda(it.qty * it.price)}`).join("\n");
        await msg.reply(`🧾 Resumo do pedido:\n${itemsTxt}\n\nTotal: ${formatarMoeda(estado.total)}\nEndereço: ${estado.address}\nPagamento: ${estado.payment_method}\n\nResponda *CONFIRMAR* para finalizar ou *CANCELAR* para abortar.`);
        return;
      }

      if (estado.step === "confirmar_pedido") {
        if (textNorm.match(/^(confirmar|confirmo|sim)$/i)) {
          const orderCode = gerarCodigoPedido();
          const now = new Date().toISOString();
          const orderObj = {
            order_code: orderCode,
            datetime: now,
            client: estado.client || "",
            phone: from,
            address: estado.address || "",
            items: estado.items,
            total: estado.total,
            payment_method: estado.payment_method || "",
            notes: estado.notes || "",
          };
          salvarPedidoCsv(orderObj);

          await msg.reply(`✅ Pedido *${orderCode}* confirmado! Obrigado ${estado.client || ""}. Entraremos em contato para combinar entrega/pagamento.\nTempo estimado: 45-70 minutos.\nDeseja acrescentar mais algo? Digite o produto ou *NÃO* para encerrar.`);

          if (OWNER_NUMBER) {
            const summary = `NOVO PEDIDO ${orderCode}\nDe: ${estado.client || from}\nTel: ${from}\nTotal: ${formatarMoeda(estado.total)}\nEndereço: ${estado.address || "RETIRADA"}\nItens: ${estado.items.map(it => `${it.qty}x ${it.name}`).join(", ")}`;
            try { await client.sendMessage(OWNER_NUMBER, summary); } catch (e) { console.warn("Erro ao notificar owner:", e?.message || e); }
          }

          estadoPedido.set(from, { step: "aguardando_produto", items: [], total: 0, client: estado.client, address: estado.address });
          return;
        } else if (textNorm.match(/^(cancelar|nao|não)$/i)) {
          await msg.reply("Pedido cancelado. Digite *menu* para voltar ao início.");
          estadoPedido.delete(from);
          return;
        } else {
          await msg.reply("Digite *CONFIRMAR* para finalizar ou *CANCELAR* para abortar.");
          return;
        }
      }

    } // fim bloco estadoPedido

    // ---- Comandos gerais / menus (ATACADO apenas) ----
    if (textNorm.match(/^(oi|ola|menu|inicio|comecar|começar)$/i)) {
      const welcome =
`🍻 *Boas-vindas ao ${DEPOSITO.nome}!* 🍻
Eu sou a *Tati*, sua assistente virtual. 🤖✨

O que deseja fazer hoje?
1️⃣ *Atacado* – Compras em volume (preços especiais)
2️⃣ *🕒 Nosso horário* / *📍 Endereço*
3️⃣ *👤 Atendente humano* (falar com alguém)

Digite o número ou a opção (ex: *1* ou *atacado*).`;
      await delay(DELAY_CURTO);
      await msg.reply(welcome);
      return;
    }

    if (textNorm === "1" || textNorm.match(/\b(atacado)\b/)) {
      await delay(DELAY_CURTO);
      await msg.reply("Atacado selecionado. Escolha uma categoria para ver produtos por atacado:");
      await client.sendMessage(from, construirTextoCategorias());
      await client.sendMessage(from, construirListaCategorias());
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

    if (textNorm.match(/\b(catalogo|categorias|produtos|menu categorias)\b/)) {
      console.log("Usuário pediu catálogo; enviando categories text + list.");
      await client.sendMessage(from, construirTextoCategorias());
      await client.sendMessage(from, construirListaCategorias());
      return;
    }

    // aceitar se o usuário digitou o nome da categoria ou o número dela
    const cats = Object.keys(DEPOSITO.categories);
    if (/^\d+$/.test(textRaw.trim())) {
      const idx = parseInt(textRaw.trim(), 10) - 1;
      if (idx >= 0 && idx < cats.length) {
        const catName = cats[idx];
        await client.sendMessage(from, construirListaProdutosParaCategoria(catName));
        return;
      }
    }
    for (const catName of cats) {
      const catNorm = removerAcentos(catName);
      if (textNorm.includes(catNorm) || textNorm === catNorm) {
        console.log(`Usuário digitou categoria: ${catName} (matched by name)`);
        await client.sendMessage(from, construirListaProdutosParaCategoria(catName));
        return;
      }
    }

    // se usuário clicou na List (cat_# ou prod_CODE)
    if (textRaw.startsWith("cat_")) {
      const idx = parseInt(textRaw.split("_")[1], 10);
      const catName = Object.keys(DEPOSITO.categories)[idx];
      if (catName) {
        await client.sendMessage(from, construirListaProdutosParaCategoria(catName));
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
        estadoPedido.set(from, { step: "confirmar_item", items: [{ code: prod.code, name: prod.name, price: prod.price, qty: 1, category: prod.category }], total: prod.price, client: null, address: null });
        await msg.reply(`✅ Adicionado: ${prod.name} — 1 x ${formatarMoeda(prod.price)}\nDeseja adicionar mais itens? Digite o produto ou *continuar* para finalizar.`);
        return;
      }
    }

    // tentar entender mensagens livres (ex: "Quero 3 Skol")
    const talvezQtd = extrairQuantidade(textRaw);
    const talvezProd = buscarProdutoPorNome(textRaw);
    if (talvezProd) {
      estadoPedido.set(from, { step: "confirmar_item", items: [{ code: talvezProd.code, name: talvezProd.name, price: talvezProd.price, qty: talvezQtd || 1, category: talvezProd.category }], total: (talvezQtd || 1) * talvezProd.price, client: null, address: null });
      await msg.reply(`✅ Adicionado: ${talvezProd.name} — ${talvezQtd || 1} x ${formatarMoeda(talvezProd.price)}\nDeseja adicionar mais itens? Digite o produto ou *continuar* para finalizar.`);
      return;
    }

    // iniciar pedido direto
    if (textNorm.match(/\b(fazer pedido|pedir|pedido)\b/)) {
      estadoPedido.set(from, { step: "aguardando_produto", items: [], total: 0, client: null, address: null, payment_method: null, notes: null, pending_upsell: null });
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
