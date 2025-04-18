import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { VercelIcon } from './icons';

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
        <p className="flex flex-row justify-center gap-4 items-center">
          <Image
            src="/assets/icons/composio-logo.svg"
            alt="Composio Logo"
            width={32}
            height={32}
          />
          <span>+</span>
          <VercelIcon size={32} />
        </p>
        <p>
          This is an{' '}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://github.com/composiohq/ai-chatbot-template"
            target="_blank"
          >
            open source
          </Link>{' '}
          chatbot template built with Composio, Next.js and AI SDK. It uses Composio&apos;s {' '}
          <code className="rounded-md bg-muted px-1 py-0.5">VercelAIToolSet</code>{' '}, the {' '}
          <Link
            className="font-medium underline underline-offset-4"  
            href="https://docs.composio.dev/tools/gmail"
            target="_blank"
          >
            Gmail
          </Link>{' '}
          and the {' '}
          <Link
            className="font-medium underline underline-offset-4"  
            href="https://app.composio.dev/app/composio_search"
            target="_blank"
          >
            Search
          </Link>{' '}
          tools to provide a rich experience.
        </p>
        <p>
          You can learn more about Composio by visiting the{' '}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://docs.composio.dev"
            target="_blank"
          >
            docs
          </Link>
          .
        </p>
      </div>
    </motion.div>
  );
};
