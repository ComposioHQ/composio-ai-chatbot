import { generateUUID } from '@/lib/utils';
import { type DataStreamWriter, tool } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';
import type { UIMessage } from 'ai';
import { title } from 'node:process';

interface CreateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
  messages?: UIMessage[];
}

export const createDocument = ({ session, dataStream, messages }: CreateDocumentProps) =>
  tool({
    description:
      'Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title, description, and kind. Provide a detailed description that includes all necessary context and specific requirements for the artifact.',
    parameters: z.object({
      kind: z.enum(artifactKinds),
      description: z.string().describe('A detailed description including all specific requirements, values, constraints, and other context needed to generate the artifact correctly.'),
      includeConversationHistory: z.boolean().optional().describe('Whether to include the conversation history when generating the artifact. Default is false.')
    }),
    execute: async ({ kind, description, includeConversationHistory = false }) => {
      const id = generateUUID();

      dataStream.writeData({
        type: 'kind',
        content: kind,
      });

      dataStream.writeData({
        type: 'id',
        content: id,
      });

      dataStream.writeData({
        type: 'title',
        content: title,
      });

      dataStream.writeData({
        type: 'clear',
        content: '',
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      // Prepare relevant conversation history if requested
      const relevantHistory = includeConversationHistory && messages ? 
        messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n') : 
        undefined;

      await documentHandler.onCreateDocument({
        id,
        description, // Pass the detailed description
        conversationHistory: relevantHistory, // Pass conversation history if requested
        dataStream,
        session,
      });

      dataStream.writeData({ type: 'finish', content: '' });

      return {
        id,
        kind,
        content: 'A document was created and is now visible to the user.',
      };
    },
  });
