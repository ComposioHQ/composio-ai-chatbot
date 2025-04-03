'use client';

import { Button } from './ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { signIn } from 'next-auth/react';

export function GitHubButton() {
  const handleGitHubSignIn = async () => {
    await signIn('github', { callbackUrl: '/' });
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full flex items-center justify-center gap-2"
      onClick={handleGitHubSignIn}
    >
      <FontAwesomeIcon icon={faGithub} />
      Sign in with GitHub
    </Button>
  );
}
