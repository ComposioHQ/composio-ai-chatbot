'use client';

import { PenIcon, PlayIcon, CrossSmallIcon } from './icons';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useLocalStorage } from 'usehooks-ts';
import { useEffect } from 'react';

interface CodeExecutionPromptProps {
  onRun: () => void;
  onDismiss: () => void;
  onAutoSendToggle: (enabled: boolean) => void;
  autoSendEnabled: boolean;
  codeArtifactId?: string;
  visible: boolean;
}

export function CodeExecutionPrompt({
  onRun,
  onDismiss,
  onAutoSendToggle,
  autoSendEnabled,
  codeArtifactId,
  visible
}: CodeExecutionPromptProps) {
  // Remember user preferences for auto-execution
  const [alwaysExecute, setAlwaysExecute] = useLocalStorage(
    'code-artifact-always-execute',
    false
  );

  // Use the stored preference to run code automatically if set
  useEffect(() => {
    if (alwaysExecute && visible && codeArtifactId) {
      // Small delay to prevent immediate execution on load
      const timer = setTimeout(() => {
        onRun();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [alwaysExecute, visible, codeArtifactId, onRun]);

  if (!visible) return null;

  const handleAlwaysExecuteToggle = () => {
    const newValue = !alwaysExecute;
    setAlwaysExecute(newValue);
    toast.success(
      newValue 
        ? 'Code will now be executed automatically' 
        : 'Auto-execution disabled'
    );
    
    // If we're enabling always execute, dismiss this prompt
    if (newValue) {
      onDismiss();
    }
  };

  const handleAutoSendToggle = () => {
    onAutoSendToggle(!autoSendEnabled);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 mb-4 mt-2">
      <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Would you like to run this code?</h3>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6" 
            onClick={onDismiss}
          >
            <CrossSmallIcon size={14} />
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRun} className="flex items-center gap-1">
            <PlayIcon size={14} />
            <span>Run code</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleAlwaysExecuteToggle} 
            className="flex items-center gap-1"
          >
            <PlayIcon size={14} />
            <span>{alwaysExecute ? 'Disable auto-run' : 'Always run'}</span>
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleAutoSendToggle} 
            className="flex items-center gap-1"
          >
            <PenIcon size={14} />
            <span>
              {autoSendEnabled ? 'Disable auto-send' : 'Auto-send results'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
