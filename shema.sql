-- Extension UUID (optionnel, pour générer des IDs uniques)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des sous-systèmes (créés par le master)
CREATE TABLE subsystems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    max_users INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    subscription_type VARCHAR(50) DEFAULT 'standard',
    subscription_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des utilisateurs (master, subsystem admin, agents)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('master', 'subsystem', 'agent')),
    subsystem_id UUID REFERENCES subsystems(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des tickets
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number INTEGER NOT NULL,
    subsystem_id UUID REFERENCES subsystems(id) NOT NULL,
    agent_id UUID REFERENCES users(id) NOT NULL,
    agent_name VARCHAR(255),
    draw VARCHAR(50) NOT NULL,
    draw_time VARCHAR(50) NOT NULL, -- 'morning' ou 'evening'
    date TIMESTAMP NOT NULL,
    bets JSONB NOT NULL, -- tableau des paris
    total INTEGER NOT NULL,
    is_synced BOOLEAN DEFAULT true,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des résultats
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subsystem_id UUID REFERENCES subsystems(id) NOT NULL,
    draw VARCHAR(50) NOT NULL,
    draw_time VARCHAR(50) NOT NULL, -- 'morning' ou 'evening'
    result_date DATE NOT NULL,
    lot1 VARCHAR(5) NOT NULL,
    lot2 VARCHAR(5),
    lot3 VARCHAR(5),
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subsystem_id, draw, draw_time, result_date)
);

-- Table des restrictions de boules
CREATE TABLE restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subsystem_id UUID REFERENCES subsystems(id) NOT NULL,
    number VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('block', 'limit')),
    limit_amount INTEGER,
    draw VARCHAR(50) DEFAULT 'all',
    draw_time VARCHAR(50) DEFAULT 'all',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des tickets gagnants
CREATE TABLE winning_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    subsystem_id UUID REFERENCES subsystems(id) NOT NULL,
    total_winnings INTEGER NOT NULL,
    paid BOOLEAN DEFAULT false,
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des historiques d'activité
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subsystem_id UUID REFERENCES subsystems(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX idx_tickets_subsystem ON tickets(subsystem_id);
CREATE INDEX idx_tickets_agent ON tickets(agent_id);
CREATE INDEX idx_tickets_date ON tickets(date);
CREATE INDEX idx_results_subsystem_date ON results(subsystem_id, result_date);
CREATE INDEX idx_users_subsystem ON users(subsystem_id);
CREATE INDEX idx_winning_tickets_ticket ON winning_tickets(ticket_id);