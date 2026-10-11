import { CustomerModel } from "@/models/customer";
import { OrderModel } from "@/models/order";
import { ProductModel } from "@/models/product";
import { recomputeStats } from "../customer-stats";
import { connectDB } from "../mongodb";
import type { Customer, Product } from "../types";
import { uid } from "../utils";
import type { PriceLookup } from "./word";
import type { ImportOrder } from "./types";

type CustomerDoc = Omit<Customer, "id"> & { _id: string };

export interface ImportSummary {
  orders: { created: number; existing: number; needsReview: number };
  customers: { created: number; updated: number };
  products: number;
}

/** 產品：依代碼合併，每個產季保留一筆價格 */
export async function importProducts(products: Product[]) {
  await connectDB();
  const bySku = new Map<string, Product>();
  for (const p of products) {
    const cur = bySku.get(p.id);
    if (!cur) bySku.set(p.id, { ...p, prices: [...p.prices] });
    else {
      // 較新產季的說明覆蓋舊的
      const newer = Math.max(...p.prices.map((x) => x.season)) >= Math.max(0, ...cur.prices.map((x) => x.season));
      const prices = [...cur.prices.filter((x) => !p.prices.some((y) => y.season === x.season)), ...p.prices];
      bySku.set(p.id, newer ? { ...p, prices } : { ...cur, prices });
    }
  }
  const existing = new Map(((await ProductModel.find().lean()) as unknown as (Product & { _id: string })[]).map((p) => [p._id, p]));
  const ops = [...bySku.values()].map((p) => {
    const old = existing.get(p.id);
    const prices = [...(old?.prices ?? []).filter((x) => !p.prices.some((y) => y.season === x.season)), ...p.prices].sort(
      (a, b) => a.season - b.season,
    );
    const { id, ...rest } = p;
    return { updateOne: { filter: { _id: id }, update: { $set: { ...rest, prices } }, upsert: true } };
  });
  if (ops.length) await ProductModel.bulkWrite(ops);
  return ops.length;
}

/** 產季價格表（Word 訂單沒寫單價時用來估算） */
export async function loadPriceLookup(): Promise<PriceLookup> {
  await connectDB();
  return priceLookupFrom((await ProductModel.find().lean()) as unknown as Product[]);
}

export function priceLookupFrom(products: Product[]): PriceLookup {
  return (product, pieces, season) => {
    const candidates = products.filter(
      (p) => p.category === product && p.pieces === pieces && (p.brand === "donald" || p.brand === "kaki"),
    );
    for (const p of candidates) {
      const exact = p.prices.find((x) => x.season === season);
      if (exact?.salePrice) return exact.salePrice;
    }
    // 沒有同產季價格時，用最接近的產季
    const all = candidates.flatMap((p) => p.prices).sort((a, b) => Math.abs(a.season - season) - Math.abs(b.season - season));
    return all[0]?.salePrice || undefined;
  };
}

/**
 * 寫入匯入的訂單：
 * - 已經匯入過（legacy.key 相同）的訂單略過，不會覆蓋人工修改過的資料
 * - 客戶依電話合併；沒有電話時依「姓名 + 地址」合併
 * - 最後重算相關客戶的統計
 */
export async function importOrders(orders: ImportOrder[], onProgress?: (msg: string) => void): Promise<ImportSummary> {
  await connectDB();
  const log = onProgress ?? (() => {});

  // 同一批裡重複的訂單（例如快照檔與年度檔）：保留後面讀到的版本
  const byKey = new Map<string, ImportOrder>();
  for (const o of orders) byKey.set(o.legacy.key, o);
  const keys = [...byKey.keys()];

  const existingKeys = new Set<string>();
  for (let i = 0; i < keys.length; i += 5000) {
    const found = (await OrderModel.find({ "legacy.key": { $in: keys.slice(i, i + 5000) } })
      .select("legacy.key")
      .lean()) as unknown as { legacy: { key: string } }[];
    found.forEach((f) => existingKeys.add(f.legacy.key));
  }
  const fresh = [...byKey.values()].filter((o) => !existingKeys.has(o.legacy.key)).sort((a, b) => a.orderedAt.localeCompare(b.orderedAt));
  log(`待匯入 ${fresh.length} 筆（已存在 ${existingKeys.size} 筆）`);

  // 載入既有客戶，建立電話索引
  const customers = new Map<string, CustomerDoc>();
  for (const c of (await CustomerModel.find().lean()) as unknown as CustomerDoc[]) customers.set(c._id, c);
  const byPhone = new Map<string, string>();
  const byNameAddr = new Map<string, string>();
  const index = (c: CustomerDoc) => {
    c.phones.forEach((p) => p.digits && byPhone.set(p.digits, c._id));
    c.addresses.forEach((a) => byNameAddr.set(`${c.name}|${a.address}`, c._id));
  };
  customers.forEach(index);

  const created = new Set<string>();
  const touched = new Set<string>();
  const lastSeen = new Map<string, string>();

  const usedOrderNos = new Set(
    (
      (await OrderModel.find({ orderNo: { $in: fresh.map((o) => o.orderNo) } })
        .select("orderNo")
        .lean()) as unknown as { orderNo: string }[]
    ).map((o) => o.orderNo),
  );

  const docs = fresh.map((o) => {
    const h = o.customerHint;
    let cid = h.phones.map((p) => byPhone.get(p.digits)).find(Boolean);
    if (!cid && !h.phones.length && h.address) cid = byNameAddr.get(`${h.name}|${h.address.address}`);

    if (!cid) {
      cid = uid("c");
      const c: CustomerDoc = {
        _id: cid,
        name: h.name || "（未填姓名）",
        company: h.company ?? "",
        title: "",
        gender: h.gender ?? "",
        phones: [],
        emails: [],
        lineName: "",
        addresses: [],
        sources: [],
        tags: [],
        stats: { orderCount: 0, totalSpent: 0, firstOrderAt: "", lastOrderAt: "", lastProduct: "" },
        cardImage: "",
        note: "",
        createdAt: o.orderedAt.slice(0, 10),
      };
      customers.set(cid, c);
      created.add(cid);
    }
    const c = customers.get(cid)!;
    touched.add(cid);

    // 合併客戶資料：電話、Email、地址、通路累加；姓名用最近一次訂單的
    for (const p of h.phones) if (!c.phones.some((x) => x.digits === p.digits)) c.phones.push(p);
    for (const e of h.emails) if (e && !c.emails.includes(e)) c.emails.push(e);
    if (h.address?.address) {
      const a = c.addresses.find((x) => x.address === h.address!.address);
      if (a) a.lastUsedAt = o.orderedAt;
      else c.addresses.push({ ...h.address });
    }
    if (!c.sources.includes(h.source)) c.sources.push(h.source);
    if (h.lineName && !c.lineName) c.lineName = h.lineName;
    if (h.company && !c.company) c.company = h.company;
    if (h.gender && !c.gender) c.gender = h.gender;
    if (h.name && o.orderedAt >= (lastSeen.get(cid) ?? "")) {
      c.name = h.name;
      lastSeen.set(cid, o.orderedAt);
    }
    index(c);

    // 訂單編號重複時加上流水號
    let orderNo = o.orderNo;
    for (let n = 2; usedOrderNos.has(orderNo); n++) orderNo = `${o.orderNo}-${n}`;
    usedOrderNos.add(orderNo);

    const { customerHint: _hint, ...order } = o;
    void _hint;
    return {
      ...order,
      _id: uid("o"),
      orderNo,
      customerId: cid,
      legacy: { ...o.legacy, importedAt: new Date().toISOString().slice(0, 16) },
    };
  });

  // 地址依最近使用排序，最多保留 10 筆
  for (const id of touched) {
    const c = customers.get(id)!;
    c.addresses = c.addresses.sort((a, b) => (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "")).slice(0, 10);
  }

  const newCustomers = [...created].map((id) => customers.get(id)!);
  for (let i = 0; i < newCustomers.length; i += 1000) {
    await CustomerModel.insertMany(newCustomers.slice(i, i + 1000), { ordered: false });
    log(`新增客戶 ${Math.min(i + 1000, newCustomers.length)}/${newCustomers.length}`);
  }
  const updatedIds = [...touched].filter((id) => !created.has(id));
  if (updatedIds.length) {
    await CustomerModel.bulkWrite(
      updatedIds.map((id) => {
        const { _id, ...rest } = customers.get(id)!;
        const { stats: _s, tags: _t, ...fields } = rest;
        void _s;
        void _t;
        return { updateOne: { filter: { _id }, update: { $set: fields } } };
      }),
    );
  }

  for (let i = 0; i < docs.length; i += 1000) {
    await OrderModel.insertMany(docs.slice(i, i + 1000), { ordered: true });
    log(`寫入訂單 ${Math.min(i + 1000, docs.length)}/${docs.length}`);
  }

  log("重算客戶統計…");
  await recomputeStats([...touched]);

  return {
    orders: { created: docs.length, existing: existingKeys.size, needsReview: docs.filter((d) => d.legacy.needsReview).length },
    customers: { created: created.size, updated: updatedIds.length },
    products: 0,
  };
}
