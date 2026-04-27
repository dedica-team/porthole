import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar/Navbar';
interface Props {
  children: ReactNode;
  sidebar?: ReactNode;
}
export default function AppShell({ children, sidebar }: Props) {
  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-background">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative overflow-hidden">
          {children}
        </main>
        {sidebar}
      </div>
    </div>
  );
}
