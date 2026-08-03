class AgentWidget extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Define widget state
        this.isOpen = false;
        this.agentId = this.getAttribute('id');
        this.backendUrl = "http://localhost:5000"; // Can be dynamic based on env later
        
        // Basic styling
        const style = document.createElement('style');
        style.textContent = `
            :host {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .chat-toggle {
                width: 60px;
                height: 60px;
                border-radius: 30px;
                background-color: #00684A;
                color: white;
                border: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            .chat-toggle:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
            }
            .chat-toggle svg {
                width: 32px;
                height: 32px;
                fill: currentColor;
            }
            .chat-window {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 380px;
                height: 600px;
                max-height: calc(100vh - 120px);
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                display: none;
                flex-direction: column;
                overflow: hidden;
                border: 1px solid #e2e8f0;
                transform-origin: bottom right;
                animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .chat-window.open {
                display: flex;
            }
            .chat-header {
                background: #00684A;
                color: white;
                padding: 16px;
                font-weight: 600;
                font-size: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .close-btn {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 4px;
                opacity: 0.8;
            }
            .close-btn:hover {
                opacity: 1;
            }
            .chat-body {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                background: #f8fafc;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .chat-footer {
                padding: 16px;
                background: white;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 8px;
            }
            .chat-input {
                flex: 1;
                padding: 10px 14px;
                border: 1px solid #cbd5e1;
                border-radius: 20px;
                outline: none;
                font-size: 14px;
            }
            .chat-input:focus {
                border-color: #00684A;
            }
            .send-btn {
                background: #00684A;
                color: white;
                border: none;
                border-radius: 20px;
                padding: 8px 16px;
                cursor: pointer;
                font-weight: 600;
            }
            @keyframes slideUp {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            
            @media (max-width: 480px) {
                .chat-window {
                    width: calc(100vw - 32px);
                    right: -8px;
                }
            }
        `;
        
        // Build DOM structure
        const container = document.createElement('div');
        
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.className = 'chat-toggle';
        this.toggleBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
        
        this.chatWindow = document.createElement('div');
        this.chatWindow.className = 'chat-window';
        
        const header = document.createElement('div');
        header.className = 'chat-header';
        header.innerHTML = `
            <span>Chat Support</span>
            <button class="close-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        `;
        
        this.chatBody = document.createElement('div');
        this.chatBody.className = 'chat-body';
        this.chatBody.innerHTML = '<div style="background:white;padding:12px;border-radius:12px;border-bottom-left-radius:2px;max-width:80%;box-shadow:0 1px 2px rgba(0,0,0,0.05);font-size:14px;color:#334155;">Hi! I am your AI assistant. How can I help you today?</div>';
        
        const footer = document.createElement('div');
        footer.className = 'chat-footer';
        
        this.input = document.createElement('input');
        this.input.className = 'chat-input';
        this.input.placeholder = 'Type your message...';
        
        const sendBtn = document.createElement('button');
        sendBtn.className = 'send-btn';
        sendBtn.textContent = 'Send';
        
        footer.appendChild(this.input);
        footer.appendChild(sendBtn);
        
        this.chatWindow.appendChild(header);
        this.chatWindow.appendChild(this.chatBody);
        this.chatWindow.appendChild(footer);
        
        container.appendChild(this.toggleBtn);
        container.appendChild(this.chatWindow);
        
        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(container);
        
        // Event Listeners
        this.toggleBtn.addEventListener('click', () => this.toggleChat());
        header.querySelector('.close-btn').addEventListener('click', () => this.toggleChat());
        
        const sendMessage = () => {
            const text = this.input.value.trim();
            if (!text) return;
            
            // Add user message to UI
            const msg = document.createElement('div');
            msg.style.cssText = 'background:#00684A;color:white;padding:12px;border-radius:12px;border-bottom-right-radius:2px;max-width:80%;align-self:flex-end;font-size:14px;';
            msg.textContent = text;
            this.chatBody.appendChild(msg);
            
            this.input.value = '';
            this.chatBody.scrollTop = this.chatBody.scrollHeight;
            
            // Send to server (placeholder logic)
            // fetch(this.backendUrl + '/api/ai-voice-agent/chat/' + this.agentId, { ... })
            setTimeout(() => {
                const reply = document.createElement('div');
                reply.style.cssText = 'background:white;padding:12px;border-radius:12px;border-bottom-left-radius:2px;max-width:80%;box-shadow:0 1px 2px rgba(0,0,0,0.05);font-size:14px;color:#334155;';
                reply.textContent = 'I am a demo AI agent widget. My backend connection will be implemented soon!';
                this.chatBody.appendChild(reply);
                this.chatBody.scrollTop = this.chatBody.scrollHeight;
            }, 1000);
        };
        
        sendBtn.addEventListener('click', sendMessage);
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
    
    toggleChat() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.chatWindow.classList.add('open');
            this.input.focus();
        } else {
            this.chatWindow.classList.remove('open');
        }
    }
}

if (!customElements.get('agent-widget')) {
    customElements.define('agent-widget', AgentWidget);
}
