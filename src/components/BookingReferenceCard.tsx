"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { useAppState } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { formatDateTime, weekday } from "@/lib/utils";
import { PhotoThumb } from "./PhotoUploader";
import { planCardPhoto } from "./PlanSection";
import { Button, Modal, PrintArea, SaveJpgButton } from "./ui";

/** 採果接待工作單：給員工看今天哪一團、幾個人、走哪個方案 */
export default function BookingReferenceCard({ booking: b, onClose }: { booking: Booking; onClose: () => void }) {
  const { agencies, busCompanies } = useAppState();
  const a = agencies.find((x) => x.id === b.agencyId);
  const bus = busCompanies.find((x) => x.id === b.busCompanyId);
  const leader = a?.people.find((p) => p.id === b.leaderId);
  const driver = [...(a?.people ?? []), ...(bus?.people ?? [])].find((p) => p.id === b.driverId);
  const plan = a?.plans?.find((p) => p.id === b.planId);
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <Modal
      open
      onClose={onClose}
      title="員工參考卡"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            關閉
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={16} /> 列印／存成 PDF
          </Button>
          <SaveJpgButton target={cardRef} filename={`採果接待單_${a?.name ?? ""}_${b.datetime.slice(0, 10)}`} />
        </>
      }
    >
      <PrintArea ref={cardRef} className="space-y-4 rounded-xl border-2 border-brand-600 bg-white p-5 text-slate-800">
        <div>
          <div className="text-xs text-slate-500">採果接待單</div>
          <div className="text-xl font-bold">{a?.name ?? "（已刪除的旅行社）"}</div>
          <div className="text-sm text-slate-600">
            到場時間：{formatDateTime(b.datetime)}（{weekday(b.datetime)}）
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="col-span-2 rounded-lg bg-brand-50 p-2 text-base">
            <b>總人數：</b>
            {b.headcount} 人
          </div>
          <div>
            <b>領隊：</b>
            {leader ? `${leader.name} ${leader.phone}` : "—"}
          </div>
          <div>
            <b>司機：</b>
            {driver ? `${driver.name} ${driver.phone}` : "—"}
          </div>
          <div className="col-span-2">
            <b>遊覽車公司：</b>
            {bus ? [bus.name, bus.phone].join(" ") : "—"}
          </div>
          <div>
            <b>車牌：</b>
            {b.plate || "—"}
          </div>
          <div>
            <b>客群來自：</b>
            {b.county || "—"}
          </div>
          <div className="col-span-2">
            <b>購買力：</b>
            {b.buyingPower}
            {b.buyingPowerNote && `（${b.buyingPowerNote}）`}
          </div>
        </div>

        <div>
          <div className="mb-1 text-sm font-semibold">採果方案</div>
          {plan ? (
            <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-2">
              <PhotoThumb src={planCardPhoto(plan)} photos={plan.photos} />
              <div className="min-w-0 text-sm">
                {plan.group && <div className="text-xs font-semibold text-brand-700">{plan.group}</div>}
                <div className="text-base font-semibold">{plan.name}</div>
                {plan.content && <div className="mt-1 whitespace-pre-line text-slate-700">{plan.content}</div>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">未選方案</p>
          )}
        </div>

        {/* 保留輸入時的換行 */}
        {b.note && (
          <div className="whitespace-pre-line text-sm text-red-600">
            <b>注意事項：</b>
            {"\n"}
            {b.note}
          </div>
        )}
      </PrintArea>
      <p className="mt-3 text-xs text-slate-500">可列印、存成 PDF 或 JPG 後透過 LINE 傳給員工。</p>
    </Modal>
  );
}
