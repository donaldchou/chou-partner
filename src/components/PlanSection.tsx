"use client";

import { useState } from "react";
import type { AgencyPlan } from "@/lib/types";
import { photoSrc } from "@/lib/upload";
import { uid } from "@/lib/utils";
import PhotoUploader, { PhotoStrip } from "./PhotoUploader";
import { Button, Card, Empty, Field, Input, Modal, SectionTitle, Textarea } from "./ui";

/** 員工參考卡用的照片：有指定而且還在照片裡就用它，否則用第一張 */
export const planCardPhoto = (p?: AgencyPlan) => (p?.cardPhoto && p.photos.includes(p.cardPhoto) ? p.cardPhoto : p?.photos[0]);

/** 依群組排好的方案；沒填群組的放最後 */
export function groupPlans(plans: AgencyPlan[]) {
  const map = new Map<string, AgencyPlan[]>();
  for (const p of plans) {
    const g = p.group?.trim() ?? "";
    map.set(g, [...(map.get(g) ?? []), p]);
  }
  return [...map].sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b, "zh-Hant")));
}

/** 旅行社的採果方案（可分群組、合作內容、多張照片） */
export default function PlanSection({ plans, onChange }: { plans: AgencyPlan[]; onChange: (plans: AgencyPlan[]) => void }) {
  const [editing, setEditing] = useState<AgencyPlan | "new" | null>(null);
  const groups = groupPlans(plans);

  return (
    <Card>
      <SectionTitle
        right={
          <Button variant="secondary" onClick={() => setEditing("new")}>
            ＋ 新增方案
          </Button>
        }
      >
        🍊 採果方案（{plans.length}）
      </SectionTitle>
      {plans.length === 0 ? (
        <Empty>尚未建立採果方案</Empty>
      ) : (
        <div className="space-y-4">
          {groups.map(([group, list]) => (
            <div key={group}>
              <div className="mb-1 text-xs font-semibold tracking-wide text-brand-700">{group || "未分群組"}</div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 px-3">
                {list.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      {p.content && <div className="whitespace-pre-line text-sm text-slate-600">{p.content}</div>}
                      <PhotoStrip photos={p.photos} />
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" onClick={() => setEditing(p)}>
                        編輯
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-red-600"
                        onClick={() =>
                          confirm(`刪除方案「${p.name}」？已選這個方案的預約會改成未選方案。`) &&
                          onChange(plans.filter((x) => x.id !== p.id))
                        }
                      >
                        刪除
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <PlanModal
          plan={editing === "new" ? undefined : editing}
          groups={groups.map(([g]) => g).filter(Boolean)}
          onClose={() => setEditing(null)}
          onSave={(np) => {
            onChange(plans.some((x) => x.id === np.id) ? plans.map((x) => (x.id === np.id ? np : x)) : [...plans, np]);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

function PlanModal({
  plan,
  groups,
  onClose,
  onSave,
}: {
  plan?: AgencyPlan;
  groups: string[];
  onClose: () => void;
  onSave: (p: AgencyPlan) => void;
}) {
  const [p, setP] = useState<AgencyPlan>(plan ?? { id: uid("plan"), group: "", name: "", content: "", photos: [] });

  return (
    <Modal open onClose={onClose} title={plan ? "編輯採果方案" : "新增採果方案"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          // 參考卡照片被刪掉的話清空（改用第一張）
          onSave({ ...p, group: p.group?.trim(), cardPhoto: p.cardPhoto && p.photos.includes(p.cardPhoto) ? p.cardPhoto : "" });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="群組">
            <Input
              list="plan-groups"
              placeholder="選擇或輸入新群組"
              value={p.group ?? ""}
              onChange={(e) => setP({ ...p, group: e.target.value })}
            />
            <datalist id="plan-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <Field label="方案名稱" required>
            <Input required autoFocus value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </Field>
          <Field label="合作內容" className="sm:col-span-2">
            <Textarea
              rows={5}
              value={p.content ?? ""}
              onChange={(e) => setP({ ...p, content: e.target.value })}
              placeholder="例如：每人 300 元含採果 1 斤、導覽解說、伴手禮盒 9 折…"
            />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">照片（可多張）</span>
          <PhotoUploader folder="plans" photos={p.photos} onChange={(photos) => setP({ ...p, photos })} />
        </div>
        {p.photos.length > 0 && (
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">員工參考卡照片</span>
            <p className="mb-2 text-xs text-slate-400">點一張照片選擇；沒選的話用第一張</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="員工參考卡照片">
              {p.photos.map((ph) => {
                const on = ph === planCardPhoto(p);
                return (
                  <button
                    key={ph}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setP({ ...p, cardPhoto: ph })}
                    className={`relative h-20 w-20 overflow-hidden rounded-lg border-2 ${
                      on ? "border-brand-600 ring-2 ring-brand-600/30" : "border-slate-200 opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoSrc(ph)} alt="" className="h-full w-full object-cover" />
                    {on && <span className="absolute inset-x-0 bottom-0 bg-brand-600 text-center text-[10px] leading-4 text-white">參考卡</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">儲存</Button>
        </div>
      </form>
    </Modal>
  );
}
