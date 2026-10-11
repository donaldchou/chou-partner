"use client";

import { useParams, useRouter } from "next/navigation";
import BookingForm from "@/components/BookingForm";
import { Button, Loading, NotFound, PageHeader } from "@/components/ui";
import { actions, useAppState, useLoaded } from "@/lib/store";

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const loaded = useLoaded();
  const b = useAppState().bookings.find((x) => x.id === id);

  if (!loaded) return <Loading />;
  if (!b) return <NotFound back="/tours/bookings" />;

  return (
    <div>
      <PageHeader
        title="採果預約詳情"
        back="/tours/bookings"
        actions={
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("確定刪除這筆預約？")) {
                actions.deleteBooking(b.id);
                router.push("/tours/bookings");
              }
            }}
          >
            刪除預約
          </Button>
        }
      />
      <BookingForm
        key={b.id}
        initial={b}
        isEdit
        onCancel={() => router.push("/tours/bookings")}
        onSubmit={(nb) => {
          actions.saveBooking(nb);
          router.push("/tours/bookings");
        }}
      />
    </div>
  );
}
