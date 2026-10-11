"use client";

import { useState } from "react";
import type { Person, PersonRole } from "@/lib/types";
import { uid } from "@/lib/utils";
import PhotoUploader from "./PhotoUploader";
import { Button, Field, Input, Modal } from "./ui";

/** 新增 / 編輯 領隊或司機 */
export default function PersonModal({
  person,
  role,
  onClose,
  onSave,
}: {
  person?: Person;
  role: PersonRole;
  onClose: () => void;
  onSave: (p: Person) => void;
}) {
  const [p, setP] = useState<Person>(person ?? { id: uid("p"), role, name: "", phone: "", lineName: "", photos: [] });

  return (
    <Modal open onClose={onClose} title={`${person ? "編輯" : "新增"}${role}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(p);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${role}姓名`} required>
            <Input required autoFocus value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </Field>
          <Field label="電話" required>
            <Input required type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
          </Field>
          <Field label="LINE 名稱" className="sm:col-span-2">
            <Input value={p.lineName ?? ""} onChange={(e) => setP({ ...p, lineName: e.target.value })} />
          </Field>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">照片（可多張）</span>
          <PhotoUploader photos={p.photos} onChange={(photos) => setP({ ...p, photos })} />
        </div>
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
