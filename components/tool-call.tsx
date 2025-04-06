import React, { useState, useEffect } from 'react';
import { Box, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface ToolCallProps {
  toolName: string;
  args?: any;
  result?: any;
  isLoading?: boolean;
}

// Helper function to detect and parse nested JSON strings
function tryParseJSON(input: any): any {
  // If not a string, return as is
  if (typeof input !== 'string') {
    return input;
  }

  // Check if the string starts with { or [ (likely JSON)
  if ((input.startsWith('{') && input.endsWith('}')) || 
      (input.startsWith('[') && input.endsWith(']'))) {
    try {
      return JSON.parse(input);
    } catch (e) {
      // If parsing fails, return original string
      return input;
    }
  }

  return input;
}

export function ToolCall({
  toolName,
  args,
  result,
  isLoading = false,
}: ToolCallProps) {
  const [isResultExpanded, setIsResultExpanded] = useState(false);
  const [isArgsExpanded, setIsArgsExpanded] = useState(false);
  const [parsedArgs, setParsedArgs] = useState<any>(args);
  const [parsedResult, setParsedResult] = useState<any>(result);
  const [formattedArgs, setFormattedArgs] = useState<string>('');
  const [formattedResult, setFormattedResult] = useState<string>('');

  // Move JSON parsing to client-side effect to avoid hydration mismatch
  useEffect(() => {
    // Parse args if they exist
    if (args) {
      const parsed = tryParseJSON(args);
      setParsedArgs(parsed);
      setFormattedArgs(JSON.stringify(parsed, null, 2));
    }

    // Parse result if it exists
    if (result) {
      const parsed = tryParseJSON(result);
      setParsedResult(parsed);
      setFormattedResult(JSON.stringify(parsed, null, 2));
    }
  }, [args, result]);

  const toggleResult = () => {
    setIsResultExpanded(!isResultExpanded);
  };

  const toggleArgs = () => {
    setIsArgsExpanded(!isArgsExpanded);
  };

  return (
    <div className="max-w-full my-2 rounded-md border border-gray-200 bg-gray-50">
      {/* Tool Call Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <span className="flex items-center justify-center w-6 h-6 bg-gray-200 rounded-full">
            <Box size={14} className="text-gray-700" />
          </span>
          <span className="font-mono text-xs text-gray-700">
            {toolName}
          </span>
        </div>

        {/* Tool Arguments Button (only shown if args exist) */}
        {args && (
          <button
            type="button"
            onClick={toggleArgs}
            className="flex items-center text-xs text-gray-600 hover:text-gray-900 mr-2"
          >
            <span>Arguments</span>
            {isArgsExpanded ? (
              <ChevronUp size={14} className="ml-1" />
            ) : (
              <ChevronDown size={14} className="ml-1" />
            )}
          </button>
        )}

        {/* Response Button or Loading Indicator */}
        {isLoading ? (
          <div className="flex items-center text-xs text-gray-600">
            <Clock size={14} className="mr-1 animate-pulse" />
            <span>Processing...</span>
          </div>
        ) : result ? (
          <button
            type="button"
            onClick={toggleResult}
            className="flex items-center text-xs text-gray-600 hover:text-gray-900"
          >
            <span>Response</span>
            {isResultExpanded ? (
              <ChevronUp size={14} className="ml-1" />
            ) : (
              <ChevronDown size={14} className="ml-1" />
            )}
          </button>
        ) : null}
      </div>

      {/* Arguments Section (when expanded) */}
      {args && isArgsExpanded && (
        <div className="px-3 py-2 overflow-hidden border-b border-gray-200">
          <div className="text-xs text-gray-500 mb-1">Arguments:</div>
          <pre className="text-xs font-mono bg-gray-100 p-2 rounded overflow-x-auto max-h-64 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
            {formattedArgs}
          </pre>
        </div>
      )}

      {/* Loading Animation (visible when loading) */}
      {isLoading && (
        <div className="px-3 py-3 flex justify-center">
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Collapsible JSON Result (visible when loaded and expanded) */}
      {result && isResultExpanded && (
        <div className="px-3 py-2 overflow-hidden">
          <div className="text-xs text-gray-500 mb-1">Response:</div>
          <pre className="text-xs font-mono bg-gray-100 p-2 rounded overflow-x-auto max-h-64 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
            {formattedResult}
          </pre>
        </div>
      )}
    </div>
  );
}
