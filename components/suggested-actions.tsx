"use client";

import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { memo } from "react";
import type { UseChatHelpers } from "@ai-sdk/react";

interface SuggestedActionsProps {
  chatId: string;
  append: UseChatHelpers["append"];
}

function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  const suggestedActions = [
    {
      title: "Read about Composio",
      label: "and explain how it helps build agents",
      action: `Read and explain what Composio is and how it helps build agents.`,
    },
    {
      title: "What does my Calendar look like on Wednesday?",
      label: `When am I free?`,
      action: `What does my Calendar look like on Wednesday? When am I free?`,
    },
    {
      title: "Write an essay",
      label: `about silicon valley and send it in an email.`,
      action: `Write an essay about silicon valley and send it to sid@composio.dev`,
    },
    {
      title: "What's new on HackerNews?",
      label: `Summarize the top 10 stories with links.`,
      action: `What's new on HackerNews? Summarize the top 10 stories with links.`,
    },
  ];

  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-2 w-full"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className={index > 1 ? "hidden sm:block" : "block"}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, "", `/chat/${chatId}`);

              append({
                role: "user",
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
