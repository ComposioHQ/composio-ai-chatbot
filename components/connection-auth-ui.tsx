'use client';

import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AuthLinkProps {
  result: {
    success: boolean;
    message: string;
  };
}

export function AuthLink({ result }: AuthLinkProps) {
  return (
    <Alert
      className={cn(
        'flex flex-col items-start gap-2 mt-2',
        result.success ? 'bg-primary/10' : 'bg-destructive/10'
      )}
      variant={result.success ? 'default' : 'destructive'}
    >
      <AlertDescription 
        dangerouslySetInnerHTML={{ __html: result.message }}
      />
    </Alert>
  );
}