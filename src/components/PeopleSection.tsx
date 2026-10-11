"use client";

import { useState } from "react";
import type { Person, PersonRole } from "@/lib/types";
import PersonModal from "./PersonModal";
import { PhotoStrip } from "./PhotoUploader";
import { Button, Card, Empty, SectionTitle } from "./ui";

/** 旅行社的領隊 / 司機名單 */
export default function PeopleSection({
  role,
  people,
  onChange,
}: {
  role: PersonRole;
  people: Person[];
  onChange: (people: Person[]) => void;
}) {
  const [editing, setEditing] = useState<Person | "new" | null>(null);
  const list = people.filter((p) => p.role === role);

  return (
    <Card>
      <SectionTitle
        right={
          <Button variant="secondary" onClick={() => setEditing("new")}>
            ＋ 新增{role}
          </Button>
        }
      >
        {role === "領隊" ? "🧑‍💼" : "🚍"} {role}（{list.length}）
      </SectionTitle>
      {list.length === 0 ? (
        <Empty>尚未登錄{role}</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {list.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 space-y-1.5">
                <div className="font-medium text-slate-800">{p.name}</div>
                <div className="text-sm text-slate-500">
                  <a href={`tel:${p.phone}`} className="text-brand-700">
                    {p.phone}
                  </a>
                  {p.lineName && <span className="ml-3">LINE：{p.lineName}</span>}
                </div>
                <PhotoStrip photos={p.photos} />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => setEditing(p)}>
                  編輯
                </Button>
                <Button
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => confirm(`刪除${role}「${p.name}」？`) && onChange(people.filter((x) => x.id !== p.id))}
                >
                  刪除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <PersonModal
          role={role}
          person={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(np) => {
            onChange(people.some((x) => x.id === np.id) ? people.map((x) => (x.id === np.id ? np : x)) : [...people, np]);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}
