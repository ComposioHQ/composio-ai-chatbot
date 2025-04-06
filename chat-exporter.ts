// chat-exporter.ts - A standalone script to export chat history to JSON
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fs from 'node:fs';
import { pgTable, uuid, text, varchar, timestamp, json, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';

// Database schema definition (comprehensive for this script)
const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull(),
  email: varchar('email', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }),
  image: varchar('image', { length: 255 }),
  provider: varchar('provider', { length: 64 }),
  githubId: varchar('githubId', { length: 64 }),
});

const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId').notNull(),
  visibility: varchar('visibility', { enum: ['public', 'private'] }).notNull().default('private'),
});

const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull(),
  chatId: uuid('chatId').notNull(),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId').notNull(),
    messageId: uuid('messageId').notNull(),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  }),
);

const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', { enum: ['text', 'code', 'image', 'sheet'] })
      .notNull()
      .default('text'),
    userId: uuid('userId').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  }),
);

const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
  }),
);

/**
 * Exports a chat to JSON
 */
async function exportChat(chatId: string) {
  // Database connection
  // Update this connection string to match your environment
  const connectionString = process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/chutra';
  const client = postgres(connectionString);
  const db = drizzle(client);
  
  try {
    console.log(`Exporting chat ${chatId}...`);
    
    // Get chat info - fixed SQL comparison
    const chatData = await db.select().from(chat).where(eq(chat.id, chatId));
    
    if (!chatData || chatData.length === 0) {
      console.error(`Chat with ID ${chatId} not found`);
      return;
    }
    
    // Get chat messages - fixed SQL comparison
    const messages = await db.select().from(message).where(eq(message.chatId, chatId));
    
    // Get user info (chat owner) - fixed SQL comparison
    const userData = await db.select().from(user).where(eq(user.id, chatData[0].userId));
    
    // Get votes for this chat - fixed SQL comparison
    const votes = await db.select().from(vote).where(eq(vote.chatId, chatId));
    
    // Map votes to a more accessible format
    const voteMap = votes.reduce((acc, v) => {
      acc[v.messageId] = v.isUpvoted;
      return acc;
    }, {} as Record<string, boolean>);
    
    // Build the chat history object
    const chatHistory = {
      id: chatData[0].id,
      title: chatData[0].title,
      userId: chatData[0].userId,
      userDetails: userData.length > 0 ? {
        name: userData[0].name,
        email: userData[0].email,
        provider: userData[0].provider,
      } : null,
      createdAt: chatData[0].createdAt,
      visibility: chatData[0].visibility,
      messageCount: messages.length,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        parts: msg.parts,
        attachments: msg.attachments,
        createdAt: msg.createdAt,
        vote: voteMap[msg.id] !== undefined ? { isUpvoted: voteMap[msg.id] } : null
      }))
    };
    
    // Save to file with a more descriptive name including the chat title
    const safeTitle = (chatData[0].title || 'untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `./chat_export_${safeTitle}_${chatId.slice(0, 8)}.json`;
    const jsonOutput = JSON.stringify(chatHistory, null, 2);
    fs.writeFileSync(fileName, jsonOutput);
    
    console.log(`Chat exported to ${fileName}`);
    console.log(`Chat contains ${messages.length} messages`);
    
    // Analyze message structure and content
    const analysis = analyzeMessages(messages);
    console.log('\nChat Analysis:');
    console.log('==============');
    console.log(`Total messages: ${analysis.totalMessages}`);
    console.log('\nMessages by role:');
    Object.entries(analysis.byRole).forEach(([role, count]) => {
      console.log(`  ${role}: ${count}`);
    });
    
    console.log('\nMessage part types:');
    Object.entries(analysis.partTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    if (Object.keys(analysis.toolCalls).length > 0) {
      console.log('\nTool calls:');
      Object.entries(analysis.toolCalls).forEach(([tool, count]) => {
        console.log(`  ${tool}: ${count}`);
      });
    }
    
    if (Object.keys(analysis.toolResults).length > 0) {
      console.log('\nTool results:');
      Object.entries(analysis.toolResults).forEach(([tool, count]) => {
        console.log(`  ${tool}: ${count}`);
      });
    }
    
    if (analysis.toolSamples.length > 0) {
      console.log('\nSample tool interactions:');
      analysis.toolSamples.forEach((sample, i) => {
        console.log(`\nSample ${i+1}: ${sample.toolName}`);
        console.log(`  Args: ${JSON.stringify(sample.args || {}, null, 2).substring(0, 100)}...`);
        if (sample.result) {
          console.log(`  Result: ${JSON.stringify(sample.result || {}, null, 2).substring(0, 100)}...`);
        }
      });
    }
    
    // Create a separate deeper analysis file
    const deepAnalysisFileName = `./chat_analysis_${safeTitle}_${chatId.slice(0, 8)}.json`;
    const deepAnalysis = {
      analysis,
      messageStructure: getMessageStructureDetails(messages),
    };
    
    fs.writeFileSync(deepAnalysisFileName, JSON.stringify(deepAnalysis, null, 2));
    console.log(`\nDetailed analysis saved to ${deepAnalysisFileName}`);
    
    return chatHistory;
  } catch (error) {
    console.error('Error exporting chat:', error);
  } finally {
    // Close the database connection
    await client.end();
  }
}

/**
 * Analyze the messages to provide insight into message structure
 */
function analyzeMessages(messages: any[]) {
  const roleCount: Record<string, number> = {};
  const partTypeCount: Record<string, number> = {};
  const toolCalls: Record<string, number> = {};
  const toolResults: Record<string, number> = {};
  const toolSamples: Array<{toolName: string, args?: any, result?: any}> = [];
  
  messages.forEach(msg => {
    // Count roles
    roleCount[msg.role] = (roleCount[msg.role] || 0) + 1;
    
    // Count part types and tool calls
    if (Array.isArray(msg.parts)) {
      msg.parts.forEach((part: any) => {
        if (part && typeof part === 'object') {
          partTypeCount[part.type] = (partTypeCount[part.type] || 0) + 1;
          
          // Track tool invocations
          if (part.type === 'tool-invocation' && part.toolInvocation) {
            const { toolName, state, args, result } = part.toolInvocation;
            
            if (state === 'call') {
              toolCalls[toolName] = (toolCalls[toolName] || 0) + 1;
              
              // Add to samples if we don't have enough yet for this tool
              const existingSamples = toolSamples.filter(s => s.toolName === toolName);
              if (existingSamples.length < 2) {
                toolSamples.push({ toolName, args });
              }
            } else if (state === 'result') {
              toolResults[toolName] = (toolResults[toolName] || 0) + 1;
              
              // Try to add result to the existing sample
              const existingSample = toolSamples.find(s => s.toolName === toolName && !s.result);
              if (existingSample) {
                existingSample.result = result;
              }
            }
          }
        }
      });
    }
  });
  
  return {
    totalMessages: messages.length,
    byRole: roleCount,
    partTypes: partTypeCount,
    toolCalls,
    toolResults,
    toolSamples: toolSamples.slice(0, 5), // Limit to 5 samples
  };
}

/**
 * Get detailed information about the structure of messages
 */
function getMessageStructureDetails(messages: any[]) {
  // Get a representative sample of each message type
  const userMessage = messages.find(m => m.role === 'user');
  const assistantMessage = messages.find(m => m.role === 'assistant');
  const assistantMessageWithTool = messages.find(m => {
    return m.role === 'assistant' && 
           Array.isArray(m.parts) && 
           m.parts.some((p: any) => p.type === 'tool-invocation');
  });
  
  // Extract the different part types and their structure
  const partStructures: Record<string, any> = {};
  
  messages.forEach(msg => {
    if (Array.isArray(msg.parts)) {
      msg.parts.forEach((part: any) => {
        if (part && typeof part === 'object' && part.type) {
          // Only store one example of each part type
          if (!partStructures[part.type]) {
            partStructures[part.type] = part;
          }
        }
      });
    }
  });
  
  return {
    sampleUserMessage: userMessage,
    sampleAssistantMessage: assistantMessage,
    sampleAssistantWithTool: assistantMessageWithTool,
    partTypeStructures: partStructures,
  };
}

// Run the export function with chat ID from CLI argument
const chatId = process.argv[2];
if (!chatId) {
  console.error('Please provide a chat ID as a CLI argument.');
  process.exit(1);
}

exportChat(chatId).then(() => {
  console.log('\nExport completed');
  process.exit(0);
}).catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
