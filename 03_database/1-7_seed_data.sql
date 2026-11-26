-- =====================================================================
-- 1-7 Simple E-commerce Catalogue - seed (demo) data
-- Runs automatically after 1-7_schema.sql on the first database start.
-- All people, e-mails and addresses below are FICTIONAL test data.
-- Passwords are NOT stored here: the backend sets the demo passwords
-- from the .env file (DEMO_ADMIN_PASSWORD / DEMO_STAFF_PASSWORD).
-- =====================================================================

-- ---------- Users ----------
INSERT INTO users (full_name, email, role) VALUES
    ('Demo Administrator', 'admin@example.local', 'admin'),
    ('Demo Staff Member',  'staff@example.local', 'standard');

-- ---------- System settings ----------
INSERT INTO settings (key, value) VALUES
    ('store_name',          'Simple Catalogue Shop'),
    ('contact_email',       'shop@example.local'),
    ('currency',            'EUR'),
    ('low_stock_threshold', '5');

-- ---------- Categories ----------
INSERT INTO categories (name, description) VALUES
    ('Electronics',   'Gadgets, accessories and small devices.'),
    ('Books',         'Paper books for learning and leisure.'),
    ('Home & Kitchen','Useful things for everyday home life.'),
    ('Sports',        'Equipment for an active lifestyle.'),
    ('Stationery',    'Notebooks, pens and office supplies.');

-- ---------- Products ----------
-- category ids: 1 Electronics, 2 Books, 3 Home & Kitchen, 4 Sports, 5 Stationery
INSERT INTO products (category_id, name, sku, description, price, stock, status) VALUES
    (1, 'Wireless Mouse',          'EL-001', 'Compact wireless mouse with a USB receiver and silent buttons.',            19.99, 40, 'active'),
    (1, 'Mechanical Keyboard',     'EL-002', 'Full-size keyboard with tactile switches and white backlight.',             64.50, 12, 'active'),
    (1, 'USB-C Charger 30W',       'EL-003', 'Fast charger suitable for phones and small laptops.',                       24.00,  3, 'active'),
    (1, 'Bluetooth Speaker',       'EL-004', 'Portable speaker with 10 hours of battery life.',                           39.90,  0, 'active'),
    (2, 'Learn SQL in 30 Days',    'BK-001', 'Beginner friendly guide to relational databases and SQL queries.',          29.00, 25, 'active'),
    (2, 'Web Development Basics',  'BK-002', 'HTML, CSS and JavaScript explained with small practical projects.',          32.50, 18, 'active'),
    (2, 'Clean Code Notes',        'BK-003', 'Short notes about writing readable and maintainable code.',                 21.00,  7, 'active'),
    (3, 'Ceramic Coffee Mug',      'HK-001', '350 ml mug, dishwasher and microwave safe.',                                 8.50, 60, 'active'),
    (3, 'Stainless Water Bottle',  'HK-002', 'Keeps drinks cold for 24 hours and hot for 12 hours.',                      17.90, 30, 'active'),
    (3, 'Bamboo Cutting Board',    'HK-003', 'Eco-friendly cutting board, 35 x 25 cm.',                                   14.20,  4, 'active'),
    (4, 'Yoga Mat',                'SP-001', 'Non-slip mat, 6 mm thick, with a carrying strap.',                          22.00, 15, 'active'),
    (4, 'Jump Rope',               'SP-002', 'Adjustable speed rope for cardio training.',                                 9.99, 50, 'active'),
    (5, 'A5 Dotted Notebook',      'ST-001', '120 pages of dotted paper, hard cover.',                                     6.90, 80, 'active'),
    (5, 'Gel Pen Set (10 pcs)',    'ST-002', 'Ten colourful gel pens with a smooth line.',                                 7.50, 45, 'active'),
    (5, 'Desk Organizer',          'ST-003', 'Prototype product - not yet published in the catalogue.',                   15.00, 10, 'draft');

-- ---------- Demo orders (fictional customers) ----------
INSERT INTO orders (customer_name, customer_email, customer_phone, shipping_address, comment, total_amount, status) VALUES
    ('Test Customer One',   'customer1@example.com', '+000 0000 0001', '1 Demo Street, Test City',  'Please call before delivery.', 48.49, 'new'),
    ('Test Customer Two',   'customer2@example.com', '',               '2 Sample Avenue, Demo Town', '',                             64.50, 'confirmed'),
    ('Test Customer Three', 'customer3@example.com', '+000 0000 0003', '3 Example Road, Mock City',  'Gift wrapping, please.',       25.50, 'completed');

INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total) VALUES
    (1, 1,  'Wireless Mouse',       19.99, 1, 19.99),
    (1, 5,  'Learn SQL in 30 Days', 29.00, 1, 29.00),
    (2, 2,  'Mechanical Keyboard',  64.50, 1, 64.50),
    (3, 8,  'Ceramic Coffee Mug',    8.50, 3, 25.50);

-- ---------- Initial audit records ----------
INSERT INTO audit_logs (user_id, action, entity_name, entity_id) VALUES
    (NULL, 'create', 'orders', 1),
    (NULL, 'create', 'orders', 2),
    (NULL, 'create', 'orders', 3),
    (1,    'status_change', 'orders', 2),
    (1,    'status_change', 'orders', 3);
