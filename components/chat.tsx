'use client';

import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { toast } from 'sonner';
import { CodeExecutionPrompt } from './code-execution-prompt';
import { useLocalStorage } from 'usehooks-ts';

export function Chat({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: selectedChatModel },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate('/api/history');
    },
    onError: () => {
      toast.error('An error occured, please try again!');
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // Track pending code execution
  const [pendingExecution, setPendingExecution] = useState<{ artifactId: string } | null>(null);

  // Remember user preference for auto-send
  const [autoSendEnabled, setAutoSendEnabled] = useLocalStorage(
    'code-artifact-auto-send',
    true
  );

  // Set up event listeners for code artifact events
  useEffect(() => {
    // Handler for execution requests from code artifacts
    const handleExecutionRequest = (event: any) => {
      console.log('DEBUG: Received execution request event', event.detail);
      if (event.detail?.artifactId) {
        console.log('DEBUG: Setting pending execution with ID', event.detail.artifactId);
        setPendingExecution({ artifactId: event.detail.artifactId });
      }
    };

    // Handler for execution completion events
    const handleExecutionComplete = (event: any) => {
      console.log('DEBUG: Received execution complete event', event.detail);
      if (event.detail && event.detail.artifactId === pendingExecution?.artifactId) {
        console.log('DEBUG: Clearing pending execution');
        setPendingExecution(null);
      }
    };

    // Handler for auto-send toggle events
    const handleAutoSendToggle = (event: any) => {
      console.log('DEBUG: Received auto-send toggle event', event.detail);
      if (event.detail && typeof event.detail.enabled === 'boolean') {
        setAutoSendEnabled(event.detail.enabled);
      }
    };

    console.log('DEBUG: Setting up event listeners in chat.tsx');
    // Add event listeners - use direct string event names without casting
    window.addEventListener('codeArtifactExecutionRequest', handleExecutionRequest);
    window.addEventListener('codeArtifactExecutionComplete', handleExecutionComplete);
    window.addEventListener('codeArtifactAutoSendToggle', handleAutoSendToggle);

    return () => {
      console.log('DEBUG: Removing event listeners in chat.tsx');
      window.removeEventListener('codeArtifactExecutionRequest', handleExecutionRequest);
      window.removeEventListener('codeArtifactExecutionComplete', handleExecutionComplete);
      window.removeEventListener('codeArtifactAutoSendToggle', handleAutoSendToggle);
    };
  }, [pendingExecution, setAutoSendEnabled]);

  // Handlers for code execution prompt
  const handleRunCode = () => {
    if (pendingExecution) {
      // Dispatch an event to trigger code execution
      window.dispatchEvent(new CustomEvent('codeArtifactPendingExecution', {
        detail: { artifactId: pendingExecution.artifactId }
      }));
    }
  };

  const handleDismissPrompt = () => {
    setPendingExecution(null);
  };

  const handleAutoSendToggle = (enabled: boolean) => {
    setAutoSendEnabled(enabled);
    // Dispatch an event to sync auto-send preference with all artifacts
    window.dispatchEvent(new CustomEvent('codeArtifactAutoSendToggle', {
      detail: { enabled }
    }));
  };

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={isReadonly}
        />

        <div className="flex-1 overflow-y-auto">
          {/* Display code execution prompt when needed */}
          <CodeExecutionPrompt 
            onRun={handleRunCode}
            onDismiss={handleDismissPrompt}
            onAutoSendToggle={handleAutoSendToggle}
            autoSendEnabled={autoSendEnabled}
            codeArtifactId={pendingExecution?.artifactId}
            visible={!!pendingExecution}
          />

          <Messages
            chatId={id}
            status={status}
            votes={votes}
            messages={messages}
            setMessages={setMessages}
            reload={reload}
            isReadonly={isReadonly}
            isArtifactVisible={isArtifactVisible}
          />
        </div>

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>

      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
      />
    </>
  );
}
