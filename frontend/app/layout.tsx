import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LUNAR | Explore the Cosmos',
  description: 'Experience the lunar frontier through an immersive interactive 3D exploration.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#010103] text-white">
        {children}
      </body>
    </html>
  );
}
