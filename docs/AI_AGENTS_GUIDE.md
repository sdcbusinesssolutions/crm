# AI Agents & Knowledge Base Guide

Transform your flows with intelligent AI Agents capable of chat, voice interaction, and call management.

## 1. Prerequisites
Before starting, ensure your server is configured with an OpenAI API Key.
- Open `.env` file in `server/`.
- Add: `OPENAI_API_KEY=sk-your-key-here`
- Restart the server.

## 2. Creating an AI Agent
1. **Navigate to AI Buddy**: Click on "AI Buddy" in the left sidebar menu.
2. **Create Agent**: Click the **"+ Create Agent"** button.
3. **Configure**:
   - **Name**: Give your agent a name (e.g., "Support Bot").
   - **Type**: Select "AI Chatbot" (Voice/Call features coming soon).
   - **System Prompt**: This is the "brain" of your agent. Describe its personality and rules.
     - *Example*: "You are a helpful customer support agent for Acme Corp. Be polite and concise."
4. **Save**: Click Create.

## 3. Adding Knowledge (RAG)
You can upload documents so the AI knows about your business.
1. Find your agent in the list.
2. Click **"Add Knowledge"** button on the agent card.
3. Select a file (`.pdf`, `.txt`, `.md`, `.csv`).
4. The file is uploaded and context will be injected into the AI's prompts automatically.

## 4. Using in Flows
To use your agent in a WhatsApp flow:

1. **Go to Flows**: Create or edit a flow.
2. **Add Node**: Drag the **"AI Agent"** node from the sidebar side panel (under "Advanced" or "Integrations").
   - *Note: If you don't see the node yet, ensure your Flow Editor is updated with the new node type `aiAgent`.*
3. **Configure Node**:
   - **Agent ID**: Copy the Agent ID from the AI Buddy list (displayed on the card, click to copy).
   - **User Query**: Enter the text the AI should respond to. Usually, this is a variable from a previous step (e.g., `{{last_message_body}}`).
   - **Output Variable**: Name the variable where the AI response will be saved (e.g., `ai_reply`).
4. **Send Reply**: Add a "Text Message" node afterwards and use `{{ai_reply}}` in the body to send the answer back to the user.

## 5. Troubleshooting
- **AI Error**: If the agent fails, check the Server Logs. Common issues are missing API Keys or invalid models.
- **Knowledge Not Used**: Ensure the file was uploaded successfully. Large files might be truncated in the MVP version.

---
**Advanced**: The AI Agent uses `gpt-3.5-turbo` by default. You can customize the model in the database directly (`model_config` column) if needed.
