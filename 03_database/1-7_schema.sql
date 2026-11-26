-- =====================================================================
-- 1-7 Simple E-commerce Catalogue - database schema (PostgreSQL 15)
-- This script runs automatically the FIRST time the database container
-- starts (it is mounted into /docker-entrypoint-initdb.d/).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper function: automatically refresh "updated_at" on every UPDATE.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- users: people who can log in to the admin panel.
-- Guests (shop visitors) do NOT need an account.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    role          VARCHAR(20)  NOT NULL DEFAULT 'standard'
                  CHECK (role IN ('admin', 'standard')),
    -- Password hash (PBKDF2). NULL until the backend sets the demo password
    -- from environment variables. A plain password is NEVER stored.
    password_hash VARCHAR(255),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- categories: groups of products (e.g. "Electronics").
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80)  NOT NULL UNIQUE,
    description VARCHAR(500) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- products: items shown in the catalogue.
-- status: draft (hidden), active (visible to guests), archived (soft-deleted)
-- ---------------------------------------------------------------------
CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    category_id INTEGER       NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name        VARCHAR(120)  NOT NULL,
    sku         VARCHAR(40)   NOT NULL UNIQUE,
    description TEXT          NOT NULL DEFAULT '',
    price       NUMERIC(10,2) NOT NULL CHECK (price > 0),
    stock       INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
    status      VARCHAR(20)   NOT NULL DEFAULT 'active'
                CHECK (status IN ('draft', 'active', 'archived')),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes that make catalogue filtering and searching fast
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status   ON products(status);
CREATE INDEX idx_products_name     ON products(LOWER(name));

-- ---------------------------------------------------------------------
-- orders: order requests sent by guests from the checkout form.
-- No real payment is involved - this is a simulation.
-- ---------------------------------------------------------------------
CREATE TABLE orders (
    id               SERIAL PRIMARY KEY,
    customer_name    VARCHAR(100)  NOT NULL,
    customer_email   VARCHAR(150)  NOT NULL,
    customer_phone   VARCHAR(30)   NOT NULL DEFAULT '',
    shipping_address VARCHAR(300)  NOT NULL,
    comment          VARCHAR(500)  NOT NULL DEFAULT '',
    total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    status           VARCHAR(20)   NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'confirmed', 'shipped', 'completed', 'cancelled')),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_email      ON orders(LOWER(customer_email));

-- ---------------------------------------------------------------------
-- order_items: the lines of an order (which product, how many, price).
-- product_name and unit_price are copied ("snapshot") so the order stays
-- correct even if the product is renamed or its price changes later.
-- ---------------------------------------------------------------------
CREATE TABLE order_items (
    id           SERIAL PRIMARY KEY,
    order_id     INTEGER       NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   INTEGER       NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name VARCHAR(120)  NOT NULL,
    unit_price   NUMERIC(10,2) NOT NULL CHECK (unit_price > 0),
    quantity     INTEGER       NOT NULL CHECK (quantity > 0),
    line_total   NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ---------------------------------------------------------------------
-- settings: simple key/value system settings managed by the administrator.
-- ---------------------------------------------------------------------
CREATE TABLE settings (
    key        VARCHAR(50)  PRIMARY KEY,
    value      VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- audit_logs: history of important actions (who did what and when).
-- user_id is NULL when the action was done by a guest (e.g. new order).
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(50)  NOT NULL,
    entity_name VARCHAR(50)  NOT NULL,
    entity_id   INTEGER,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity     ON audit_logs(entity_name, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ---------------------------------------------------------------------
-- Attach the "updated_at" trigger to every table that has the column.
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_users_updated_at       BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_categories_updated_at  BEFORE UPDATE ON categories  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated_at    BEFORE UPDATE ON products    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated_at      BEFORE UPDATE ON orders      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_settings_updated_at    BEFORE UPDATE ON settings    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
