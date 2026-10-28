import { CalendarPlanner } from "@/components/dash/mentor";
import { PageHeader } from "@/components/ui";

export default function MentorCalendar() {
  return (
    <>
      <PageHeader
        title="Calendar & Sessions"
        sub="Set when you take orders and live consultations."
      />
      <CalendarPlanner />
    </>
  );
}
