import type { ReactNode } from 'react';
import '../globals.css';

export const metadata = {
  title: 'Maintenance - FollowThru',
};

export default function MaintenanceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
