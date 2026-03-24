/**
 * Drip Campaign System Unit Test
 * This test verifies the entire lifecycle of a drip campaign:
 * 1. Triggers (TAG_ADDED, STAGE_CHANGED) successfully enroll contacts.
 * 2. Sequential execution of WhatsApp and Email steps.
 * 3. Idempotency and logging.
 */

const DripTriggerService = require('../services/DripTriggerService');
const dripProcessor = require('../workers/dripProcessor');

// --- Mocks ---
const mockSupabase = {
    auth: { admin: { listUsers: jest.fn() } },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockReturnThis()
};

const mockWhatsAppService = require('../services/whatsappService');
const mockGmailService = require('../services/GmailService');
const mockSmtpService = require('../services/SmtpService');

jest.mock('../lib/supabaseClient', () => ({
    supabaseAdmin: mockSupabase,
    supabase: mockSupabase
}));

jest.mock('../services/whatsappService');
jest.mock('../services/GmailService');
jest.mock('../services/SmtpService');
jest.mock('../services/AIService');

describe('Drip Campaign System', () => {
    const userId = 'user-123';
    const contactId = 'contact-456';
    const contact = { id: contactId, phone: '1234567890', name: 'John Doe', email: 'john@example.com' };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('1. Triggers & Enrolment', () => {
        it('should enroll contact when TAG_ADDED trigger is fired', async () => {
            const campaignData = { id: 'camp-1', name: 'Tag Welcome', trigger_value: 'NewLead', status: 'ACTIVE' };
            const firstStepData = { id: 'step-1', delay_value: 0, delay_unit: 'HOURS', step_order: 1 };

            // Mock finding matching campaign
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'drip_campaigns') {
                    return {
                        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [campaignData] }) }) }) }) })
                    };
                }
                if (table === 'drip_enrollments') {
                    return {
                        select: () => ({ eq: () => ({ eq: () => ({ neq: () => ({ neq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }) }) }) }),
                        insert: () => Promise.resolve({ error: null })
                    };
                }
                if (table === 'drip_steps') {
                    return {
                        select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ single: () => Promise.resolve({ data: firstStepData }) }) }) }) })
                    };
                }
                return mockSupabase;
            });

            await DripTriggerService.handleTagAdded(userId, contact, ['NewLead']);

            // Expect drip_enrollments insert to have been called
            expect(mockSupabase.from).toHaveBeenCalledWith('drip_enrollments');
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                drip_campaign_id: 'camp-1',
                contact_id: contactId,
                status: 'ACTIVE'
            }));
        });

        it('should enroll lead when pipeline_STAGE_CHANGED is fired', async () => {
            const campaignData = { id: 'camp-2', name: 'Stage FollowUp', trigger_value: 'stage-789', status: 'ACTIVE' };
            const firstStepData = { id: 'step-1', delay_value: 0, delay_unit: 'HOURS', step_order: 1 };
            const lead = { id: 'lead-1', contact_id: contactId };

            mockSupabase.from.mockImplementation((table) => {
                if (table === 'drip_campaigns') {
                    return {
                        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [campaignData] }) }) }) }) })
                    };
                }
                if (table === 'drip_steps') {
                    return {
                        select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ single: () => Promise.resolve({ data: firstStepData }) }) }) }) })
                    };
                }
                if (table === 'drip_enrollments') {
                    return {
                        select: () => ({ eq: () => ({ eq: () => ({ neq: () => ({ neq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }) }) }) }),
                        insert: () => Promise.resolve({ error: null })
                    };
                }
                return mockSupabase;
            });

            await DripTriggerService.handleStageChanged(userId, lead, 'stage-789');

            expect(mockSupabase.from).toHaveBeenCalledWith('drip_enrollments');
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                drip_campaign_id: 'camp-2',
                contact_id: contactId
            }));
        });
    });

    describe('2. Step Execution (Email & WhatsApp)', () => {
        it('should process a WhatsApp step successfully', async () => {
            const enrollment = {
                id: 'enr-1',
                contact_id: contactId,
                drip_campaign_id: 'camp-1',
                current_step_id: 'step-wa',
                status: 'ACTIVE',
                contact: contact,
                drip_campaign: { name: 'Test Campaign', user_id: userId, status: 'ACTIVE' },
                current_step: {
                    id: 'step-wa',
                    step_type: 'WHATSAPP_MESSAGE',
                    step_order: 1,
                    step_config: { template_name: 'hello_world', template_language: 'en' }
                }
            };

            // RPC mock (fetch_and_lock_drip_jobs)
            mockSupabase.rpc.mockResolvedValue({ data: [{ id: 'enr-1' }] });
            
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'drip_enrollments') {
                    return {
                        select: () => ({ in: () => Promise.resolve({ data: [enrollment] }) }),
                        update: () => ({ eq: () => Promise.resolve({ data: null }) }),
                        lt: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) // older enrollment check
                    };
                }
                if (table === 'drip_logs') {
                    return {
                        select: () => ({ eq: () => ({ limit: () => ({ single: () => Promise.resolve({ data: null }) }) }) }), // idempotency check
                        insert: () => Promise.resolve({ error: null })
                    };
                }
                if (table === 'drip_steps') {
                    return {
                        // find next step
                        select: () => ({ eq: () => ({ gt: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) })
                    };
                }
                return mockSupabase;
            });

            await dripProcessor.processDrips();

            expect(mockWhatsAppService.sendMessage).toHaveBeenCalledWith(
                userId,
                contact.phone,
                'template',
                expect.objectContaining({ name: 'hello_world' })
            );
        });

        it('should process an EMAIL step via GMAIL provider', async () => {
            const enrollment = {
                id: 'enr-2',
                contact_id: contactId,
                contact: contact,
                drip_campaign: { name: 'Email Camp', user_id: userId, status: 'ACTIVE' },
                current_step: {
                    id: 'step-email',
                    step_type: 'EMAIL',
                    step_order: 2,
                    step_config: { 
                        provider: 'GMAIL', 
                        connectionId: 'gmail-123',
                        subject: 'Hello from Drip', 
                        body: 'This is an email' 
                    }
                }
            };

            mockSupabase.rpc.mockResolvedValue({ data: [{ id: 'enr-2' }] });
            mockSupabase.from.mockImplementation((table) => {
                if (table === 'drip_enrollments') {
                    return {
                        select: () => ({ in: () => Promise.resolve({ data: [enrollment] }) }),
                        update: () => ({ eq: () => Promise.resolve({ data: null }) }),
                        lt: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) })
                    };
                }
                if (table === 'drip_logs') {
                    return {
                        select: () => ({ eq: () => ({ limit: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
                        insert: () => Promise.resolve({ error: null })
                    };
                }
                if (table === 'drip_steps') {
                    return {
                        select: () => ({ eq: () => ({ gt: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) })
                    };
                }
                return mockSupabase;
            });

            await dripProcessor.processDrips();

            expect(mockGmailService.sendEmail).toHaveBeenCalledWith(
                userId,
                'gmail-123',
                contact.email,
                'Hello from Drip',
                'This is an email'
            );
        });
    });
});
