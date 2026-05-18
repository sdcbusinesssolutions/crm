-- Setup AI Agents and Knowledge Base Schema

-- 1. Create ai_agents table
CREATE TABLE IF NOT EXISTS public.ai_agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    model_config JSONB DEFAULT '{"provider": "openai", "model": "gpt-4o"}'::jsonb,
    type TEXT DEFAULT 'chat',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index on user_id for fast queries
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_id ON public.ai_agents(user_id);

-- 3. Create ai_knowledge_base table
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indices on ai_knowledge_base
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_agent_id ON public.ai_knowledge_base(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_user_id ON public.ai_knowledge_base(user_id);
