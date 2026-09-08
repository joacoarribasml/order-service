let state = null;

async function loadState() {
  const res = await fetch("/api/state");
  state = await res.json();
  renderStockGrid();
  renderCustomers();
  renderOrders();
}

function renderStockGrid() {
  const el = document.getElementById("stock-grid");
  const { warehouses, products, stock } = state;
  const qtyByKey = new Map(stock.map((s) => [`${s.warehouseId}:${s.productId}`, s.quantity]));

  let html = "<table><thead><tr><th class='row-head'>Warehouse</th>";
  for (const p of products) {
    html += `<th title="${p.name}">${p.sku}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (const w of warehouses) {
    html += `<tr><td class="row-head">${w.name}</td>`;
    for (const p of products) {
      const qty = qtyByKey.get(`${w.id}:${p.id}`);
      if (qty === undefined) {
        html += "<td>&mdash;</td>";
      } else {
        const cls = qty === 0 ? "qty-zero" : qty <= 10 ? "qty-low" : "";
        html += `<td class="${cls}">${qty}</td>`;
      }
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  el.innerHTML = html;
}

function renderCustomers() {
  const el = document.getElementById("customer");
  const selected = el.value;
  el.innerHTML = state.customers.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  if (selected) el.value = selected;
}

function renderOrders() {
  const el = document.getElementById("orders-list");
  if (state.orders.length === 0) {
    el.innerHTML = "<p>No orders yet.</p>";
    return;
  }
  let html =
    "<table class='orders-table'><thead><tr><th>#</th><th>Customer</th><th>Warehouse</th><th>Items</th><th>Total</th><th>Payment</th></tr></thead><tbody>";
  for (const o of state.orders) {
    html += `<tr><td>${o.id}</td><td>${o.customerName}</td><td>${o.warehouseName}</td><td>${o.itemCount}</td><td>$${(o.totalCents / 100).toFixed(2)}</td><td>${o.paymentId.slice(0, 8)}&hellip;</td></tr>`;
  }
  html += "</tbody></table>";
  el.innerHTML = html;
}

function addItemRow(preset) {
  const container = document.getElementById("items");
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <select class="item-product">${state.products.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}</select>
    <input class="item-qty" type="number" min="1" value="1" />
    <button type="button" class="remove-item">&times;</button>
  `;
  if (preset) {
    row.querySelector(".item-product").value = preset.productId;
    row.querySelector(".item-qty").value = preset.quantity;
  }
  row.querySelector(".remove-item").addEventListener("click", () => {
    if (container.children.length > 1) row.remove();
  });
  container.appendChild(row);
}

function setItems(items) {
  document.getElementById("items").innerHTML = "";
  for (const item of items) addItemRow(item);
}

// SKUs, not raw ids, so this stays correct even if the seed order ever changes.
const SCENARIOS = {
  happy: {
    city: "Los Angeles",
    card: "4242424242424242",
    items: [{ sku: "TAPE-ELEC", quantity: 1 }],
  },
  "closest-eligible": {
    city: "Los Angeles",
    card: "4242424242424242",
    items: [
      { sku: "PVC-034-10", quantity: 1 },
      { sku: "PVC-90-034", quantity: 1 },
      { sku: "BRK-2P-40A", quantity: 1 },
    ],
  },
  "cannot-fulfill": {
    city: "Los Angeles",
    card: "4242424242424242",
    items: [
      { sku: "RMC-034-10", quantity: 1 },
      { sku: "PVC-TA-034", quantity: 1 },
      { sku: "PVC-90-034", quantity: 1 },
      { sku: "BRK-2P-40A", quantity: 1 },
    ],
  },
  declined: {
    city: "Los Angeles",
    card: "4000000000000002",
    items: [{ sku: "TAPE-ELEC", quantity: 1 }],
  },
};

function applyScenario(name) {
  const scenario = SCENARIOS[name];
  const skuToId = new Map(state.products.map((p) => [p.sku, p.id]));

  document.getElementById("city").value = scenario.city;
  document.getElementById("card").value = scenario.card;
  setItems(scenario.items.map((i) => ({ productId: skuToId.get(i.sku), quantity: i.quantity })));
}

function collectItems() {
  return [...document.querySelectorAll(".item-row")].map((row) => ({
    productId: Number(row.querySelector(".item-product").value),
    quantity: Number(row.querySelector(".item-qty").value),
  }));
}

async function submitOrder(event) {
  event.preventDefault();
  const submitBtn = document.getElementById("submit");
  submitBtn.disabled = true;

  const body = {
    customerId: Number(document.getElementById("customer").value),
    shippingAddress: {
      line1: "123 Main St",
      city: document.getElementById("city").value,
      region: "NA",
      postalCode: "00000",
      country: "US",
    },
    items: collectItems(),
    payment: { cardNumber: document.getElementById("card").value },
  };

  const resultEl = document.getElementById("result");
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    resultEl.className = res.ok ? "ok" : "err";
    resultEl.textContent = `HTTP ${res.status}\n${text}`;
  } catch (err) {
    resultEl.className = "err";
    resultEl.textContent = String(err);
  } finally {
    submitBtn.disabled = false;
    await loadState();
  }
}

document.getElementById("add-item").addEventListener("click", () => addItemRow());
document.getElementById("order-form").addEventListener("submit", submitOrder);
document.querySelectorAll(".scenario").forEach((btn) => {
  btn.addEventListener("click", () => applyScenario(btn.dataset.scenario));
});

loadState().then(() => addItemRow());
