
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
  AskInput = 'askInput',
}

export interface NodeData {
  label: string;
  [key: string]: any;
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
}

export interface WriteAttributeData extends NodeData {
  agentId: string;
}

export interface TimingData extends NodeData {
  delaySeconds?: number;
  delayValue: number;
  delayUnit: 'Seconds' | 'Minutes' | 'Hours' | 'Days' | 'Weeks';
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

export interface GsheetData extends NodeData {
  spreadsheetId: string;
  sheetName: string;
  action: 'READ' | 'WRITE';
  range: string;
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

export interface AskAnythingData extends NodeData {
  text: string;
  validateResponse: boolean;
  saveResponse: boolean;
  ifUnresponsive: boolean;
  saveResponseAttribute?: string;
  saveResponseNewAttribute?: string;
  unresponsiveTimeout?: string;
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
  | GsheetData
  | CodeData
  | CatalogueMessageData
  | AppointmentData
  | ManageCartData
  | PaymentData
  | AskLocationData
  | CheckConditionData
  | AskAnythingData
  | AskInputData;

export interface AskInputData extends NodeData {
  inputType: 'Text' | 'Media';
  textInputType?: 'Name' | 'Email' | 'Phone' | 'Date' | 'Number' | 'Text' | 'Custom';
  mediaInputType?: 'Image' | 'Video' | 'Audio' | 'Document';
  allowedFormats?: string[];
  text?: string;
  retryCount: number;
  retryMessage: string;
  timeout: number;
  timeoutUnit: 'Seconds' | 'Minutes' | 'Hours';
  timeoutMessage: string;
  validationRegex?: string;
  errorMessage: string;
  ifUnresponsive: boolean;
  outputVariableName?: string;
  dateFormat?: string; // e.g. 'DD/MM/YYYY'
  dateValidationRegex?: string;
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
  status?: 'Active' | 'Archive';
}

export interface ThemeConfig {
  id: string; // 'default', 'ocean', 'custom', etc.
  name: string;
  appName?: string; // New: Custom App Name
  logoUrl?: string; // If null, use default SVG
  buttonStyle?: 'rounded' | 'sharp' | 'pill'; // New: Button Border Radius preference
  colors: {
    brand: string; // Primary interactive color (Buttons, Links, Active States)
    background: string; // App background color
    surface: string; // Cards, Sidebar background
    text: string; // Main text color
    sidebarText: string; // Sidebar text color
    sidebarActiveBg: string; // Sidebar active item background
  }
}

export interface CarouselCard {
  id: string;
  header: {
    format: 'IMAGE' | 'VIDEO';
    url?: string; // made optional
  };
  body: string;
  buttons: any[];
  components?: any[];
}

export interface CarouselMessageData extends NodeData {
  cards: CarouselCard[];
  carouselMediaUrls?: Record<number, string>; // Mapping idx -> url
}
