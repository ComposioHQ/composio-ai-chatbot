import { z } from 'zod';
import { streamObject } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { codePrompt, updateDocumentPrompt } from '@/lib/ai/prompts';
import { createDocumentHandler } from '@/lib/artifacts/server';

export const codeDocumentHandler = createDocumentHandler<'code'>({
  kind: 'code',
  onCreateDocument: async ({ description, conversationHistory, dataStream }) => {
    console.log('codeDocumentHandler.onCreateDocument', { description, conversationHistory });

    let draftContent = '';

    // Build a rich context with all available information
    const context = [
      // Include detailed description if available
      description ? `DETAILED REQUIREMENTS:\n${description}` : 'NO DESCRIPTION RECEIVED',
      // Include conversation history if available
      conversationHistory ? `CONVERSATION HISTORY:\n${conversationHistory}` : 'NO CONVERSATION HISTORY RECEIVED'
    ].filter(Boolean).join('\n\n');
    
    const { fullStream } = streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: codePrompt,
      prompt: context, // Use our enhanced context instead of just the title
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.writeData({
            type: 'code-delta',
            content: code ?? '',
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, conversationHistory, dataStream }) => {
    let draftContent = '';

    // Build a rich context with all available information
    const context = [
      // Always include the document content
      `DOCUMENT CONTENT:\n${document.content}`,
      // Include detailed description if available
      description ? `DETAILED REQUIREMENTS:\n${description}` : '',
      // Include conversation history if available
      conversationHistory ? `CONVERSATION HISTORY:\n${conversationHistory}` : ''
    ].filter(Boolean).join('\n\n');
    
    const { fullStream } = streamObject({
      model: myProvider.languageModel('artifact-model'),
      system: updateDocumentPrompt(document.content, 'code'),
      prompt: context, // Use our enhanced context instead of just the description
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'object') {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.writeData({
            type: 'code-delta',
            content: code ?? '',
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
});
