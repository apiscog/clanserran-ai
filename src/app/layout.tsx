import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Clan Serran · Amigo Invisible", template: "%s · Clan Serran" },
  description: "Organiza el amigo invisible de tu familia de forma privada y sencilla.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <div className="shell spread">
            <Link className="brand" href="/inicio">Clan Serran</Link>
            <span className="muted small">Amigo invisible en familia</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
