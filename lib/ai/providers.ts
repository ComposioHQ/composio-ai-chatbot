import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { groq } from '@ai-sdk/groq';
import { anthropic } from '@ai-sdk/anthropic';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { initLogger, wrapAISDKModel } from 'braintrust';

const logger = initLogger({
  projectName: 'Chutra',
  apiKey: process.env.BRAINTRUST_API_KEY,
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': wrapAISDKModel(anthropic('claude-3-5-sonnet-latest')),
        'chat-model-reasoning': wrapLanguageModel({
          model: wrapAISDKModel(groq('deepseek-r1-distill-llama-70b')),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': wrapAISDKModel(anthropic('claude-3-5-haiku-latest')),
        'artifact-model': wrapAISDKModel(anthropic('claude-3-5-sonnet-latest')),
      },
    });
