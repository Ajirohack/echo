-- Echo Database Initialization Script
-- This script sets up the initial database schema for the Echo application

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS echo;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
SET search_path TO echo, public;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    preferred_language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translation sessions
CREATE TABLE IF NOT EXISTS translation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    session_type VARCHAR(50) DEFAULT 'real_time', -- real_time, batch, conversation
    status VARCHAR(20) DEFAULT 'active', -- active, paused, completed, archived
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audio recordings
CREATE TABLE IF NOT EXISTS audio_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES translation_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    duration_ms INTEGER,
    format VARCHAR(10), -- wav, mp3, m4a, etc.
    sample_rate INTEGER,
    channels INTEGER,
    bitrate INTEGER,
    checksum VARCHAR(64),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translations
CREATE TABLE IF NOT EXISTS translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES translation_sessions(id) ON DELETE CASCADE,
    audio_id UUID REFERENCES audio_recordings(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    processing_time_ms INTEGER,
    provider VARCHAR(50), -- openai, google, deepl, etc.
    model_version VARCHAR(50),
    is_corrected BOOLEAN DEFAULT false,
    corrected_text TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time communication rooms
CREATE TABLE IF NOT EXISTS rtc_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    host_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    max_participants INTEGER DEFAULT 10,
    is_public BOOLEAN DEFAULT false,
    requires_password BOOLEAN DEFAULT false,
    password_hash VARCHAR(255),
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active', -- active, paused, ended
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room participants
CREATE TABLE IF NOT EXISTS rtc_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rtc_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'participant', -- host, moderator, participant
    is_muted BOOLEAN DEFAULT false,
    is_video_enabled BOOLEAN DEFAULT true,
    preferred_language VARCHAR(10),
    connection_quality VARCHAR(20), -- excellent, good, fair, poor
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(room_id, user_id)
);

-- Analytics schema tables
SET search_path TO analytics, public;

-- Usage statistics
CREATE TABLE IF NOT EXISTS usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    event_type VARCHAR(50) NOT NULL, -- login, translation, recording, etc.
    event_data JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4),
    metric_unit VARCHAR(20),
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit schema tables
SET search_path TO audit, public;

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    session_id VARCHAR(255),
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reset search path
SET search_path TO echo, public;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_translation_sessions_user_id ON translation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_translation_sessions_status ON translation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_translation_sessions_created ON translation_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_audio_recordings_session_id ON audio_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_user_id ON audio_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_created ON audio_recordings(created_at);

CREATE INDEX IF NOT EXISTS idx_translations_session_id ON translations(session_id);
CREATE INDEX IF NOT EXISTS idx_translations_user_id ON translations(user_id);
CREATE INDEX IF NOT EXISTS idx_translations_languages ON translations(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translations_created ON translations(created_at);
CREATE INDEX IF NOT EXISTS idx_translations_text_search ON translations USING gin(source_text gin_trgm_ops, translated_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_rtc_rooms_code ON rtc_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rtc_rooms_host ON rtc_rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_rtc_rooms_status ON rtc_rooms(status);

CREATE INDEX IF NOT EXISTS idx_rtc_participants_room_id ON rtc_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_rtc_participants_user_id ON rtc_participants(user_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_id ON analytics.usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_stats_event_type ON analytics.usage_stats(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_stats_timestamp ON analytics.usage_stats(timestamp);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON analytics.performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON analytics.performance_metrics(timestamp);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit.audit_log(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_translation_sessions_updated_at BEFORE UPDATE ON translation_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_translations_updated_at BEFORE UPDATE ON translations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rtc_rooms_updated_at BEFORE UPDATE ON rtc_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default data
INSERT INTO users (username, email, password_hash, display_name, is_verified) 
VALUES ('admin', 'admin@echo.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO9G', 'Administrator', true)
ON CONFLICT (email) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA echo TO echo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA echo TO echo;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO echo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO echo;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO echo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit TO echo;

-- Create a view for active translation sessions with user info
CREATE OR REPLACE VIEW active_sessions_view AS
SELECT 
    ts.id,
    ts.session_name,
    ts.source_language,
    ts.target_language,
    ts.session_type,
    ts.status,
    ts.started_at,
    u.username,
    u.display_name,
    COUNT(t.id) as translation_count,
    MAX(t.created_at) as last_translation_at
FROM translation_sessions ts
JOIN users u ON ts.user_id = u.id
LEFT JOIN translations t ON ts.id = t.session_id
WHERE ts.status = 'active'
GROUP BY ts.id, ts.session_name, ts.source_language, ts.target_language, 
         ts.session_type, ts.status, ts.started_at, u.username, u.display_name;

COMMIT;