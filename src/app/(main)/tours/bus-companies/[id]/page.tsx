"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import AgencyForm from "@/components/AgencyForm";
import { BookingStatusBadge } from "@/components/BookingBadges";
import PeopleSection from "@/components/PeopleSection";
import { Button, Card, Empty, Loading, NotFound, PageHeader, SectionTitle } from "@/components/ui";
import { actions, useAppState, useLoaded } from "@/lib/store";
import { photoSrc } from "@/lib/upload";
import { formatDateTime } from "@/lib/utils";

export default function BusCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const loaded = useLoaded();
  const { busCompanies, agencies, bookings } = useAppState();
  const c = busCompanies.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);

  if (!loaded) return <Loading />;
  if (!c) return <NotFound back="/tours/bus-companies" />;

  if (editing)
    return (
      <div>
        <PageHeader title="編輯遊覽車公司" />
        <AgencyForm
          label="遊覽車公司"
          notePlaceholder="例如：車型、座位數、配合方式…"
          initial={c}
          onCancel={() => setEditing(false)}
          onSubmit={(nc) => {
            actions.saveBusCompany(nc);
            setEditing(false);
          }}
        />
      </div>
    );

  const bs = bookings.filter((b) => b.busCompanyId === c.id).sort((x, y) => y.datetime.localeCompare(x.datetime));
  const cards = [...new Set([c.cardImage, ...(c.cardImages ?? [])].filter((u): u is string => !!u))];

  return (
    <div>
      <PageHeader
        title={`${c.name}-總覽`}
        subtitle={[c.contactName, c.phone, ...(c.otherPhones ?? []), c.lineName && `LINE：${c.lineName}`].filter(Boolean).join("・")}
        back="/tours/bus-companies"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <PeopleSection role="司機" people={c.people} onChange={(people) => actions.saveBusCompany({ ...c, people })} />
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle
              right={
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  編輯資料
                </Button>
              }
            >
              遊覽車公司資訊
            </SectionTitle>
            <dl className="grid grid-cols-[4rem_1fr] gap-y-2 text-sm">
              <dt className="text-slate-400">地址</dt>
              <dd className="text-slate-700">{c.address || "-"}</dd>
              <dt className="text-slate-400">備註</dt>
              <dd className="whitespace-pre-line text-slate-700">{c.note || "-"}</dd>
              <dt className="text-slate-400">累計</dt>
              <dd className="text-slate-700">
                配合 {bs.filter((b) => b.status === "已到場").length} 團（共 {bs.length} 筆預約）
              </dd>
            </dl>
            {cards.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {cards.map((u) => (
                  <a key={u} href={photoSrc(u)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoSrc(u)} alt="名片" className="max-h-48 rounded-lg border border-slate-200" />
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>採果預約紀錄</SectionTitle>
            {bs.length === 0 ? (
              <Empty>尚無配合的預約</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {bs.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/tours/bookings/${b.id}`}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm hover:bg-slate-50"
                    >
                      <span>
                        {formatDateTime(b.datetime)}・{agencies.find((a) => a.id === b.agencyId)?.name ?? "（已刪除的旅行社）"}・{b.headcount} 人
                      </span>
                      <BookingStatusBadge status={b.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Button
            variant="danger"
            className="w-full"
            onClick={async () => {
              if (!confirm(`刪除遊覽車公司「${c.name}」？採果預約會保留，只是不再顯示這家遊覽車公司。`)) return;
              if (await actions.deleteBusCompany(c.id)) router.push("/tours/bus-companies");
            }}
          >
            刪除遊覽車公司
          </Button>
        </div>
      </div>
    </div>
  );
}
