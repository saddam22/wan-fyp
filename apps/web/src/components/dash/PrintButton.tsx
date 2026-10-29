"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Prints the page (the browser's "Save as PDF" gives the invoice as a file). */
export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer size={15} /> Print / save PDF
    </Button>
  );
}
