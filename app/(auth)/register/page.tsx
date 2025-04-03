'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { GitHubButton } from '@/components/github-button';

export default function Page() {
  const router = useRouter();

  // Automatically redirect to login page since we only support GitHub auth
  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl gap-8 flex flex-col">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Sign Up</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Continue with GitHub to create your account
          </p>
        </div>
        <div className="flex flex-col gap-4 px-4 sm:px-16">
          <GitHubButton />
        </div>
      </div>
    </div>
  );
}
