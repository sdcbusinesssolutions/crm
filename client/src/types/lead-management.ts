/**
 * TypeScript Type Definitions for Lead Management & Form Builder
 * 
 * These types match the Supabase database schema
 */

// =====================================================
// ENUMS
// =====================================================

export type OrgMemberRole = 'admin' | 'member' | 'viewer';

export type LeadStatus = 'active' | 'won' | 'lost' | 'archived';

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';

export type LeadSource =
    | 'manual'
    | 'web_form'
    | 'api'
    | 'import'
    | 'referral'
    | 'social_media'
    | 'advertisement';

export type LeadEventType =
    | 'stage_changed'
    | 'status_changed'
    | 'note_added'
    | 'email_sent'
    | 'call_made'
    | 'form_submitted'
    | 'task_created'
    | 'owner_changed'
    | 'custom';

export type FormFieldType =
    | 'text'
    | 'email'
    | 'phone'
    | 'number'
    | 'textarea'
    | 'select'
    | 'multiselect'
    | 'checkbox'
    | 'radio'
    | 'date'
    | 'datetime'
    | 'file'
    | 'url';

// =====================================================
// DATABASE TABLES
// =====================================================

export interface Organization {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface OrganizationMember {
    id: string;
    org_id: string;
    user_id: string;
    role: OrgMemberRole;
    created_at: string;
}

export interface Pipeline {
    id: string;
    org_id: string;
    name: string;
    description?: string;
    color: string;
    is_active: boolean;
    is_default?: boolean;
    settings: Record<string, any>;
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface PipelineStage {
    id: string;
    pipeline_id: string;
    name: string;
    description?: string;
    color: string;
    display_order: number;
    is_active: boolean;
    settings: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface Lead {
    id: string;
    org_id: string;

    // Contact Information
    name?: string;
    email?: string;
    phone?: string;
    company?: string;

    // Pipeline Assignment
    pipeline_id?: string;
    stage_id?: string;

    // Assignment & Ownership
    owner_id?: string;

    // Categorization
    tags: string[];
    group_ids: string[];
    type?: string; // 'Lead' | 'Customer'

    // Source Tracking
    source: LeadSource;
    source_details: Record<string, any>;

    // Custom Fields
    custom_fields: Record<string, any>;
    custom_data?: Record<string, any>;

    // Status & Priority
    status: LeadStatus | string;
    priority: LeadPriority;

    // Value & Scoring
    estimated_value?: number;
    lead_score: number;

    // Timestamps
    last_contacted_at?: string;
    created_at: string;
    updated_at: string;
}

export interface LeadEvent {
    id: string;
    lead_id: string;
    org_id: string;
    event_type: LeadEventType;
    event_data: Record<string, any>;
    previous_value?: string;
    new_value?: string;
    triggered_by?: string;
    created_at: string;
}

export interface FormField {
    name: string;
    type: FormFieldType;
    label: string;
    placeholder?: string;
    required?: boolean;
    options?: string[] | { label: string; value: string }[];
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        message?: string;
    };
    defaultValue?: any;
    helpText?: string;
}

export interface FormStep {
    id: string;
    title: string;
    description?: string;
    fields: string[]; // Array of field names
}

export interface FormStyling {
    backgroundColor?: string;
    primaryColor?: string;
    buttonText?: string;
    buttonColor?: string;
    buttonTextColor?: string;
    fontFamily?: string;
    borderRadius?: string;
    inputStyle?: Record<string, any>;
}

export interface AutomationAction {
    type: 'email' | 'webhook' | 'tag' | 'assign' | 'custom';
    config: Record<string, any>;
}

export interface FormDefinition {
    id: string;
    org_id: string;

    // Basic Info
    name: string;
    description?: string;

    // Public Access
    form_token: string;
    is_active: boolean;

    // Form Fields
    fields: FormField[];

    // Routing Configuration
    pipeline_id?: string;
    stage_id?: string;
    default_owner_id?: string;
    default_tags: string[];
    default_group_ids: string[];

    // Styling
    styling: FormStyling;

    // Additional Settings (Declaration, etc.)
    settings: {
        declaration?: {
            enabled: boolean;
            title: string;
            link: string;
        };
        [key: string]: any;
    };

    // Multi-step
    is_multistep: boolean;
    steps: FormStep[];

    // Post-submission
    success_message: string;
    success_redirect_url?: string;
    automation_actions: AutomationAction[];
    notification_emails: string[];

    // Analytics
    submission_count: number;
    last_submission_at?: string;

    // Metadata
    created_by?: string;
    created_at: string;
    updated_at: string;
}

export interface FormSubmission {
    id: string;
    form_id: string;
    lead_id?: string;
    submission_data: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    referrer?: string;
    submitted_at: string;
}

export interface ContactGroup {
    id: string;
    org_id?: string;
    user_id: string;
    name: string;
    description?: string;
    status?: string;
    created_at: string;
}

// =====================================================
// EXTENDED TYPES (with relations)
// =====================================================

export interface PipelineWithStages extends Pipeline {
    stages: PipelineStage[];
}

export interface LeadWithRelations extends Lead {
    pipeline?: Pipeline;
    stage?: PipelineStage;
    owner?: {
        id: string;
        email: string;
        name?: string;
    };
    events?: LeadEvent[];
}

export interface StageWithLeads extends PipelineStage {
    leads: Lead[];
    lead_count?: number;
}

export interface FormWithStats extends FormDefinition {
    submission_count: number;
    last_submission_at?: string;
    conversion_rate?: number;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreatePipelineRequest {
    org_id?: string;
    name: string;
    description?: string;
    color?: string;
    stages?: Array<{
        name: string;
        description?: string;
        color?: string;
        display_order: number;
    }>;
}

export interface CreateLeadRequest {
    org_id: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    pipeline_id?: string;
    stage_id?: string;
    owner_id?: string;
    tags?: string[];
    group_ids?: string[];
    custom_fields?: Record<string, any>;
    source?: LeadSource;
    priority?: LeadPriority;
}

export interface UpdateLeadRequest {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    pipeline_id?: string;
    stage_id?: string;
    owner_id?: string;
    tags?: string[];
    group_ids?: string[];
    custom_fields?: Record<string, any>;
    status?: LeadStatus;
    priority?: LeadPriority;
    estimated_value?: number;
    lead_score?: number;
}

export interface MoveLeadRequest {
    lead_id: string;
    new_stage_id: string;
}

export interface SearchLeadsRequest {
    org_id: string;
    search_text?: string;
    pipeline_id?: string;
    stage_id?: string;
    owner_id?: string;
    tags?: string[];
    status?: LeadStatus;
    limit?: number;
    offset?: number;
}

export interface CreateFormRequest {
    org_id?: string;
    name: string;
    description?: string;
    fields: FormField[];
    pipeline_id?: string;
    stage_id?: string;
    default_owner_id?: string;
    default_tags?: string[];
    default_group_ids?: string[];
    styling?: FormStyling;
    is_multistep?: boolean;
    steps?: FormStep[];
    success_message?: string;
    success_redirect_url?: string;
    automation_actions?: AutomationAction[];
    notification_emails?: string[];
}

export interface SubmitFormRequest {
    p_form_token: string;
    p_submission_data: Record<string, any>;
    p_ip_address?: string;
    p_user_agent?: string;
    p_referrer?: string;
}

export interface SubmitFormResponse {
    success: boolean;
    lead_id?: string;
    submission_id?: string;
    error?: string;
}

// =====================================================
// FILTER & SORT TYPES
// =====================================================

export interface LeadFilters {
    pipeline_id?: string;
    stage_id?: string;
    owner_id?: string;
    tags?: string[];
    group_ids?: string[];
    status?: LeadStatus;
    priority?: LeadPriority;
    source?: LeadSource;
    search?: string;
    date_from?: string;
    date_to?: string;
}

export type LeadSortField =
    | 'created_at'
    | 'updated_at'
    | 'name'
    | 'email'
    | 'company'
    | 'lead_score'
    | 'estimated_value';

export type SortDirection = 'asc' | 'desc';

export interface LeadSort {
    field: LeadSortField;
    direction: SortDirection;
}

// =====================================================
// KANBAN VIEW TYPES
// =====================================================

export interface KanbanColumn {
    stage: PipelineStage;
    leads: Lead[];
    total_count: number;
    total_value?: number;
}

export interface KanbanBoard {
    pipeline: Pipeline;
    columns: KanbanColumn[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// =====================================================
// ANALYTICS TYPES
// =====================================================

export interface PipelineAnalytics {
    pipeline_id: string;
    total_leads: number;
    total_value: number;
    conversion_rate: number;
    average_time_in_pipeline: number; // in days
    stage_analytics: Array<{
        stage_id: string;
        stage_name: string;
        lead_count: number;
        total_value: number;
        average_time_in_stage: number;
        conversion_rate: number;
    }>;
}

export interface FormAnalytics {
    form_id: string;
    total_submissions: number;
    unique_submissions: number;
    conversion_rate: number;
    average_completion_time: number; // in seconds
    field_analytics: Array<{
        field_name: string;
        completion_rate: number;
        drop_off_rate: number;
    }>;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface PaginationParams {
    page: number;
    per_page: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

export interface ApiError {
    message: string;
    code?: string;
    details?: any;
}

export interface ApiResponse<T> {
    data?: T;
    error?: ApiError;
}

// =====================================================
// SUPABASE CLIENT TYPES
// =====================================================

export interface Database {
    public: {
        Tables: {
            orgs: {
                Row: Organization;
                Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at' | 'settings'> & { settings?: Record<string, any> };
                Update: Partial<Omit<Organization, 'id' | 'created_at' | 'updated_at'>>;
            };
            org_members: {
                Row: OrganizationMember;
                Insert: Omit<OrganizationMember, 'id' | 'created_at'>;
                Update: Partial<Omit<OrganizationMember, 'id' | 'created_at'>>;
            };
            pipelines: {
                Row: Pipeline;
                Insert: Omit<Pipeline, 'id' | 'created_at' | 'updated_at' | 'settings' | 'color' | 'is_active' | 'description'> & {
                    settings?: Record<string, any>;
                    color?: string;
                    is_active?: boolean;
                    description?: string;
                };
                Update: Partial<Omit<Pipeline, 'id' | 'created_at' | 'updated_at'>>;
            };
            pipeline_stages: {
                Row: PipelineStage;
                Insert: Omit<PipelineStage, 'id' | 'created_at' | 'updated_at' | 'settings' | 'color' | 'display_order' | 'is_active' | 'description'> & {
                    settings?: Record<string, any>;
                    color?: string;
                    display_order?: number;
                    is_active?: boolean;
                    description?: string;
                };
                Update: Partial<Omit<PipelineStage, 'id' | 'created_at' | 'updated_at'>>;
            };
            leads: {
                Row: Lead;
                Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'tags' | 'group_ids' | 'source' | 'source_details' | 'custom_fields' | 'status' | 'priority' | 'estimated_value' | 'win_probability' | 'expected_close_date' | 'notes' | 'owner_id' | 'pipeline_id' | 'stage_id' | 'name' | 'email' | 'phone' | 'company'> & {
                    tags?: string[];
                    group_ids?: string[];
                    source?: string;
                    source_details?: Record<string, any>;
                    custom_fields?: Record<string, any>;
                    status?: string;
                    priority?: string;
                    estimated_value?: number;
                    win_probability?: number;
                    expected_close_date?: string;
                    notes?: string;
                    owner_id?: string | null;
                    pipeline_id?: string | null;
                    stage_id?: string | null;
                    name?: string;
                    email?: string;
                    phone?: string;
                    company?: string;
                };
                Update: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>;
            };
            lead_events: {
                Row: LeadEvent;
                Insert: Omit<LeadEvent, 'id' | 'created_at' | 'triggered_by' | 'event_data'> & {
                    triggered_by?: string;
                    event_data?: Record<string, any>;
                };
                Update: Partial<Omit<LeadEvent, 'id' | 'created_at'>>;
            };
            form_definitions: {
                Row: FormDefinition;
                Insert: Omit<FormDefinition, 'id' | 'created_at' | 'updated_at' | 'settings' | 'styling' | 'fields' | 'notification_emails' | 'submission_count' | 'last_submission_at' | 'description' | 'is_active' | 'pipeline_id' | 'stage_id' | 'default_owner_id' | 'default_tags' | 'default_group_ids' | 'success_message' | 'success_redirect_url'> & {
                    settings?: Record<string, any>;
                    styling?: FormStyling;
                    fields?: FormField[];
                    notification_emails?: string[];
                    submission_count?: number;
                    last_submission_at?: string;
                    description?: string;
                    is_active?: boolean;
                    pipeline_id?: string | null;
                    stage_id?: string | null;
                    default_owner_id?: string | null;
                    default_tags?: string[];
                    default_group_ids?: string[];
                    success_message?: string;
                    success_redirect_url?: string;
                };
                Update: Partial<Omit<FormDefinition, 'id' | 'created_at' | 'updated_at'>>;
            };
            form_submissions: {
                Row: FormSubmission;
                Insert: Omit<FormSubmission, 'id' | 'submitted_at' | 'metadata' | 'ip_address' | 'user_agent' | 'referrer'> & {
                    metadata?: Record<string, any>;
                    ip_address?: string;
                    user_agent?: string;
                    referrer?: string;
                };
                Update: Partial<Omit<FormSubmission, 'id' | 'submitted_at'>>;
            };
            contact_groups: {
                Row: ContactGroup;
                Insert: Omit<ContactGroup, 'id' | 'created_at' | 'description' | 'status'> & {
                    description?: string;
                    status?: string;
                };
                Update: Partial<Omit<ContactGroup, 'id' | 'created_at'>>;
            };
        };
        Functions: {
            submit_form: {
                Args: SubmitFormRequest;
                Returns: SubmitFormResponse;
            };
            generate_form_token: {
                Args: Record<string, never>;
                Returns: string;
            };
            search_leads: {
                Args: SearchLeadsRequest;
                Returns: Lead[];
            };
        };
    };
}

// =====================================================
// FORM BUILDER SPECIFIC TYPES
// =====================================================

export interface FormBuilderState {
    fields: FormField[];
    styling: FormStyling;
    settings: {
        is_multistep: boolean;
        steps: FormStep[];
        success_message: string;
        success_redirect_url?: string;
    };
    routing: {
        pipeline_id?: string;
        stage_id?: string;
        default_owner_id?: string;
        default_tags: string[];
        default_group_ids: string[];
    };
}

export interface DragDropResult {
    draggableId: string;
    source: {
        droppableId: string;
        index: number;
    };
    destination?: {
        droppableId: string;
        index: number;
    };
}

// =====================================================
// WEBHOOK TYPES
// =====================================================

export interface WebhookPayload {
    event: 'lead.created' | 'lead.updated' | 'lead.stage_changed' | 'form.submitted';
    data: Lead | FormSubmission;
    timestamp: string;
    org_id: string;
}

// =====================================================
// EXPORT ALL
// =====================================================

export type {
    // Add any additional exports here
};
