-- Development data for Echo application
-- This file provides sample data for local development and testing

-- Insert sample users
INSERT INTO echo.users (id, username, email, password_hash, first_name, last_name, preferred_language, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'alice_dev', 'alice@echo.dev', '$2b$10$rOzJqQZ8kVxHxvQqQqQqQeQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'Alice', 'Johnson', 'en', '2024-01-01 10:00:00', '2024-01-31 10:00:00'),
('550e8400-e29b-41d4-a716-446655440002', 'bob_dev', 'bob@echo.dev', '$2b$10$rOzJqQZ8kVxHxvQqQqQqQeQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'Bob', 'Smith', 'es', '2024-01-05 11:00:00', '2024-01-31 11:00:00'),
('550e8400-e29b-41d4-a716-446655440003', 'carol_dev', 'carol@echo.dev', '$2b$10$rOzJqQZ8kVxHxvQqQqQqQeQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'Carol', 'Davis', 'fr', '2024-01-10 12:00:00', '2024-01-31 12:00:00'),
('550e8400-e29b-41d4-a716-446655440004', 'david_dev', 'david@echo.dev', '$2b$10$rOzJqQZ8kVxHxvQqQqQqQeQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'David', 'Wilson', 'de', '2024-01-15 13:00:00', '2024-01-31 13:00:00'),
('550e8400-e29b-41d4-a716-446655440005', 'eva_dev', 'eva@echo.dev', '$2b$10$rOzJqQZ8kVxHxvQqQqQqQeQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'Eva', 'Brown', 'zh', '2024-01-20 14:00:00', '2024-01-31 14:00:00');

-- Insert sample sessions
INSERT INTO echo.sessions (id, user_id, session_token, expires_at, created_at) VALUES
('session-001', '550e8400-e29b-41d4-a716-446655440001', 'token_alice_dev_001', '2024-02-07 10:00:00', '2024-01-31 09:00:00'),
('session-002', '550e8400-e29b-41d4-a716-446655440002', 'token_bob_dev_002', '2024-02-07 11:00:00', '2024-01-31 08:00:00'),
('session-003', '550e8400-e29b-41d4-a716-446655440003', 'token_carol_dev_003', '2024-02-07 12:00:00', '2024-01-31 09:30:00');

-- Insert sample RTC rooms
INSERT INTO echo.rtc_rooms (id, name, description, max_participants, is_active, created_by, created_at, updated_at) VALUES
('room-001', 'Development Room 1', 'Main development testing room', 10, true, '550e8400-e29b-41d4-a716-446655440001', '2024-01-31 08:00:00', '2024-01-31 10:00:00'),
('room-002', 'Language Exchange', 'Room for language exchange practice', 6, true, '550e8400-e29b-41d4-a716-446655440002', '2024-01-31 09:00:00', '2024-01-31 10:00:00'),
('room-003', 'Business Meeting', 'Professional meeting room', 8, false, '550e8400-e29b-41d4-a716-446655440003', '2024-01-31 07:00:00', '2024-01-31 09:30:00');

-- Insert sample RTC participants
INSERT INTO echo.rtc_participants (id, room_id, user_id, peer_id, is_active, joined_at, left_at) VALUES
('part-001', 'room-001', '550e8400-e29b-41d4-a716-446655440001', 'peer_alice_001', true, '2024-01-31 09:00:00', NULL),
('part-002', 'room-001', '550e8400-e29b-41d4-a716-446655440002', 'peer_bob_001', true, '2024-01-31 09:15:00', NULL),
('part-003', 'room-002', '550e8400-e29b-41d4-a716-446655440003', 'peer_carol_001', true, '2024-01-31 09:30:00', NULL),
('part-004', 'room-003', '550e8400-e29b-41d4-a716-446655440004', 'peer_david_001', false, '2024-01-31 08:00:00', '2024-01-31 09:30:00');

-- Insert sample translation sessions
INSERT INTO echo.translation_sessions (id, room_id, source_language, target_language, status, created_by, created_at, updated_at) VALUES
('trans-001', 'room-001', 'en', 'es', 'active', '550e8400-e29b-41d4-a716-446655440001', '2024-01-31 09:00:00', '2024-01-31 10:00:00'),
('trans-002', 'room-001', 'es', 'en', 'active', '550e8400-e29b-41d4-a716-446655440002', '2024-01-31 09:00:00', '2024-01-31 10:00:00'),
('trans-003', 'room-002', 'en', 'fr', 'active', '550e8400-e29b-41d4-a716-446655440003', '2024-01-31 09:30:00', '2024-01-31 10:00:00'),
('trans-004', 'room-003', 'de', 'en', 'completed', '550e8400-e29b-41d4-a716-446655440004', '2024-01-31 08:00:00', '2024-01-31 09:30:00');

-- Insert sample audio recordings
INSERT INTO echo.audio_recordings (id, session_id, user_id, file_path, file_size, duration_ms, format, sample_rate, channels, created_at) VALUES
('audio-001', 'trans-001', '550e8400-e29b-41d4-a716-446655440001', '/audio/dev/alice_001.wav', 1024000, 15000, 'wav', 44100, 1, '2024-01-31 09:15:00'),
('audio-002', 'trans-001', '550e8400-e29b-41d4-a716-446655440002', '/audio/dev/bob_001.wav', 896000, 12000, 'wav', 44100, 1, '2024-01-31 09:20:00'),
('audio-003', 'trans-002', '550e8400-e29b-41d4-a716-446655440003', '/audio/dev/carol_001.wav', 1152000, 18000, 'wav', 44100, 1, '2024-01-31 09:35:00'),
('audio-004', 'trans-004', '550e8400-e29b-41d4-a716-446655440004', '/audio/dev/david_001.wav', 768000, 10000, 'wav', 44100, 1, '2024-01-31 09:00:00');

-- Insert sample translations
INSERT INTO echo.translations (id, session_id, audio_recording_id, original_text, translated_text, confidence_score, processing_time_ms, created_at) VALUES
('transl-001', 'trans-001', 'audio-001', 'Hello, how are you today?', 'Hola, ¿cómo estás hoy?', 0.95, 1200, '2024-01-31 09:16:00'),
('transl-002', 'trans-002', 'audio-002', 'Muy bien, gracias por preguntar', 'Very well, thank you for asking', 0.92, 1100, '2024-01-31 09:21:00'),
('transl-003', 'trans-003', 'audio-003', 'Good morning everyone', 'Bonjour tout le monde', 0.98, 900, '2024-01-31 09:36:00'),
('transl-004', 'trans-004', 'audio-004', 'Guten Tag, wie geht es Ihnen?', 'Good day, how are you?', 0.89, 1500, '2024-01-31 09:01:00');

-- Insert sample usage statistics
INSERT INTO analytics.usage_stats (id, user_id, session_id, action_type, timestamp, metadata) VALUES
('stat-001', '550e8400-e29b-41d4-a716-446655440001', 'trans-001', 'translation_request', '2024-01-31 09:15:00', '{"source_lang": "en", "target_lang": "es", "audio_duration": 15000}'),
('stat-002', '550e8400-e29b-41d4-a716-446655440002', 'trans-002', 'translation_request', '2024-01-31 09:20:00', '{"source_lang": "es", "target_lang": "en", "audio_duration": 12000}'),
('stat-003', '550e8400-e29b-41d4-a716-446655440003', 'trans-003', 'room_join', '2024-01-31 09:30:00', '{"room_id": "room-002", "participant_count": 2}'),
('stat-004', '550e8400-e29b-41d4-a716-446655440004', 'trans-004', 'room_leave', '2024-01-31 09:30:00', '{"room_id": "room-003", "session_duration": 5400000}');

-- Insert sample performance metrics
INSERT INTO analytics.performance_metrics (id, metric_name, metric_value, timestamp, tags) VALUES
('perf-001', 'translation_latency', 1200.5, '2024-01-31 09:15:00', '{"language_pair": "en-es", "model_version": "v2.1"}'),
('perf-002', 'audio_processing_time', 890.2, '2024-01-31 09:20:00', '{"format": "wav", "duration": 12000}'),
('perf-003', 'rtc_connection_time', 2340.8, '2024-01-31 09:25:00', '{"room_id": "room-002", "participant_count": 3}'),
('perf-004', 'memory_usage', 512.7, '2024-01-31 09:30:00', '{"service": "translation", "instance": "worker-1"}'),
('perf-005', 'cpu_usage', 45.3, '2024-01-31 09:35:00', '{"service": "audio-processing", "instance": "worker-2"}');

-- Insert sample audit log entries
INSERT INTO audit.audit_log (id, user_id, action, resource_type, resource_id, timestamp, ip_address, user_agent, details) VALUES
('audit-001', '550e8400-e29b-41d4-a716-446655440001', 'CREATE', 'translation_session', 'trans-001', '2024-01-31 09:00:00', '192.168.1.100', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', '{"room_id": "room-001", "languages": ["en", "es"]}'),
('audit-002', '550e8400-e29b-41d4-a716-446655440002', 'JOIN', 'rtc_room', 'room-001', '2024-01-31 09:15:00', '192.168.1.101', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '{"peer_id": "peer_bob_001"}'),
('audit-003', '550e8400-e29b-41d4-a716-446655440003', 'UPDATE', 'user_profile', '550e8400-e29b-41d4-a716-446655440003', '2024-01-31 09:25:00', '192.168.1.102', 'Mozilla/5.0 (X11; Linux x86_64)', '{"field": "preferred_language", "old_value": "en", "new_value": "fr"}'),
('audit-004', '550e8400-e29b-41d4-a716-446655440004', 'DELETE', 'audio_recording', 'audio-old-001', '2024-01-31 09:40:00', '192.168.1.103', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)', '{"reason": "user_request", "retention_policy": "30_days"}');

-- Insert admin user
INSERT INTO echo.users (id, username, email, password_hash, first_name, last_name, preferred_language, is_admin, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin_dev', 'admin@echo.dev', '$2b$10$rOzJqQZ8kVxHxvQqQqQqQeQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'Admin', 'User', 'en', true, '2023-12-01 10:00:00', '2024-01-31 10:00:00')
ON CONFLICT (id) DO NOTHING;