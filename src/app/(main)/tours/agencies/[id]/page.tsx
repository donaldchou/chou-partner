"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import AgencyForm from "@/components/AgencyForm";
import PeopleSection from "@/components/PeopleSection";
import PlanSection from "@/components/PlanSection";
import { BookingStatusBadge } from "@/components/BookingBadges";
import { Button, Card, Empty, LinkButton, Loading, NotFound, PageHeader, SectionTitle } from "@/components/ui";
import { actions, useAppState, useLoaded } from "@/lib/store";
import { photoSrc } from "@/lib/upload";
import { formatDateTime, money } from "@/lib/utils";

export default function AgencyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const loaded = useLoaded();
  const { agencies, bookings } = useAppState();
  const a = agencies.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);

  if (!loaded) return <Loading />;
  if (!a) return <NotFound back="/tours/agencies" />;

  if (editing)
    return (
      <div>
        <PageHeader title="編輯旅行社" />
        <AgencyForm
          initial={a}
          onCancel={() => setEditing(false)}
          onSubmit={(na) => {
            actions.saveAgency(na);
            setEditing(false);
          }}
        />
      </div>
    );

  const bs = bookings.filter((b) => b.agencyId === a.id).sort((x, y) => y.datetime.localeCompare(x.datetime));
  const visited = bs.filter((b) => b.status === "已到場");
  // 主要名片（辨識用的那張）排第一
  const cards = [...new Set([a.cardImage, ...(a.cardImages ?? [])].filter((u): u is string => !!u))];

  return (
    <div>
      <PageHeader
        title={`${a.name}-總覽`}
        subtitle={[a.contactName, a.phone, a.lineName && `LINE：${a.lineName}`].filter(Boolean).join("・")}
        back="/tours/agencies"
        actions={<LinkButton href={`/tours/bookings/new?agency=${a.id}`}>＋ 新增採果預約</LinkButton>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <PeopleSection role="領隊" people={a.people} onChange={(people) => actions.saveAgency({ ...a, people })} />
          <PeopleSection role="司機" people={a.people} onChange={(people) => actions.saveAgency({ ...a, people })} />
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
              旅行社資訊
            </SectionTitle>
            <dl className="grid grid-cols-[4rem_1fr] gap-y-2 text-sm">
              <dt className="text-slate-400">地址</dt>
              <dd className="text-slate-700">{a.address || "-"}</dd>
              <dt className="text-slate-400">備註</dt>
              <dd className="text-slate-700">{a.note || "-"}</dd>
              <dt className="text-slate-400">累計</dt>
              <dd className="text-slate-700">
                到場 {visited.length} 團、{visited.reduce((s, b) => s + b.headcount, 0)} 人、營收{" "}
                {money(visited.reduce((s, b) => s + (b.revenue ?? 0), 0))}
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

          <PlanSection plans={a.plans ?? []} onChange={(plans) => actions.saveAgency({ ...a, plans })} />

          <Card>
            <SectionTitle>採果預約紀錄</SectionTitle>
            {bs.length === 0 ? (
              <Empty>尚無預約</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {bs.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/tours/bookings/${b.id}`}
                      className="flex items-center justify-between gap-2 py-2.5 text-sm hover:bg-slate-50"
                    >
                      <span>
                        {formatDateTime(b.datetime)}・{b.headcount} 人{b.county && `・${b.county}`}
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
            onClick={() => {
              if (confirm(`刪除旅行社「${a.name}」？相關預約也會一併刪除。`)) {
                actions.deleteAgency(a.id);
                router.push("/tours/agencies");
              }
            }}
          >
            刪除旅行社
          </Button>
        </div>
      </div>
    </div>
  );
}
