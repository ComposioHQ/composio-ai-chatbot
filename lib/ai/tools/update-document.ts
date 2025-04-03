import { DataStreamWriter, tool } from 'ai';
import { Session } from 'next-auth';
import { z } from 'zod';
import { getDocumentById, saveDocument } from '@/lib/db/queries';
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';
import type { UIMessage } from 'ai';

interface UpdateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
  messages?: UIMessage[];
}

export const updateDocument = ({ session, dataStream, messages }: UpdateDocumentProps) =>
  tool({
    description: 'Update a document with the given description. Provide detailed requirements for the changes needed.',
    parameters: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe('Detailed description of the changes and improvements needed, including any specific requirements or values'),
      includeConversationHistory: z.boolean().optional().describe('Whether to include the conversation history when updating the artifact. Default is false.')
    }),
    execute: async ({ id, description, includeConversationHistory = false }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      dataStream.writeData({
        type: 'clear',
        content: document.title,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      // Prepare relevant conversation history if requested
      const relevantHistory = includeConversationHistory && messages ? 
        messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n') : 
        undefined;

      await documentHandler.onUpdateDocument({
        document,
        description,
        conversationHistory: relevantHistory, // Pass conversation history if requested
        dataStream,
        session,
      });

      dataStream.writeData({ type: 'finish', content: '' });

      return {
        id: document.id,
        title: document.title,
        kind: document.kind,
        content: 'Document was updated and is now visible to the user.',
      };
    },
  });
