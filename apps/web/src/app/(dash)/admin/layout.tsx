import type { Metadata } from "next";
import { AreaLayout } from "@/components/dash/AreaLayout";

export const metadata: Metadata = { robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AreaLayout area="admin">{children}</AreaLayout>;
}
