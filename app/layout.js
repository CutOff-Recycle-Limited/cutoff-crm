import { Mulish } from "next/font/google";
import "./globals.css";
import { getViewer } from "../lib/auth";
import TopNav from "../components/topnav";
import UserMenu from "../components/user-menu";

const mulish = Mulish({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  adjustFontFallback: true,
});

export const metadata = {
  title: "CutOff CRM — Customer Command Center",
  description: "Customer Command Center built with Next.js, Supabase Auth, and Neon/Postgres.",
};

export default async function RootLayout({ children }) {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <html lang="en" className={mulish.variable}>
        <body className="font-sans antialiased">
          <div className="auth-shell">{children}</div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={mulish.variable}>
      <body className="font-sans antialiased">
        <div className="shell">
          <TopNav userMenu={<UserMenu viewer={viewer} />} />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
