import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tư vấn pháp lý chứng khoán | Securities Legal Assistant",
  description:
    "Chatbot tư vấn pháp lý chứng khoán song ngữ Anh/Việt | Bilingual securities legal advisory chatbot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
