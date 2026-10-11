"use client";

import Link from "next/link";
import { useState } from "react";
import { actions, useAppState } from "@/lib/store";
import type { Booking, BookingStatus, BuyingPower, Person, PersonRole } from "@/lib/types";
import { cn, COUNTIES } from "@/lib/utils";
import PersonModal from "./PersonModal";
import { PhotoStrip } from "./PhotoUploader";
import { Button, Card, Field, Input, Select, SectionTitle, Textarea } from "./ui";

const POWER: { v: BuyingPower; desc: string }[] = [
  { v: "高", desc: "預期每人購買 2 盒以上" },
  { v: "中", desc: "約每人 1 盒" },
  { v: "低", desc: "以體驗採果為主" },
];

export default function BookingForm({
  initial,
  isEdit,
  onSubmit,
  onCancel,
}: {
  initial: Booking;
  isEdit?: boolean;
  onSubmit: (b: Booking) => void;
  onCancel: () => void;
}) {
  const { agencies } = useAppState();
  const [b, setB] = useState(initial);
  const [adding, setAdding] = useState<PersonRole | null>(null);
  const set = <K extends keyof Booking>(k: K, v: Booking[K]) => setB((p) => ({ ...p, [k]: v }));

  const agency = agencies.find((a) => a.id === b.agencyId);
  const leaders = agency?.people.filter((p) => p.role === "領隊") ?? [];
  const drivers = agency?.people.filter((p) => p.role === "司機") ?? [];
  const leader = leaders.find((p) => p.id === b.leaderId);
  const driver = drivers.find((p) => p.id === b.driverId);

  function addPerson(p: Person) {
    if (!agency) return;
    actions.saveAgency({ ...agency, people: [...agency.people, p] });
    set(p.role === "領隊" ? "leaderId" : "driverId", p.id);
    setAdding(null);
  }

  return (
    <>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(b);
        }}
      >
        <Card>
          <SectionTitle>旅行社與時間</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="旅行社" required className="sm:col-span-2">
              <div className="flex gap-2">
                <Select
                  required
                  value={b.agencyId}
                  onChange={(e) => setB((p) => ({ ...p, agencyId: e.target.value, leaderId: undefined, driverId: undefined }))}
                >
                  <option value="">請選擇旅行社</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                <Link
                  href="/tours/agencies/new"
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  ＋ 新旅行社
                </Link>
              </div>
            </Field>
            <Field label="預約時間" required>
              <Input type="datetime-local" required value={b.datetime} onChange={(e) => set("datetime", e.target.value)} />
            </Field>
            <Field label="總人數" required>
              <Input type="number" min={1} required value={b.headcount || ""} onChange={(e) => set("headcount", Number(e.target.value))} />
            </Field>
          </div>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <PersonPicker
            role="領隊"
            disabled={!agency}
            options={leaders}
            value={b.leaderId}
            selected={leader}
            onChange={(id) => set("leaderId", id)}
            onAdd={() => setAdding("領隊")}
          />
          <PersonPicker
            role="司機"
            disabled={!agency}
            options={drivers}
            value={b.driverId}
            selected={driver}
            onChange={(id) => set("driverId", id)}
            onAdd={() => setAdding("司機")}
          >
            <Field label="車牌號碼" required className="mt-4">
              <Input required placeholder="例：KAA-1234" value={b.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} />
            </Field>
          </PersonPicker>
        </div>

        <Card>
          <SectionTitle>客群資訊</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="客戶居住縣市" required>
              <Select required value={b.county} onChange={(e) => set("county", e.target.value)}>
                <option value="">請選擇</option>
                {COUNTIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">購買力</span>
              <div className="grid grid-cols-3 gap-2">
                {POWER.map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => set("buyingPower", p.v)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-center",
                      b.buyingPower === p.v
                        ? "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <div className="font-semibold">{p.v}</div>
                    <div className="text-[11px] leading-tight text-slate-500">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <Field label="購買力描述" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={b.buyingPowerNote ?? ""}
                onChange={(e) => set("buyingPowerNote", e.target.value)}
                placeholder="例如：退休公教團、上次平均每人買 2 盒、偏好禮盒…"
              />
            </Field>
            <Field label="其他備註" className="sm:col-span-2">
              <Textarea rows={2} value={b.note ?? ""} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </div>
        </Card>

        {isEdit && (
          <Card>
            <SectionTitle>到場結果</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="狀態">
                <Select value={b.status} onChange={(e) => set("status", e.target.value as BookingStatus)}>
                  <option>已預約</option>
                  <option>已到場</option>
                  <option>已取消</option>
                </Select>
              </Field>
              <Field label="當日營收（元）">
                <Input
                  type="number"
                  min={0}
                  value={b.revenue ?? ""}
                  onChange={(e) => set("revenue", e.target.value ? Number(e.target.value) : undefined)}
                />
              </Field>
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit">{isEdit ? "儲存變更" : "建立預約"}</Button>
        </div>
      </form>
      {/* 放在 form 外面，避免巢狀 form */}
      {adding && <PersonModal role={adding} onClose={() => setAdding(null)} onSave={addPerson} />}
    </>
  );
}

function PersonPicker({
  role,
  disabled,
  options,
  value,
  selected,
  onChange,
  onAdd,
  children,
}: {
  role: PersonRole;
  disabled: boolean;
  options: Person[];
  value?: string;
  selected?: Person;
  onChange: (id: string | undefined) => void;
  onAdd: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <SectionTitle
        right={
          <Button variant="ghost" disabled={disabled} onClick={onAdd} className="text-brand-700">
            ＋ 新{role}
          </Button>
        }
      >
        {role}
      </SectionTitle>
      <Select disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{disabled ? "請先選擇旅行社" : `選擇${role}`}</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}（{p.phone}）
          </option>
        ))}
      </Select>
      {selected && (
        <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
          <div>
            <span className="font-medium text-slate-800">{selected.name}</span>
            <a href={`tel:${selected.phone}`} className="ml-2 text-brand-700">
              {selected.phone}
            </a>
          </div>
          <div className="text-slate-500">LINE：{selected.lineName || "-"}</div>
          <PhotoStrip photos={selected.photos} />
        </div>
      )}
      {children}
    </Card>
  );
}
