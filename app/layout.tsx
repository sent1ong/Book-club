import "./globals.css";

export const metadata = {
  title: "독서기록장",
  description: "Retro Book Club",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
