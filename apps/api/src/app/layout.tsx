// Minimal layout required by Next.js App Router
// This API app doesn't serve any UI, only API routes

export const metadata = {
  title: 'Healthcare API',
  description: 'Backend API for healthcare platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
