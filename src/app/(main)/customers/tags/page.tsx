"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, Empty, Input, PageHeader } from "@/components/ui";
import { actions, customersApi, useAppState, useLoaded } from "@/lib/store";
import type { CustomerTag } from "@/lib/types";
import { useFetch } from "@/lib/use-fetch";
import { uid } from "@/lib/utils";

/** 標籤管理：編輯客戶時「標籤」的快速按鈕。客戶身上的標籤是文字，刪除選項不會從客戶身上拿掉 */
export default function CustomerTagsPage() {
  const { customerTags } = useAppState();
  const loaded = useLoaded();
  const [name, setName] = useState("");

  // 每個標籤有幾位客戶（含無效客戶）
  const names = customerTags.map((t) => t.name);
  const { data: counts, reload: reloadCounts } = useFetch(`tag-counts:${names.join("|")}`, async () =>
    Object.fromEntries(
      await Promise.all(names.map(async (n) => [n, (await customersApi.list({ tag: n, status: "all", limit: 1 })).total] as const)),
    ),
  );

  async function add() {
    const n = name.trim();
    if (!n) return;
    if (names.includes(n)) return alert(`已經有「${n}」這個標籤`);
    const order = Math.max(0, ...customerTags.map((t) => t.order)) + 1;
    if (await actions.saveCustomerTag({ id: uid("t"), name: n, order })) setName("");
  }

  // 和上一個／下一個交換後，依位置重新編號 1、2、3…，只存有變的
  function move(i: number, dir: -1 | 1) {
    const list = [...customerTags];
    if (!list[i + dir]) return;
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    list.forEach((t, k) => {
      if (t.order !== k + 1) void actions.saveCustomerTag({ ...t, order: k + 1 });
    });
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="標籤管理" subtitle="編輯客戶資料時，標籤會依這裡的順序顯示成可複選的按鈕" back="/customers" />

      <Card className="mb-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="新標籤名稱，例如：獅子會" className="flex-1" />
          <Button type="submit" disabled={!name.trim()}>
            ＋ 新增標籤
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate-400">「回購客」會依訂單數自動標記，不需要在這裡新增。</p>
      </Card>

      {loaded && customerTags.length === 0 ? (
        <Empty>還沒有標籤，從上方新增第一個</Empty>
      ) : (
        <Card className="divide-y divide-slate-100 p-0">
          {customerTags.map((t, i) => (
            <TagRow
              key={t.id}
              tag={t}
              count={counts?.[t.name]}
              first={i === 0}
              last={i === customerTags.length - 1}
              onMove={(dir) => move(i, dir)}
              onRenamed={reloadCounts}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

function TagRow({
  tag,
  count,
  first,
  last,
  onMove,
  onRenamed,
}: {
  tag: CustomerTag;
  count?: number;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);

  async function rename() {
    const n = name.trim();
    if (!n || n === tag.name) return setEditing(false);
    const msg = count ? `改名後，${count} 位客戶身上的「${tag.name}」也會一起改成「${n}」。確定嗎？` : "";
    if (msg && !confirm(msg)) return;
    if (await actions.saveCustomerTag({ ...tag, name: n })) {
      setEditing(false);
      // 後端改完客戶身上的標籤後才重新數，否則會先數到 0
      onRenamed();
    }
  }

  async function remove() {
    const msg = count
      ? `確定刪除「${tag.name}」？\n刪除後不再出現在快速按鈕，但已經貼了這個標籤的 ${count} 位客戶會保留這個標籤。`
      : `確定刪除「${tag.name}」？`;
    if (confirm(msg)) await actions.deleteCustomerTag(tag.id);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3">
      <div className="flex flex-col">
        <button type="button" disabled={first} onClick={() => onMove(-1)} className="text-slate-400 hover:text-brand-700 disabled:opacity-30" aria-label="上移">
          <ArrowUp size={16} />
        </button>
        <button type="button" disabled={last} onClick={() => onMove(1)} className="text-slate-400 hover:text-brand-700 disabled:opacity-30" aria-label="下移">
          <ArrowDown size={16} />
        </button>
      </div>

      {editing ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void rename();
          }}
        >
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
          <Button type="submit">儲存</Button>
          <Button
            variant="ghost"
            onClick={() => {
              setName(tag.name);
              setEditing(false);
            }}
          >
            取消
          </Button>
        </form>
      ) : (
        <>
          <span className="rounded-full bg-accent-500 px-3 py-1 text-sm text-white">{tag.name}</span>
          <Link href={`/customers?tag=${encodeURIComponent(tag.name)}`} className="flex-1 text-sm text-slate-500 hover:text-brand-700 hover:underline">
            {count === undefined ? "…" : `${count.toLocaleString()} 位客戶`}
          </Link>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            改名
          </Button>
          <Button variant="danger" onClick={() => void remove()}>
            刪除
          </Button>
        </>
      )}
    </div>
  );
}
