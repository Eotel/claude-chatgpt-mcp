#!/usr/bin/env bun
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { runAppleScript } from 'run-applescript';
import { run } from '@jxa/run';

const MAX_PROMPT_LENGTH = 10000; // 10KB以内に制限
const MAX_CONVERSATION_ID_LENGTH = 200; // 適切な長さに制限

/**
 * Safely escapes a string for use in AppleScript
 * Uses AppleScript's "quoted form of" to properly escape all special characters
 */
function escapeForAppleScript(str: string): string {
  const safeStr = String(str);
  return `quoted form of "${safeStr.replace(/"/g, '\\"')}"`;
}

/**
 * ユーザー入力を検証し、危険な入力を拒否する
 */
function validateChatGPTInput(prompt: string, conversationId?: string): void {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string');
  }
  
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt exceeds maximum allowed length of ${MAX_PROMPT_LENGTH} characters`);
  }
  
  if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(prompt)) {
    throw new Error('Prompt contains invalid control characters');
  }
  
  if (conversationId !== undefined) {
    if (typeof conversationId !== 'string') {
      throw new Error('Conversation ID must be a string');
    }
    
    if (conversationId.length > MAX_CONVERSATION_ID_LENGTH) {
      throw new Error(`Conversation ID exceeds maximum allowed length of ${MAX_CONVERSATION_ID_LENGTH} characters`);
    }
    
    if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(conversationId)) {
      throw new Error('Conversation ID contains invalid control characters');
    }
  }
}

// Define the ChatGPT tool
const CHATGPT_TOOL: Tool = {
  name: "chatgpt",
  description: "Interact with the ChatGPT desktop app on macOS",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "Operation to perform: 'ask' or 'get_conversations'",
        enum: ["ask", "get_conversations"]
      },
      prompt: {
        type: "string",
        description: "The prompt to send to ChatGPT (required for ask operation)"
      },
      conversation_id: {
        type: "string",
        description: "Optional conversation ID to continue a specific conversation"
      }
    },
    required: ["operation"]
  }
};

const server = new Server(
  {
    name: "ChatGPT MCP Tool",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Check if ChatGPT app is installed and running
async function checkChatGPTAccess(): Promise<boolean> {
  try {
    const isRunning = await runAppleScript(`
      tell application "System Events"
        return application process "ChatGPT" exists
      end tell
    `);

    if (isRunning !== "true") {
      console.log("ChatGPT app is not running, attempting to launch...");
      try {
        await runAppleScript(`
          tell application "ChatGPT" to activate
          delay 2
        `);
      } catch (activateError) {
        console.error("Error activating ChatGPT app:", activateError);
        throw new Error("Could not activate ChatGPT app. Please start it manually.");
      }
    }
    
    return true;
  } catch (error) {
    console.error("ChatGPT access check failed:", error);
    throw new Error(
      `Cannot access ChatGPT app. Please make sure ChatGPT is installed and properly configured. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Function to send a prompt to ChatGPT
async function askChatGPT(prompt: string, conversationId?: string): Promise<string> {
  // Validate inputs before processing
  validateChatGPTInput(prompt, conversationId);
  
  await checkChatGPTAccess();
  
  try {
    let script = `
      tell application "ChatGPT"
        activate
        delay 1
        
        tell application "System Events"
          tell process "ChatGPT"
    `;
    
    if (conversationId) {
      script += `
            -- Try to find and click the specified conversation using safe escaping
            try
              set targetConversation to ${escapeForAppleScript(conversationId)}
              click button whose name contains targetConversation of group 1 of group 1 of window 1
              delay 1
            end try
      `;
    }
    
    script += `
            -- Type in the prompt with proper escaping
            set promptText to ${escapeForAppleScript(prompt)}
            keystroke promptText
            delay 0.5
            keystroke return
            delay 5  -- Wait for response, adjust as needed
            
            -- Try to get the response (this is approximate and may need adjustments)
            set responseText to ""
            try
              set responseText to value of text area 2 of group 1 of group 1 of window 1
            on error
              set responseText to "Could not retrieve the response from ChatGPT."
            end try
            
            return responseText
          end tell
        end tell
      end tell
    `;
    
    const result = await runAppleScript(script);
    
    return result;
  } catch (error) {
    console.error("Error interacting with ChatGPT:", error);
    throw new Error(`Failed to get response from ChatGPT: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Function to get available conversations
async function getConversations(): Promise<string[]> {
  await checkChatGPTAccess();
  
  try {
    const result = await runAppleScript(`
      tell application "ChatGPT"
        activate
        delay 1
        
        tell application "System Events"
          tell process "ChatGPT"
            -- Try to get conversation titles
            set conversationsList to {}
            
            try
              set chatButtons to buttons of group 1 of group 1 of window 1
              repeat with chatButton in chatButtons
                set buttonName to name of chatButton
                if buttonName is not "New chat" then
                  set end of conversationsList to buttonName
                end if
              end repeat
            on error
              set conversationsList to {"Unable to retrieve conversations"}
            end try
            
            return conversationsList
          end tell
        end tell
      end tell
    `);
    
    // Parse the AppleScript result into an array
    const conversations = result.split(", ");
    return conversations;
  } catch (error) {
    console.error("Error getting ChatGPT conversations:", error);
    return ["Error retrieving conversations"];
  }
}

function isChatGPTArgs(args: unknown): args is {
  operation: "ask" | "get_conversations";
  prompt?: string;
  conversation_id?: string;
} {
  if (typeof args !== "object" || args === null) return false;
  
  const { operation, prompt, conversation_id } = args as any;
  
  if (!operation || !["ask", "get_conversations"].includes(operation)) {
    return false;
  }
  
  // Validate required fields based on operation
  if (operation === "ask" && !prompt) return false;
  
  // Validate field types if present
  if (prompt && typeof prompt !== "string") return false;
  if (conversation_id && typeof conversation_id !== "string") return false;
  
  return true;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [CHATGPT_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("No arguments provided");
    }

    if (name === "chatgpt") {
      if (!isChatGPTArgs(args)) {
        throw new Error("Invalid arguments for ChatGPT tool");
      }

      switch (args.operation) {
        case "ask": {
          if (!args.prompt) {
            throw new Error("Prompt is required for ask operation");
          }
          
          const response = await askChatGPT(args.prompt, args.conversation_id);
          
          return {
            content: [{ 
              type: "text", 
              text: response || "No response received from ChatGPT."
            }],
            isError: false
          };
        }

        case "get_conversations": {
          const conversations = await getConversations();
          
          return {
            content: [{ 
              type: "text", 
              text: conversations.length > 0 ? 
                `Found ${conversations.length} conversation(s):\n\n${conversations.join("\n")}` :
                "No conversations found in ChatGPT."
            }],
            isError: false
          };
        }

        default:
          throw new Error(`Unknown operation: ${args.operation}`);
      }
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("ChatGPT MCP Server running on stdio");
