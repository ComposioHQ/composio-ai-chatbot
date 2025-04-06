import { Artifact } from '@/components/create-artifact';
import { CodeEditor } from '@/components/code-editor';
import {
  CopyIcon,
  LogsIcon,
  MessageIcon,
  PlayIcon,
  RedoIcon,
  PenIcon,
  UndoIcon,
} from '@/components/icons';
import { toast } from 'sonner';
import { generateUUID } from '@/lib/utils';
import {
  Console,
  type ConsoleOutput,
  type ConsoleOutputContent,
} from '@/components/console';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import type { ArtifactToolbarContext, ArtifactActionContext } from '@/components/create-artifact';
import { useLocalStorage } from 'usehooks-ts';

const OUTPUT_HANDLERS = {
  matplotlib: `
    import io
    import base64
    from matplotlib import pyplot as plt

    # Clear any existing plots
    plt.clf()
    plt.close('all')

    # Switch to agg backend
    plt.switch_backend('agg')

    def setup_matplotlib_output():
        def custom_show():
            if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                print("Warning: Plot size too large, reducing quality")
                plt.gcf().set_dpi(100)

            png_buf = io.BytesIO()
            plt.savefig(png_buf, format='png')
            png_buf.seek(0)
            png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
            print(f'data:image/png;base64,{png_base64}')
            png_buf.close()

            plt.clf()
            plt.close('all')

        plt.show = custom_show
  `,
  basic: `
    # Basic output capture setup
  `,
};

function detectRequiredHandlers(code: string): string[] {
  const handlers: string[] = ['basic'];

  if (code.includes('matplotlib') || code.includes('plt.')) {
    handlers.push('matplotlib');
  }

  return handlers;
}

// Format console outputs for sending to chat
function formatConsoleOutputForChat(outputs: Array<ConsoleOutput>): string {
  // Only include completed runs
  const completedOutputs = outputs.filter((o: ConsoleOutput) => o.status === 'completed');
  if (completedOutputs.length === 0) return '';
  
  let result = "```python\n# Code Execution Results\n";
  
  completedOutputs.forEach((output: ConsoleOutput, idx: number) => {
    if (idx > 0) result += "\n----- Run Result -----\n";
    
    output.contents.forEach(content => {
      if (content.type === 'text') {
        result += `${content.value}\n`;
      } else if (content.type === 'image') {
        // For image content, we just indicate an image was generated
        // The actual image will still be visible in the console
        result += '[Image output generated]\n';
      }
    });
  });
  
  result += "```";
  return result;
}

interface Metadata {
  outputs: Array<ConsoleOutput>;
  executionPromptShown: boolean; 
  status: 'idle' | 'executing' | 'executed'; 
  autoSendToChatEnabled: boolean; 
}

// Extracted execution logic for reuse
async function executeCode({ 
  content, 
  setMetadata, 
  appendMessage,
  artifactId
}: { 
  content: string; 
  setMetadata: (cb: (metadata: Metadata) => Metadata) => void;
  appendMessage?: (message: { role: 'user'; content: string }) => void;
  artifactId?: string;
}) {
  const runId = generateUUID();
  const outputContent: Array<ConsoleOutputContent> = [];

  setMetadata((metadata) => ({
    ...metadata,
    status: 'executing',
    outputs: [
      ...metadata.outputs,
      {
        id: runId,
        contents: [],
        status: 'in_progress',
      },
    ],
  }));

  try {
    // @ts-expect-error - loadPyodide is not defined
    const currentPyodideInstance = await globalThis.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/',
    });

    currentPyodideInstance.setStdout({
      batched: (output: string) => {
        outputContent.push({
          type: output.startsWith('data:image/png;base64') ? 'image' : 'text',
          value: output,
        });
      },
    });

    await currentPyodideInstance.loadPackagesFromImports(content, {
      messageCallback: (message: string) => {
        setMetadata((metadata) => ({
          ...metadata,
          outputs: [
            ...metadata.outputs.filter((output) => output.id !== runId),
            {
              id: runId,
              contents: [{ type: 'text', value: message }],
              status: 'loading_packages',
            },
          ],
        }));
      },
    });

    const requiredHandlers = detectRequiredHandlers(content);
    for (const handler of requiredHandlers) {
      if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
        await currentPyodideInstance.runPythonAsync(
          OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS],
        );

        if (handler === 'matplotlib') {
          await currentPyodideInstance.runPythonAsync(
            'setup_matplotlib_output()',
          );
        }
      }
    }

    await currentPyodideInstance.runPythonAsync(content);

    // Update metadata with execution results
    const updatedMetadata: Partial<Metadata> = {
      status: 'executed' as const,
      outputs: [] as Array<ConsoleOutput>, // Will be populated below
    };
    
    let updatedOutputs: Array<ConsoleOutput> = [];
    
    // Create the updated outputs array
    setMetadata(metadata => {
      updatedOutputs = [
        ...metadata.outputs.filter((output) => output.id !== runId),
        {
          id: runId,
          contents: outputContent,
          status: 'completed',
        },
      ];
      
      // Set the outputs in the updatedMetadata
      updatedMetadata.outputs = updatedOutputs;
      
      return {
        ...metadata,
        ...updatedMetadata,
      };
    });
    
    // Then check if we should auto-send to chat
    if (appendMessage) {
      setMetadata((metadata) => {
        // Check if auto-send is enabled and we have something to send
        if (metadata.autoSendToChatEnabled && outputContent.length > 0) {
          const formattedOutput = formatConsoleOutputForChat(updatedOutputs);
          if (formattedOutput) {
            appendMessage({
              role: 'user',
              content: `Code execution results:\n${formattedOutput}`,
            });
          }
        }
        return metadata; // Return unmodified (since we already updated above)
      });
    }
    
    // Notify that execution is complete
    if (artifactId) {
      window.dispatchEvent(new CustomEvent('codeArtifactExecutionComplete', {
        detail: { artifactId }
      }));
    }

    return { success: true, output: outputContent };
  } catch (error: any) {
    setMetadata((metadata) => ({
      ...metadata,
      status: 'idle',
      outputs: [
        ...metadata.outputs.filter((output) => output.id !== runId),
        {
          id: runId,
          contents: [{ type: 'text', value: error.message }],
          status: 'failed',
        },
      ],
    }));
    
    // Notify that execution is complete (with error)
    if (artifactId) {
      window.dispatchEvent(new CustomEvent('codeArtifactExecutionComplete', {
        detail: { artifactId, error: error.message }
      }));
    }

    return { success: false, error: error.message };
  }
}

type AppendMessageFn = (message: { role: 'user'; content: string }) => void;

export const codeArtifact = new Artifact<'code', Metadata>({
  kind: 'code',
  description:
    'Useful for code generation; Code execution is only available for python code.',
  initialize: async ({ setMetadata }) => {
    // Can't use useLocalStorage hook here as it's a React hook
    // We'll use localStorage directly in a non-React context
    let autoSendToChatEnabled = true;
    try {
      const storedValue = typeof window !== 'undefined' ? 
        window.localStorage.getItem('code-artifact-auto-send') : null;
      if (storedValue !== null) {
        autoSendToChatEnabled = JSON.parse(storedValue);
      }
    } catch (e) {
      console.error('Error reading from localStorage:', e);
    }
    
    setMetadata({
      outputs: [],
      executionPromptShown: false,
      status: 'idle',
      autoSendToChatEnabled,
    });
  },
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === 'code-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.content as string,
        isVisible:
          draftArtifact.status === 'streaming' &&
          draftArtifact.content.length > 300 &&
          draftArtifact.content.length < 310
            ? true
            : draftArtifact.isVisible,
        status: 'streaming',
      }));
    }
  },
  content: ({ content, metadata, setMetadata, status, ...props }) => {
    // Use local storage to remember auto-send preference
    const [storedAutoSend, setStoredAutoSend] = useLocalStorage(
      'code-artifact-auto-send', 
      true
    );
    
    // Get the artifactId if available
    const artifactId = 'id' in props ? (props as any).id : undefined;
    
    // Log the artifactId for debugging
    useEffect(() => {
      if (artifactId) {
        console.log('DEBUG: Code artifact has ID:', artifactId);
      } else {
        console.log('DEBUG: Code artifact is missing ID in props:', props);
      }
    }, [artifactId, props]);
    
    // If the stored value is different from metadata, update metadata
    useEffect(() => {
      if (metadata.autoSendToChatEnabled !== storedAutoSend) {
        setMetadata(m => ({ ...m, autoSendToChatEnabled: storedAutoSend }));
      }
    }, [storedAutoSend, metadata.autoSendToChatEnabled, setMetadata]);
    
    // Monitor artifact status to detect when code generation is complete
    useEffect(() => {
      if (status === 'idle' && content && !metadata.executionPromptShown && metadata.status === 'idle') {
        // Instead of showing inline prompt, dispatch an event to show the prompt in the chat UI
        if (artifactId) {
          console.log('DEBUG: Dispatching codeArtifactExecutionRequest event for ID', artifactId);
          const event = new CustomEvent('codeArtifactExecutionRequest', {
            detail: { artifactId }
          });
          window.dispatchEvent(event);
          console.log('DEBUG: Event dispatched successfully');
        } else {
          console.log('DEBUG: Cannot dispatch event - no artifactId available');
          console.log('DEBUG: Props:', props);
        }
        setMetadata((m) => ({ ...m, executionPromptShown: true }));
      }
    }, [status, content, metadata.executionPromptShown, metadata.status, artifactId, props]);
    
    // Listen for pending execution events
    useEffect(() => {
      // Create a handler to listen for executions initiated from the chat UI
      const handlePendingExecution = (event: CustomEvent) => {
        if (event.detail && event.detail.artifactId === artifactId) {
          handleRunCode();
        }
      };
      
      // Create a handler to listen for auto-send toggle changes
      const handleAutoSendToggle = (event: CustomEvent) => {
        if (event.detail && typeof event.detail.enabled === 'boolean') {
          setStoredAutoSend(event.detail.enabled);
          setMetadata(m => ({ ...m, autoSendToChatEnabled: event.detail.enabled }));
        }
      };
      
      // Add event listeners
      window.addEventListener('codeArtifactPendingExecution' as any, handlePendingExecution);
      window.addEventListener('codeArtifactAutoSendToggle' as any, handleAutoSendToggle);
      
      return () => {
        window.removeEventListener('codeArtifactPendingExecution' as any, handlePendingExecution);
        window.removeEventListener('codeArtifactAutoSendToggle' as any, handleAutoSendToggle);
      };
    }, [artifactId, setMetadata, setStoredAutoSend]);

    // Get appendMessage function from context if available
    const appendMessage = 'appendMessage' in props ? 
      (props as unknown as { appendMessage: AppendMessageFn }).appendMessage : 
      undefined;

    // Handle execution prompt actions (now triggered from the chat UI)
    const handleRunCode = async () => {
      await executeCode({ content, setMetadata, appendMessage, artifactId });
    };
    
    // Send output to chat
    const handleSendToChat = () => {
      if (appendMessage) {
        const formattedOutput = formatConsoleOutputForChat(metadata.outputs);
        if (formattedOutput) {
          appendMessage({
            role: 'user',
            content: `Code execution results:\n${formattedOutput}`,
          });
          toast.success('Sent execution results to chat');
        }
      }
    };
    
    // Component to add a button to send console output to chat
    const SendToChat = ({ outputs, onClick }: { outputs: Array<ConsoleOutput>; onClick: () => void }) => {
      const hasCompletedOutput = outputs.some(output => output.status === 'completed');
      
      if (!hasCompletedOutput) return null;
      
      return (
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-1"
          onClick={onClick}
        >
          <PenIcon size={14} />
          <span className="text-xs">Send to Chat</span>
        </Button>
      );
    };

    return (
      <>
        <div className="px-1">
          <CodeEditor content={content} status={status} {...props} />
        </div>

        {metadata?.outputs && metadata.outputs.length > 0 && (
          <div className="relative">
            <div className="absolute right-4 top-2 z-50">
              <SendToChat outputs={metadata.outputs} onClick={handleSendToChat} />
            </div>
            <Console
              consoleOutputs={metadata.outputs}
              setConsoleOutputs={() => {
                setMetadata({
                  ...metadata,
                  outputs: [],
                });
              }}
            />
          </div>
        )}
      </>
    );
  },
  actions: [
    {
      icon: <PlayIcon size={18} />,
      label: 'Run',
      description: 'Execute code',
      onClick: async ({ content, setMetadata, ...ctx }: ArtifactActionContext<Metadata> & { id?: string }) => {
        // Get id from context if available
        const artifactId = 'id' in ctx ? (ctx as any).id : undefined;
        await executeCode({ content, setMetadata, artifactId });
      },
    },
    {
      icon: <PenIcon size={18} />,
      label: 'Auto-send',
      description: 'Toggle auto-send results to chat',
      onClick: ({ setMetadata }: ArtifactActionContext<Metadata>) => {
        setMetadata(metadata => {
          const newValue = !metadata.autoSendToChatEnabled;
          // Use window.localStorage directly since we can't use the hook in this context
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('code-artifact-auto-send', JSON.stringify(newValue));
          }
          toast.success(newValue ? 'Results will automatically be sent to chat' : 'Auto-send disabled');
          
          // Dispatch an event to sync this setting with all artifacts and the chat UI
          window.dispatchEvent(new CustomEvent('codeArtifactAutoSendToggle', {
            detail: { enabled: newValue }
          }));
          
          return { ...metadata, autoSendToChatEnabled: newValue };
        });
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy code to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageIcon />,
      description: 'Improve code',
      onClick: ({ appendMessage }: ArtifactToolbarContext) => {
        appendMessage({
          role: 'user',
          content: 'Can you improve this code? Make it more efficient and add comments.',
        });
      },
    },
    {
      icon: <LogsIcon />,
      description: 'Add logs',
      onClick: ({ appendMessage }: ArtifactToolbarContext) => {
        appendMessage({
          role: 'user',
          content: 'Can you add console logging to this code?',
        });
      },
    },
  ],
});
