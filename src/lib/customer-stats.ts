import { CustomerModel } from "@/models/customer";
import { OrderModel } from "@/models/order";

/** 依 orders 重算客戶的訂單數、累計金額、最近購買（已取消的訂單不算） */
export async function recomputeStats(customerIds: string[]) {
  const ids = [...new Set(customerIds.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 2000) {
    const chunk = ids.slice(i, i + 2000);
    const rows = (await OrderModel.aggregate([
      { $match: { customerId: { $in: chunk }, status: { $ne: "已取消" } } },
      { $sort: { orderedAt: 1 } },
      {
        $group: {
          _id: "$customerId",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$amounts.total" },
          firstOrderAt: { $first: "$orderedAt" },
          lastOrderAt: { $last: "$orderedAt" },
          lastItems: { $last: "$items" },
        },
      },
    ])) as {
      _id: string;
      orderCount: number;
      totalSpent: number;
      firstOrderAt: string;
      lastOrderAt: string;
      lastItems: { product: string; spec: string }[];
    }[];
    const byId = new Map(rows.map((r) => [r._id, r]));

    await CustomerModel.bulkWrite(
      chunk.map((id) => {
        const r = byId.get(id);
        const first = r?.lastItems?.[0];
        return {
          updateOne: {
            filter: { _id: id },
            update: [
              {
                $set: {
                  stats: {
                    orderCount: r?.orderCount ?? 0,
                    totalSpent: r?.totalSpent ?? 0,
                    firstOrderAt: r?.firstOrderAt ?? "",
                    lastOrderAt: r?.lastOrderAt ?? "",
                    lastProduct: first ? `${first.product} ${first.spec}`.trim() : "",
                  },
                  // 「回購客」標籤跟著訂單數自動加上／拿掉，其他標籤保留
                  tags: {
                    $let: {
                      vars: { others: { $setDifference: [{ $ifNull: ["$tags", []] }, ["回購客"]] } },
                      in: (r?.orderCount ?? 0) >= 2 ? { $concatArrays: ["$$others", ["回購客"]] } : "$$others",
                    },
                  },
                },
              },
            ],
          },
        };
      }),
    );
  }
}
