import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "JAG3D",
  description: "Editor de malha 3D odontologico e facial",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
