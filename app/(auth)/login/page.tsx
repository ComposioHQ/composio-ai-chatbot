'use client';

import { useRouter } from 'next/navigation';
import { GitHubButton } from '@/components/github-button';

export default function Page() {
  const router = useRouter();

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center bg-background">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-8">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Sign In</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Continue with GitHub to access Chutra
          </p>
        </div>
        <div className="flex flex-col gap-4 px-4 sm:px-16">
          <GitHubButton />
        </div>
      </div>
    </div>
  );
}
