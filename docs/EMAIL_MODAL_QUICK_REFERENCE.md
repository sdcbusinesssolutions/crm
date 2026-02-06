# Email Modal - Quick Reference Guide

## For End Users

### How to Send an Email to a Lead

1. **Navigate to Pipeline View**
   - Go to Lead CRM → Pipelines
   - Select your pipeline

2. **Find the Lead**
   - Locate the lead card in the pipeline
   - Ensure the lead has an email address

3. **Click Email Icon**
   - Click the envelope icon (📧) on the lead card
   - The email modal will open

4. **Compose Your Email**
   - **Connection Type**: Choose Gmail or SMTP
   - **Connection**: Select from your configured connections
   - **To**: Pre-filled with lead's email (editable)
   - **Subject**: Pre-filled with "Hello [Lead Name]" (editable)
   - **Message**: Type your email content

5. **Send**
   - Click "Send Email" button
   - Wait for confirmation
   - Modal will close automatically on success

### Prerequisites

Before you can send emails, you must configure at least one email connection:

#### Gmail Setup
1. Go to Settings → Integrations
2. Find the Gmail card
3. Click "Connect" or "Add New"
4. Choose authentication method:
   - **OAuth2**: Provide Client ID and Secret
   - **Service Account**: Upload JSON key
5. Complete the authentication flow

#### SMTP Setup
1. Go to Settings → Integrations
2. Find the SMTP card
3. Click "Connect SMTP" or "Add New"
4. Fill in connection details:
   - Connection Name
   - Host (e.g., smtp.gmail.com)
   - Port (e.g., 587)
   - Username
   - Password
   - Encryption (optional)
5. Save connection

### Troubleshooting

**"No Gmail/SMTP Connection Found"**
- You need to configure at least one connection first
- Go to Settings → Integrations to set up

**Email Not Sending**
- Check your internet connection
- Verify the recipient email is valid
- Ensure your email connection is still active
- Check if you've exceeded your email quota

**Connection Failed**
- For Gmail: Verify OAuth credentials or Service Account permissions
- For SMTP: Check host, port, username, and password
- Ensure firewall isn't blocking SMTP ports

---

## For Developers

### Using EmailModal in Other Components

```typescript
import EmailModal from './EmailModal';

function MyComponent() {
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState({ email: '', name: '' });

    const handleEmailClick = (email: string, name: string) => {
        setEmailRecipient({ email, name });
        setIsEmailModalOpen(true);
    };

    return (
        <>
            <button onClick={() => handleEmailClick('user@example.com', 'John Doe')}>
                Send Email
            </button>

            <EmailModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                recipientEmail={emailRecipient.email}
                recipientName={emailRecipient.name}
            />
        </>
    );
}
```

### Props Interface

```typescript
interface EmailModalProps {
    isOpen: boolean;           // Controls modal visibility
    onClose: () => void;       // Callback when modal closes
    recipientEmail?: string;   // Pre-fill recipient email
    recipientName?: string;    // Pre-fill subject with name
}
```

### Integration Service Methods

```typescript
// Get available connections
const gmailConnections = await integrationsService.getGmailConnections();
const smtpConnections = await integrationsService.getSmtpConnections();

// Send email via Gmail
await integrationsService.sendGmailEmail(
    connectionId,  // Connection ID from getGmailConnections()
    to,           // Recipient email
    subject,      // Email subject
    body          // Email body (plain text)
);

// Send email via SMTP
await integrationsService.sendSmtpEmail(
    connectionId,  // Connection ID from getSmtpConnections()
    to,           // Recipient email
    subject,      // Email subject
    body          // Email body (plain text)
);
```

### Backend API Endpoints

#### Gmail

**Get Connections**
```
GET /api/integrations/gmail/connections
Headers: Authorization: Bearer <token>
Response: Array<{ id, connection_name, created_at, metadata }>
```

**Send Email**
```
POST /api/integrations/gmail/send
Headers: 
  Authorization: Bearer <token>
  Content-Type: application/json
Body: {
  connectionId: string,
  to: string,
  subject: string,
  body: string
}
Response: { success: true, messageId: string }
```

#### SMTP

**Get Connections**
```
GET /api/integrations/smtp/connections
Headers: Authorization: Bearer <token>
Response: Array<{ id, connection_name, host, user, fromEmail, created_at }>
```

**Send Email**
```
POST /api/integrations/smtp/send
Headers: 
  Authorization: Bearer <token>
  Content-Type: application/json
Body: {
  connectionId: string,
  to: string,
  subject: string,
  body: string
}
Response: { success: true }
```

### Customization

#### Styling
The EmailModal uses CSS variables for theming:
- `--color-brand`: Primary brand color
- `--color-text`: Text color
- `--color-border`: Border color
- `--color-input-bg`: Input background color
- `--color-surface`: Surface color
- `--color-bg`: Background color

#### Extending Functionality

**Add CC/BCC Fields:**
```typescript
// In EmailModal.tsx
const [cc, setCc] = useState('');
const [bcc, setBcc] = useState('');

// Add input fields in the form
<input
    type="email"
    placeholder="CC"
    value={cc}
    onChange={e => setCc(e.target.value)}
/>
```

**Add Attachments:**
```typescript
// In EmailModal.tsx
const [attachments, setAttachments] = useState<File[]>([]);

// Add file input
<input
    type="file"
    multiple
    onChange={e => setAttachments(Array.from(e.target.files || []))}
/>

// Update send method to include attachments
// Note: Backend needs to be updated to handle multipart/form-data
```

**Add Email Templates:**
```typescript
const templates = {
    welcome: {
        subject: 'Welcome to our service',
        body: 'Dear {{name}},\n\nWelcome...'
    },
    followup: {
        subject: 'Following up on {{topic}}',
        body: 'Hi {{name}},\n\nI wanted to follow up...'
    }
};

// Add template selector
<select onChange={(e) => applyTemplate(e.target.value)}>
    <option value="">Select template</option>
    {Object.keys(templates).map(key => (
        <option key={key} value={key}>{key}</option>
    ))}
</select>
```

### Testing

**Unit Tests:**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailModal from './EmailModal';

test('opens modal and sends email', async () => {
    const onClose = jest.fn();
    
    render(
        <EmailModal
            isOpen={true}
            onClose={onClose}
            recipientEmail="test@example.com"
            recipientName="Test User"
        />
    );

    // Fill form
    fireEvent.change(screen.getByLabelText(/subject/i), {
        target: { value: 'Test Subject' }
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
        target: { value: 'Test Body' }
    });

    // Send
    fireEvent.click(screen.getByText(/send email/i));

    // Verify
    await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
    });
});
```

### Performance Considerations

- **Connection Loading**: Connections are loaded only when modal opens
- **Auto-selection**: First connection is auto-selected to reduce clicks
- **Debouncing**: Consider adding debouncing for real-time validation
- **Caching**: Consider caching connections to avoid repeated API calls

### Security Notes

- All API calls require authentication (Bearer token)
- Passwords are never returned in connection lists
- Email content is sent over HTTPS
- Rate limiting should be implemented on the backend
- Validate email addresses on both frontend and backend
