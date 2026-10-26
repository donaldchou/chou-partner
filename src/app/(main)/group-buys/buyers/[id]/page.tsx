"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import AgencyForm from "@/components/AgencyForm";
import { agencyCity, AgencyStatusBadge, AgencyStatusButton, FruitTourBadge } from "@/components/AgencyStatus";
import GroupBuyerFields, { cleanBuyer, KindBadge, shortLink } from "@/components/GroupBuyerFields";
import { Badge, Button, Card, Empty, LinkButton, Loading, NotFound, PageHeader, SectionTitle } from "@/components/ui";
import { groupBuyQty, groupBuyTotal } from "@/lib/calc";
import { actions, useAppState, useLoaded } from "@/lib/store";
import type { GroupBuyer } from "@/lib/types";
import { photoSrc } from "@/lib/upload";
import { formatDate, money } from "@/lib/utils";

const saveBuyer = (b: GroupBuyer) => actions.saveGroupBuyer(b);
const statusColor = { 洽談中: "amber", 進行中: "green", 已出貨: "blue", 已結案: "gray" } as const;

export default function GroupBuyerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const loaded = useLoaded();
  const { groupBuyers, groupBuys } = useAppState();
  const b = groupBuyers.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);

  if (!loaded) return <Loading />;
  if (!b) return <NotFound back="/group-buys/buyers" />;

  if (editing)
    return (
      <div>
        <PageHeader title="編輯團購業者" />
        <AgencyForm
          label="團購業者"
          phoneRequired={false}
          notePlaceholder="例如：粉絲數、主要客群、合作條件…"
          initial={b}
          extra={(x, patch) => <GroupBuyerFields b={x} patch={patch} />}
          onCancel={() => setEditing(false)}
          onSubmit={(nb) => {
            actions.saveGroupBuyer(cleanBuyer(nb));
            setEditing(false);
          }}
        />
      </div>
    );

  const gs = groupBuys.filter((g) => g.buyerId === b.id).sort((x, y) => y.startDate.localeCompare(x.startDate));
  const cards = [...new Set([b.cardImage, ...(b.cardImages ?? [])].filter((u): u is string => !!u))];
  const links = [b.website, ...(b.links ?? [])].filter((u): u is string => !!u);

  return (
    <div>
      <PageHeader
        title={`${b.name}-總覽`}
        subtitle={[b.contactName, b.phone, ...(b.otherPhones ?? []), b.lineName && `LINE：${b.lineName}`].filter(Boolean).join("・")}
        back="/group-buys/buyers"
        info={
          <>
            <AgencyStatusBadge agency={b} />
            <KindBadge kind={b.kind} />
            {b.fruitDeal && <FruitTourBadge label="有水果團購" />}
          </>
        }
        actions={
          <>
            <AgencyStatusButton agency={b} onSave={saveBuyer} allowDecline />
            <LinkButton href={`/group-buys/new?buyer=${b.id}`}>＋ 新增團購</LinkButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle
            right={
              <Button variant="secondary" onClick={() => setEditing(true)}>
                編輯資料
              </Button>
            }
          >
            團購業者資訊
          </SectionTitle>
          <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm">
            <dt className="text-slate-400">縣市</dt>
            <dd className="text-slate-700">{agencyCity(b) || "-"}</dd>
            <dt className="text-slate-400">地址</dt>
            <dd className="text-slate-700">{b.address || "-"}</dd>
            <dt className="text-slate-400">網站／社群</dt>
            <dd className="min-w-0 break-all">
              {links.length
                ? links.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-brand-700 underline underline-offset-2">
                      {shortLink(u)}
                    </a>
                  ))
                : "-"}
            </dd>
            {b.fruitDeal && (
              <>
                <dt className="text-accent-600">水果團購</dt>
                <dd className="whitespace-pre-line break-all text-accent-600">{b.fruitDeal}</dd>
              </>
            )}
            <dt className="text-slate-400">備註</dt>
            <dd className="whitespace-pre-line text-slate-700">{b.note || "-"}</dd>
            {b.source && (
              <>
                <dt className="text-slate-400">資料來源</dt>
                <dd className="min-w-0 break-all text-xs text-slate-500">
                  {b.source.split(/\s+/).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="block underline underline-offset-2">
                      {u}
                    </a>
                  ))}
                </dd>
              </>
            )}
            <dt className="text-slate-400">累計</dt>
            <dd className="text-slate-700">
              {gs.length} 次團購、{gs.reduce((s, g) => s + groupBuyQty(g), 0)} 件、{money(gs.reduce((s, g) => s + groupBuyTotal(g), 0))}
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

        <div className="space-y-6">
          <Card>
            <SectionTitle>團購紀錄</SectionTitle>
            {gs.length === 0 ? (
              <Empty>尚無團購</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {gs.map((g) => (
                  <li key={g.id}>
                    <Link href={`/group-buys/${g.id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="font-medium text-slate-800">{g.name}</span>
                        <span className="block text-xs text-slate-500">
                          {formatDate(g.startDate)} ~ {formatDate(g.endDate)}・{groupBuyQty(g)} 件・{money(groupBuyTotal(g))}
                        </span>
                      </span>
                      <Badge color={statusColor[g.status]}>{g.status}</Badge>
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
              if (!confirm(`刪除團購業者「${b.name}」？這家開過的團購會保留，只是不再連到這家業者。`)) return;
              if (await actions.deleteGroupBuyer(b.id)) router.push("/group-buys/buyers");
            }}
          >
            刪除團購業者
          </Button>
        </div>
      </div>
    </div>
  );
}
