import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface PageTitleProps {
  icon?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageTitle({ icon, title, actions, className }: PageTitleProps) {
  return (
    <div className={cn('flex items-center gap-2 px-3 sm:px-6 py-3 shrink-0', className)}>
      {icon && <span className="text-warning shrink-0">{icon}</span>}
      <h1 className="text-lg font-semibold text-warning flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">{title}</h1>
      {actions && (
        <>
          <div className="hidden sm:flex items-center flex-wrap gap-2 shrink-0">{actions}</div>
          <div className="sm:hidden shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-2 flex flex-col gap-1">
                {actions}
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}
    </div>
  );
}
