import { tool } from "ai";
import { z } from "zod";
import { getEntityId, getVercelAIToolSet } from "@/lib/ai/composio";

// Interface for the tool props
interface InitiateConnectionProps {
  id: string; // Chat ID for proper redirection
}

// Factory function for creating the tool
export const initiateConnection = ({ id }: InitiateConnectionProps) =>
  tool({
    description:
      "Initiate a connection and authenticate the user with the third-party app that they want to use. Use this when a specific tool requires authentication and the user is not connected yet.",
    parameters: z.object({
      app: z
        .string()
        .describe(
          "The name of the app to connect to (e.g., 'gmail', 'firecrawl')"
        ),
    }),
    execute: async ({ app }) => {
      try {
        console.log(`Initiating connection for ${app}...`);
        const entityId = getEntityId();
        if (!entityId) {
          return {
            success: false,
            message:
              "User ID not found. Please log in to connect to third-party services.",
          };
        }

        // Determine the authentication type based on the app
        const authType = app.toLowerCase() === "gmail" ? "oauth" : "api-key";

        // Get the toolset to initiate the connection
        const toolset = getVercelAIToolSet();
        if (!toolset) {
          return {
            success: false,
            message: "Error initializing connection tools.",
          };
        }

        // For OAuth apps like Gmail
        if (authType === "oauth") {
          try {
            // Get the entity to initiate the connection
            const entity = await toolset.getEntity(entityId);

            // Use the chat ID to ensure proper redirection
            const redirectUri = `http://localhost:3000/chat/${id}`;
            console.log(`Using redirect URI: ${redirectUri}`);

            // Initiate the connection request to get the auth URL
            const connectionRequest = await entity.initiateConnection({
              appName: app,
              // redirectUri,
              // integrationId: process.env.GMAIL_INTEGRATION_ID,
            });

            // Extract the auth URL from the connection request
            const authUrl = connectionRequest.redirectUrl || "";
            if (!authUrl) {
              return {
                success: false,
                message: `Error getting authorization URL for ${app}.`,
              };
            }

            console.log(`Generated auth URL for ${app}: ${authUrl}`);

            return {
              success: true,
              message: `To connect to ${app}, pleas click this link: <a href="${authUrl}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 500;">Connect to ${app}</a>`,
            };
          } catch (error: any) {
            console.error(`Error generating auth URL for ${app}:`, error);
            return {
              success: false,
              message: `Error initiating OAuth connection for ${app}: ${error.message}`,
            };
          }
        }

        // For API key apps like Firecrawl
        if (authType === "api-key") {
          // Return a message asking for API key instead of writing to dataStream
          return {
            success: true,
            message: `To connect to ${app}, please provide your API key. You can respond with: "My ${app} API key is: YOUR_API_KEY_HERE"`,
          };
        }

        return {
          success: false,
          message: `Unsupported authentication type for ${app}.`,
        };
      } catch (error: any) {
        console.error(`Error initiating connection for ${app}:`, error);

        return {
          success: false,
          message: `There was an error initiating the connection to ${app}: ${error.message}`,
        };
      }
    },
  });
