"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import BookingForm from "@/components/BookingForm";
import { Loading, PageHeader } from "@/components/ui";
import { actions } from "@/lib/store";
import { uid } from "@/lib/utils";

function NewBooking() {
  const router = useRouter();
  const agencyId = useSearchParams().get("agency") ?? "";
  return (
    <BookingForm
      initial={{
        id: uid("b"),
        agencyId,
        datetime: "",
        headcount: 0,
        plate: "",
        county: "",
        buyingPower: "中",
        status: "已預約",
      }}
      onCancel={() => router.back()}
      onSubmit={(b) => {
        actions.saveBooking(b);
        router.push("/tours/bookings");
      }}
    />
  );
}

export default function NewBookingPage() {
  return (
    <div>
      <PageHeader title="新增採果預約" back="/tours/bookings" />
      <Suspense fallback={<Loading />}>
        <NewBooking />
      </Suspense>
    </div>
  );
}
