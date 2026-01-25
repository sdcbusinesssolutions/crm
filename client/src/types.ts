
export enum NodeType {
  OnMessage = 'onMessage',
  TextMessage = 'textMessage',
  MediaMessage = 'mediaMessage',
  Webhook = 'webhook',
  SetWebhook = 'setWebhook',
  WriteAttribute = 'writeAttribute',
  Timing = 'timing',
  Takeaway = 'takeaway',
  Delivery = 'delivery',
  AddressMessage = 'addressMessage',
  ListMessage = 'listMessage',
  QuickReplyMessage = 'quickReplyMessage',
  CTAMessage = 'ctaMessage',
  Gsheet = 'gsheet',
  Code = 'code',
  CatalogueMessage = 'catalogueMessage',
  Appointment = 'appointment',
  ManageCart = 'manageCart',
  Payment = 'payment',
  AskLocation = 'askLocation',
  Trigger = 'trigger',
  AskAnything = 'askAnything',
  CheckCondition = 'checkCondition',
  CarouselMessage = 'carouselMessage',
  SendFlow = 'sendFlow',
  CallApi = 'callApi',
  TemplateMessage = 'templateMessage',
  Switch = 'switch',
  ManageTags = 'manageTags',
  ManageGroups = 'manageGroups',
  AskInput = 'askInput',
  NewLead = 'newLead',
  ContactPipeline = 'contactPipeline',
  Gmail = 'gmail',
  Calendar = 'calendar',
  PipelineTrigger = 'pipelineTrigger',
  TaskReminder = 'taskReminder',
  SheetTrigger = 'sheetTrigger',
  AIAgent = 'aiAgent',
}

export interface NodeData {
  label: string;
  [key: string]: any;
}

export interface AIAgentData extends NodeData {
  systemPrompt?: string;
  model?: string;
  outputVariableName: string;
  mode?: 'chat' | 'assistant';
  assistantId?: string;
}

export interface SheetTriggerData extends NodeData {
  credentialId?: string; // connectionId
  connectionId?: string;
  spreadsheetId: string;
  sheetName: string;
  phoneColumn: string;
  statusColumn?: string; // Optional: Write back status
  triggerCondition?: ConditionRule[]; // Optional filter
}

export interface GmailData extends NodeData {
  connectionId: string;
  to: string;
  subject: string;
  body: string;
}

export interface CalendarData extends NodeData {
  connectionId: string;
  action: 'create_event' | 'check_availability' | 'get_available_slots';
  summary: string;
  description: string;
  startTime: string; // ISO string or variable
  endTime: string;   // ISO string or variable
  duration?: number; // Duration length
  durationUnit?: 'minutes' | 'hours';
  attendees: string; // Comma separated emails
  addMeetLink: boolean;
  // Output variables
  outputVariableName?: string; // For availability result or slot list
  // Availability Config
  workStartHour?: number; // e.g., 9
  workEndHour?: number;   // e.g., 17
  daysToCheck?: number;   // e.g., 3
}

export interface OnMessageData extends NodeData {
  messageType: 'Text' | 'Image' | 'Audio' | 'Video' | 'Document';
  keywords: string[];
  phoneNumbers: string[];
}

export interface TextMessageData extends NodeData {
  message: string;
}

export enum MediaType {
  Video = 'Video',
  Image = 'Image',
  Audio = 'Audio',
  Document = 'Document',
}

export interface MediaMessageData extends NodeData {
  mediaType: MediaType;
  url: string;
  caption?: string;
  filename?: string;
}

export interface WebhookData extends NodeData {
  eventType: string;
}

export interface SetWebhookData extends NodeData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: { key: string; value: string }[];
  params: { key: string; value: string }[];
  body: string;
  webhookId?: string;
  outputVariables?: string[];
}

export interface WriteAttributeData extends NodeData {
  agentId: string;
}

export interface TimingData extends NodeData {
  delaySeconds?: number;
  delayValue: number;
  delayUnit: 'Seconds' | 'Minutes' | 'Hours' | 'Days' | 'Weeks' | 'Custom Date';
  customDate?: string;
}

export interface TakeawayData extends NodeData {
  storeId: string;
}

export interface DeliveryData extends NodeData {
  serviceId: string;
}

export interface AddressMessageData extends NodeData {
  name: string;
  address: string;
}

export interface ListItem { // A row within a section
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  id: string;
  title: string;
  items: ListItem[];
}

export interface ListMessageData extends NodeData {
  header?: string;
  body: string;
  footer?: string;
  buttonText: string;
  sections: ListSection[];
  validateResponse: boolean;
  saveResponse: boolean;
  ifUnresponsive: boolean;
  saveResponseAttribute?: string;
  saveResponseNewAttribute?: string;
  unresponsiveTimeout?: string;
  dynamicSections?: string;
  outputVariableName?: string;
}



export interface QuickReply {
  id: string;
  title: string;
}
export interface QuickReplyMessageData extends NodeData {
  headerType: 'None' | 'Text' | 'Image' | 'Video' | 'Document';
  headerText: string;
  headerImage?: string;
  headerUrl?: string;
  body: string;
  footer: string;
  buttons: QuickReply[];
  validateResponse: boolean;
  saveResponse: boolean;
  ifUnresponsive: boolean;
  saveResponseAttribute?: string;
  saveResponseNewAttribute?: string;
  unresponsiveTimeout?: string;
}



export interface CTAMessageData extends NodeData {
  headerType: 'None' | 'Text' | 'Image' | 'Video' | 'Document';
  headerText?: string;
  headerImage?: string;
  headerUrl?: string;
  body: string;
  displayText: string;
  url: string;
  footer: string;
}

export interface CarouselCard {
  id: string;
  cardIndex: number;
  headerType: 'image' | 'video';
  mediaUrl: string;
  bodyText: string;
  buttonText: string;
  buttonUrl: string;
}

export interface CarouselMessageData extends NodeData {
  body: string;
  cards: CarouselCard[];
}




export interface GsheetData extends NodeData {
  credentialId?: string;
  clientId?: string;
  clientSecret?: string;
  spreadsheetId: string;
  sheetName: string;
  sheetId?: number;
  operation: 'append' | 'read' | 'update' | 'clear';
  range?: string;
  rowData?: Record<string, string>;
  columns?: string[]; // Cached columns for variable generation
  lookupColumn?: string; // Add lookupColumn for read/update
  lookupValue?: string; // Add lookupValue for read/update
}

export interface CodeData extends NodeData {
  code: string;
}

export interface CatalogueItem {
  productId: string;
}
export interface CatalogueMessageData extends NodeData {
  header: string;
  body: string;
  items: CatalogueItem[];
}

export interface AppointmentData extends NodeData {
  calendarId: string;
  durationMinutes: number;
}

export interface ManageCartData extends NodeData {
  action: 'ADD' | 'REMOVE' | 'CLEAR';
  productId?: string;
  quantity?: number;
}

export interface PaymentData extends NodeData {
  provider: string;
  amount: number;
  currency: string;
}

export interface AskLocationData extends NodeData {
  text: string;
}


export interface AskInputData extends NodeData {
  inputType: 'Text' | 'Media';
  textInputType?: 'Name' | 'Email' | 'Phone' | 'Date' | 'Number' | 'Text' | 'Custom';
  mediaInputType?: 'Image' | 'Video' | 'Audio' | 'Document'; // Changed to single selection
  allowedFormats?: string[]; // E.g., ['jpg', 'png'] or empty for Any
  text?: string; // The prompt message
  retryCount: number;
  retryMessage: string;
  timeout: number; // in seconds or minutes (value)
  timeoutUnit: 'Seconds' | 'Minutes' | 'Hours';
  timeoutMessage: string;
  validationRegex?: string;
  errorMessage: string; // Generic invalid error
  ifUnresponsive: boolean; // inherited/compatible with existing logic
  outputVariableName?: string;
  dateFormat?: string;
  dateValidationRegex?: string;
}

export interface AskAnythingData extends NodeData {
  text: string;
  validateResponse: boolean;
  saveResponse: boolean;
  ifUnresponsive: boolean;
  saveResponseAttribute?: string;
  saveResponseNewAttribute?: string;
  unresponsiveTimeout?: string;
}



export interface SendFlowData extends NodeData {
  flowId: string;
  flowName: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  ctaText?: string;
  flowFields?: string[];
  validateResponse: boolean;
  saveResponse: boolean;
  ifUnresponsive: boolean;
  saveResponseAttribute?: string;
  saveResponseNewAttribute?: string;
  unresponsiveTimeout?: string;
  outputVariableName?: string;
}



export interface ConditionRule {
  id: string;
  logicalOperator?: 'AND' | 'OR';
  attribute: string;
  operator: 'is' | 'is not' | 'contains' | 'does not contain' | 'starts with' | 'ends with';
  value: string;
}

export interface ConditionGroup {
  id: string;
  name: string;
  rules: ConditionRule[];
}

export interface CheckConditionData extends NodeData {
  conditions: ConditionGroup[];
}

export interface SwitchCase {
  id: string; // Used as the handleId for the output edge
  label: string; // Display name on the node and in settings
  condition: ConditionRule; // The rule that triggers this case
}

export interface SwitchData extends NodeData {
  cases: SwitchCase[];
}

export interface CallApiData extends NodeData {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: { key: string; value: string }[];
  params: { key: string; value: string }[];
  bodyType: 'json' | 'form-data';
  bodyInputType: 'raw' | 'kv';
  body: string; // Used when bodyInputType is 'raw'
  bodyFields: { key: string; value: string }[]; // Used when bodyInputType is 'kv'
  outputVariables?: string[];
  authType?: 'none' | 'basic' | 'bearer' | 'header';
  authUsername?: string;
  authPassword?: string;
  authToken?: string;
  authHeaderName?: string;
  authHeaderValue?: string;
}

export interface TemplateMessageData extends NodeData {
  templateId: string;
  templateName: string;
  language: string;
  mediaUrl?: string; // For Header
  carouselMediaUrls?: Record<number, string>; // Map card index to media URL
  components?: any[]; // Snapshot of template components for execution
  variableMapping: Record<string, string>; // Mapping of {{1}} or {{name}} to value
  validateResponse: boolean;
  saveResponse: boolean;
  ifUnresponsive: boolean;
  unresponsiveTimeout?: string;
}

export interface ManageTagsData extends NodeData {
  action: 'add' | 'remove';
  tags: string[];
}

export interface ManageGroupsData extends NodeData {
  action: 'add' | 'remove';
  groups: string[]; // Group IDs
}

export type AnyNodeData =
  | NodeData
  | OnMessageData
  | TextMessageData
  | MediaMessageData
  | WebhookData
  | SetWebhookData
  | WriteAttributeData
  | TimingData
  | TakeawayData
  | DeliveryData
  | AddressMessageData
  | ListMessageData
  | QuickReplyMessageData
  | CTAMessageData
  | CarouselMessageData

  | GsheetData
  | CodeData
  | CatalogueMessageData
  | AppointmentData
  | ManageCartData
  | PaymentData
  | AskLocationData
  | CheckConditionData
  | AskAnythingData
  | SendFlowData
  | CallApiData
  | TemplateMessageData
  | SwitchData
  | ManageTagsData
  | ManageGroupsData
  | AskInputData
  | NewLeadData
  | NewLeadData
  | ContactPipelineData
  | ContactPipelineData
  | PipelineTriggerData
  | TaskReminderData
  | SheetTriggerData
  | GmailData
  | CalendarData;

export interface ContactPipelineData extends NodeData {
  name?: string;
  email?: string;
  pipelineId: string;
  stageId: string;
  outputVariableName?: string;
  customFields?: { key: string; value: string }[];
  // Deprecated: status (use stageId instead)
  status?: string;
}

export interface PipelineTriggerData extends NodeData {
  pipelineId: string;
  stageId: string; // empty means ANY
}

export interface TaskReminderData extends NodeData {
  titleFilter?: string;
  daysBeforeDue?: number;
  triggerEvent?: 'task_due' | 'task_completed' | 'task_upcoming' | 'task_overdue';
  timeOffset?: number; // minutes before (upcoming) or after (overdue)
}

export interface NewLeadData extends NodeData {
  // No specific configuration needed for now, but good to have the type
}

export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: AnyNodeData;
}

export interface Edge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  status: 'Draft' | 'Published';
  updatedAt: string;
  nodes: Node[];
  edges: Edge[];
}

export interface WhatsAppNumber {
  id: string;
  verifiedName: string;
  businessApp: string; // e.g. "Cloud API"
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  quality: 'GREEN' | 'YELLOW' | 'RED';
  throughput: 'STANDARD' | 'HIGH';
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  tags: string[];
  source?: string;
  createdAt: string;
  updatedAt?: string;
  groupIds?: string[]; // New: IDs of groups this contact belongs to
  customData?: Record<string, any>; // New: Key-value pairs for dynamic fields
}

export interface InputField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'email' | 'date' | 'time' | 'datetime-local' | 'url';
  placeholder?: string;
}

export interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  contactCount: number;
  createdAt: string;
  updatedAt?: string;
  status?: 'Active' | 'Archive';
}

export interface ThemeConfig {
  id: string; // 'default', 'ocean', 'custom', etc.
  name: string;
  appName?: string; // New: Custom App Name
  logoUrl?: string; // If null, use default SVG
  buttonStyle?: 'rounded' | 'sharp' | 'pill'; // New: Button Border Radius preference
  maxFileSize?: number; // New: Max file size in MB
  sidebarDisplay?: 'both' | 'logo_only' | 'name_only'; // New: Control what to show in sidebar header
  appNameImageUrl?: string; // New: Application Name Image URL
  faviconUrl?: string; // New: Custom Favicon URL
  appNameType?: 'text' | 'image'; // New: Preference for App Name display
  colors: {
    brand: string; // Primary interactive color (Buttons, Links, Active States)
    background: string; // App background color
    surface: string; // Cards, Sidebar background
    text: string; // Main text color
    sidebarText: string; // Sidebar text color
    sidebarActiveBg: string; // Sidebar active item background
    border?: string; // New: Border color for cards/inputs
    inputBg?: string; // New: Background for inputs
  }
}

export interface Conversation {
  id: string;
  contact_phone: string;
  contact_name?: string;
  last_message?: string;
  unread_count: number;
  status: 'open' | 'resolved' | 'pending';
  tags: string[];
  assigned_to?: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'location' | 'button_reply' | 'interactive' | 'contacts';
  text?: string;
  media_url?: string;
  filename?: string;
  mime_type?: string;
  latitude?: number;
  longitude?: number;
  direction: 'in' | 'out';
  status: 'sent' | 'delivered' | 'read';
  created_at: string;
}
