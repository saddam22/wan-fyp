import { fixtures, formatDate } from "@edukhata/contracts";
import { Card, PageHeader, Stars } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function MentorReviews() {
  const { lang } = await getT();
  const m = fixtures.meMentor;
  const mine = fixtures.reviews.filter((r) => r.mentorId === m.id);
  const dist = [5, 4, 3, 2, 1].map(
    (s) => [s, s === 5 ? 82 : s === 4 ? 14 : s === 3 ? 3 : 1] as const,
  );
  return (
    <>
      <PageHeader
        title="Reviews"
        sub="Only students with a completed order can review. Moderators check reviews before publishing."
      />
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit p-5 text-center">
          <p className="text-5xl font-extrabold">{m.rating}</p>
          <div className="mt-1 flex justify-center">
            <Stars rating={m.rating} showValue={false} />
          </div>
          <p className="text-sm text-muted">{m.reviewCount} reviews</p>
          <ul className="mt-4 space-y-1.5 text-left text-xs">
            {dist.map(([s, p]) => (
              <li key={s} className="flex items-center gap-2">
                <span className="w-6">{s}★</span>
                <span className="h-2 flex-1 rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${p}%` }}
                  />
                </span>
                <span className="w-8 text-right">{p}%</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <ul className="divide-y divide-line">
            {mine.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{r.studentName}</p>
                  <Stars rating={r.rating} showValue={false} size={12} />
                </div>
                <p className="mt-1 text-sm text-slate-700">{r.text}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {r.orderCode} · {formatDate(r.at, lang)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
