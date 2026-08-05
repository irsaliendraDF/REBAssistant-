import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "REB Assistant",
  description:
    "Prepare a Dalhousie Research Ethics Board application. Drafting and gap analysis support. The Board makes every ethics determination.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}
