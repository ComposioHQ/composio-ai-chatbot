import { VercelAIToolSet } from "composio-core";
import { Session } from "next-auth";

// Store the entityId in module scope
let currentEntityId: string | undefined;

// Store the toolset instance
let toolset: VercelAIToolSet | undefined;

/**
 * Initialize the Composio client with user session information
 */
export function initComposio(session?: Session | null): void {
  const entityId = session?.user?.id;
  
  if (entityId !== currentEntityId) {
    console.log(`Setting Composio entityId: ${entityId}`);
    currentEntityId = entityId;

    // Re-initialize the toolset with the new entityId
    toolset = new VercelAIToolSet({ entityId });
    console.log('Composio toolset initialized with entityId:', entityId);
  } else if (!toolset) {
    // Initialize toolset if it doesn't exist yet
    toolset = new VercelAIToolSet({ entityId: currentEntityId });
    console.log('Composio toolset initialized with entityId:', currentEntityId);
  }
}

/**
 * Get the current entityId
 */
export function getEntityId(): string | undefined {
  return currentEntityId;
}

/**
 * Get Composio tools with the current entityId
 */
export function getComposioTools(apps: string[] = ["composio_search", "hackernews", "gmail", "googlecalendar"]) {
  if (!toolset) {
    toolset = new VercelAIToolSet({ entityId: currentEntityId });
    console.log('Composio toolset initialized with entityId:', currentEntityId);
  }
  
  console.log(`Getting Composio tools for apps: ${apps.join(', ')}`);
  return toolset.getTools({ apps });
}

/**
 * Get the entity for the current user
 */
export async function getEntity() {
  if (!currentEntityId) {
    throw new Error("EntityId not set. Call initComposio first.");
  }
  if (!toolset) {
    toolset = new VercelAIToolSet({ entityId: currentEntityId });
    console.log('Composio toolset initialized with entityId:', currentEntityId);
  }
  return toolset.getEntity(currentEntityId);
}

/**
 * Get the VercelAIToolSet instance
 * This is useful for direct access to the toolset methods
 */
export function getVercelAIToolSet() {
  if (!toolset) {
    toolset = new VercelAIToolSet({ entityId: currentEntityId });
    console.log('Composio toolset initialized with entityId:', currentEntityId);
  }
  return toolset;
}

/**
 * Get active connections for the current user
 */
export async function getActiveConnections(): Promise<string[]> {
  if (!currentEntityId) {
    return [];
  }

  if (!toolset) {
    toolset = new VercelAIToolSet({ entityId: currentEntityId });
    console.log('Composio toolset initialized with entityId:', currentEntityId);
  }

  try {
    console.log(`Attempting to get entity for ID: ${currentEntityId}`);
    const entity = await getEntity();
    console.log('Entity retrieved:', entity);
    
    console.log('Fetching connections for entity...');
    const activeConnections = await entity.getConnections();
    console.log('All connections:', activeConnections);
    
    if (!activeConnections || activeConnections.length === 0) {
      return [];
    }
    
    // Filter connections to only include those with ACTIVE status
    const activeConnectionsList = activeConnections.filter((conn: any) => {
      return conn.status === 'ACTIVE';
    });
    
    console.log('Connections with ACTIVE status:', activeConnectionsList);
    
    // Extract app names from active connections only
    const appNames = activeConnectionsList.map((conn: any) => {
      return conn.appName || conn.appUniqueId || 'Unknown app';
    });
    
    return appNames;
  } catch (error) {
    console.error('Error getting active connections:', error);
    return [];
  }
}
