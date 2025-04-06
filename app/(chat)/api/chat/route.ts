import {
  type UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt, connectionsPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { initiateConnection } from '@/lib/ai/tools/initiate-connection';
import { getComposioTools, getActiveConnections, initComposio } from '@/lib/ai/composio';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
    } = await request.json();

    const session = await auth();
    
    // Initialize Composio with the session
    initComposio(session);

    // Get active connections
    let activeConnectionsPrompt = "";
    if (session?.user?.id) {
      const activeApps = await getActiveConnections();
      const appsList = activeApps.length > 0 ? 
        activeApps.join(", ") : 
        "No active connections yet";
      
      activeConnectionsPrompt = connectionsPrompt({ connections: appsList });
    }

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });

      try {
        await saveChat({ id, userId: session.user.id, title });
      } catch (saveChatError) {
        // Continue without saving chat for debugging purposes
        // In production, you'd want to return an error response here
      }
    } else {
      if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: userMessage.id,
          role: 'user',
          parts: userMessage.parts,
          attachments: userMessage.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    return createDataStreamResponse({
      execute: async (dataStream) => {
        // Get tools with no arguments since we've already initialized with the session
        const composioTools = await getComposioTools();
        
        // Log the entire messages array before LLM call
        console.log(`[${new Date().toISOString()}] Chat ID: ${id} | Model: ${selectedChatModel} | Pre-LLM Messages:`, 
          JSON.stringify(messages, null, 2));
        
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: `${systemPrompt({ selectedChatModel })}\n\n${activeConnectionsPrompt}`,
          messages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                  'initiateConnection',
                  // Use type assertion to add Composio tool names
                  ...Object.keys(composioTools) as any[],
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            ...composioTools,
            getWeather,
            createDocument: createDocument({ session, dataStream, messages }),
            updateDocument: updateDocument({ session, dataStream, messages }),
            requestSuggestions: requestSuggestions({ session, dataStream }),
            initiateConnection: initiateConnection({ id }),
          },
          onFinish: async ({ response }) => {
            // Log the complete response from the API
            console.log(`[${new Date().toISOString()}] Chat ID: ${id} | Model: ${selectedChatModel} | LLM Response:`, 
              JSON.stringify(response, null, 2));

            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: response.messages.filter(
                    (message) => message.role === 'assistant',
                  ),
                });

                if (!assistantId) {
                  throw new Error('No assistant message found!');
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [userMessage],
                  responseMessages: response.messages,
                });

                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: assistantMessage.parts,
                      attachments:
                        assistantMessage.experimental_attachments ?? [],
                      createdAt: new Date(),
                    },
                  ],
                });
              } catch (_) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        // Log any errors that occur during the API call
        console.error(`[${new Date().toISOString()}] Chat ID: ${id} | Model: ${selectedChatModel} | API Error:`,
          error instanceof Error ? error.message : error);
        return 'Oops, an error occured!';
      },
    });
  } catch (error) {
    // Log any errors from the overall route handler
    console.error(`[${new Date().toISOString()}] Chat Route Error:`,
      error instanceof Error ? { message: error.message, stack: error.stack } : error);
    return new Response('An error occurred while processing your request!', {
      status: 404,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}
