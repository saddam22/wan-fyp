import Link from "next/link";
import { fixtures } from "@edukhata/contracts";
import { QrProfileCard } from "@/components/dash/mentor";
import { Button, Card, CardHeader, Field, PageHeader } from "@/components/ui";
import { SITE_URL } from "@/lib/site";
import { subjectName } from "@/lib/labels";

export default function MentorProfilePage() {
  const m = fixtures.meMentor;
  return (
    <>
      <PageHeader
        title="Profile"
        sub="What students see on your public profile."
        actions={
          <Link
            href={`/mentors/${m.handle}`}
            className="text-sm font-semibold text-mentor hover:underline"
          >
            View public profile →
          </Link>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title="Public details" />
          <form className="space-y-4 p-5">
            <Field label="Headline" htmlFor="mp-h">
              <input id="mp-h" className="input" defaultValue={m.headline} />
            </Field>
            <Field label="About" htmlFor="mp-b">
              <textarea id="mp-b" rows={5} className="input" defaultValue={m.bio} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Education" htmlFor="mp-e">
                <input id="mp-e" className="input" defaultValue={m.education} />
              </Field>
              <Field label="Institution" htmlFor="mp-i">
                <input id="mp-i" className="input" defaultValue={m.institution} />
              </Field>
              <Field label="Languages" htmlFor="mp-l">
                <input id="mp-l" className="input" defaultValue={m.languages.join(", ")} />
              </Field>
              <Field
                label="Subjects"
                htmlFor="mp-s"
                hint="Adding a subject requires its skill test."
              >
                <input
                  id="mp-s"
                  className="input"
                  defaultValue={m.subjects.map((s) => subjectName(s)).join(", ")}
                  readOnly
                />
              </Field>
            </div>
            <Field
              label="Video introduction"
              htmlFor="mp-v"
              hint="MP4 up to 60 s · stored privately until approved"
            >
              <input id="mp-v" type="file" accept="video/mp4" className="input" />
            </Field>
            <Button type="button" variant="accent">
              Save (demo)
            </Button>
          </form>
        </Card>
        <QrProfileCard
          url={`${SITE_URL}/mentors/${m.handle}`}
          name={m.name}
          subject={subjectName(m.primarySubject)}
          hue={m.hue}
        />
      </div>
    </>
  );
}
