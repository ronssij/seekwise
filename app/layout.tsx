import "./globals.css";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <nav className="flex gap-4 border-b p-4">
          <Link href="/resume" className="font-medium hover:underline">Resume</Link>
          <Link href="/jobs" className="font-medium hover:underline">Jobs</Link>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
