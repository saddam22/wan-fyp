import type { Metadata } from "next";
import { Forbidden } from "@/components/dash/Forbidden";

export const metadata: Metadata = { title: "No access", robots: { index: false } };

export default function ForbiddenPage() {
  return <Forbidden />;
}
