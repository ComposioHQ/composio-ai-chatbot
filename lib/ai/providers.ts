import {
  customProvider,
} from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
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
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': wrapAISDKModel(anthropic('claude-3-5-sonnet-latest')),
        'title-model': (anthropic('claude-3-5-haiku-latest')),
        'artifact-model': wrapAISDKModel(anthropic('claude-3-5-sonnet-latest')),
      },
    });
