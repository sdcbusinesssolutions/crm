-- Update the Check Constraint for step_type to include 'AI_INTENT'

DO $$
DECLARE
    -- No variables needed for this simple operation
BEGIN
    -- 1. Drop the existing constraint
    ALTER TABLE public.drip_steps 
    DROP CONSTRAINT IF EXISTS drip_steps_step_type_check;

    -- 2. Add the new constraint with AI_INTENT included
    ALTER TABLE public.drip_steps 
    ADD CONSTRAINT drip_steps_step_type_check 
    CHECK (step_type IN ('WHATSAPP_MESSAGE', 'EMAIL', 'WAIT', 'CONDITION', 'AI_INTENT'));

    RAISE NOTICE 'Updated drip_steps_step_type_check constraint.';
END $$;
