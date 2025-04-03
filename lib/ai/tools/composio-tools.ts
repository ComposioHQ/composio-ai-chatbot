import { VercelAIToolSet } from "composio-core";
import { Session } from "next-auth";

const toolset = new VercelAIToolSet();

// Create a function to initialize tools with the session
export async function getComposioTools(session?: Session | null) {
  const entityId = session?.user?.id;

  console.log("Initializing Composio tools with entityId:", entityId);

  // Pass user information through the correct property if supported
  // Note: Check Composio documentation for the correct way to pass user identity
  const tools = await toolset.getTools(
    {
      apps: ["composio", "airtable", "firecrawl", "composio_search"],
    },
    entityId
  );

  return tools;
}

// Get active connections for an entity
export async function getActiveConnections(entityId?: string): Promise<string[]> {
  if (!entityId) {
    return [];
  }

  try {
    // Get the entity using the session user ID
    console.log(`Attempting to get entity for ID: ${entityId}`);
    const entity = await toolset.getEntity(entityId);
    console.log('Entity retrieved:', entity);
    
    // Get all active connections for this entity
    console.log('Fetching connections for entity...');
    const activeConnections = await entity.getConnections();
    console.log('Active connections:', activeConnections);
    
    if (!activeConnections || activeConnections.length === 0) {
      return [];
    }
    
    // Extract app names from connections
    const appNames = activeConnections.map(conn => {
      const connObj = conn as any; // Cast to any to avoid TypeScript errors
      return connObj.name || connObj.appId || 'Unknown app';
    });
    
    return appNames;
  } catch (error) {
    console.error('Error getting active connections:', error);
    return [];
  }
}
