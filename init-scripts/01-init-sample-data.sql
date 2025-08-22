-- Create sample tables and data for testing PostgreSQL MCP Server

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    total_amount DECIMAL(10, 2),
    shipping_address TEXT,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'))
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Insert sample data

-- Users
INSERT INTO users (username, email, full_name, active) VALUES
    ('john_doe', 'john.doe@example.com', 'John Doe', true),
    ('jane_smith', 'jane.smith@example.com', 'Jane Smith', true),
    ('bob_wilson', 'bob.wilson@example.com', 'Bob Wilson', true),
    ('alice_johnson', 'alice.johnson@example.com', 'Alice Johnson', true),
    ('charlie_brown', 'charlie.brown@example.com', 'Charlie Brown', false),
    ('emma_davis', 'emma.davis@example.com', 'Emma Davis', true),
    ('frank_miller', 'frank.miller@example.com', 'Frank Miller', true),
    ('grace_lee', 'grace.lee@example.com', 'Grace Lee', true),
    ('henry_taylor', 'henry.taylor@example.com', 'Henry Taylor', false),
    ('ivy_chen', 'ivy.chen@example.com', 'Ivy Chen', true);

-- Products
INSERT INTO products (name, description, price, stock_quantity, category) VALUES
    ('Laptop Pro 15', 'High-performance laptop with 15-inch display', 1299.99, 50, 'Electronics'),
    ('Wireless Mouse', 'Ergonomic wireless mouse with USB receiver', 29.99, 200, 'Electronics'),
    ('Office Chair', 'Comfortable ergonomic office chair', 249.99, 75, 'Furniture'),
    ('Standing Desk', 'Adjustable height standing desk', 599.99, 30, 'Furniture'),
    ('Coffee Maker', 'Programmable coffee maker with thermal carafe', 79.99, 100, 'Appliances'),
    ('Bluetooth Headphones', 'Noise-cancelling wireless headphones', 199.99, 80, 'Electronics'),
    ('Desk Lamp', 'LED desk lamp with adjustable brightness', 39.99, 150, 'Furniture'),
    ('External SSD 1TB', 'Portable solid-state drive', 129.99, 120, 'Electronics'),
    ('Water Bottle', 'Insulated stainless steel water bottle', 24.99, 300, 'Accessories'),
    ('Notebook Set', 'Pack of 5 premium notebooks', 19.99, 250, 'Stationery'),
    ('Monitor 27"', '4K UHD monitor with USB-C', 399.99, 40, 'Electronics'),
    ('Keyboard Mechanical', 'RGB mechanical gaming keyboard', 89.99, 90, 'Electronics'),
    ('Webcam HD', '1080p HD webcam with microphone', 59.99, 110, 'Electronics'),
    ('Desk Organizer', 'Multi-compartment desk organizer', 34.99, 180, 'Furniture'),
    ('Phone Stand', 'Adjustable phone and tablet stand', 14.99, 220, 'Accessories');

-- Orders
INSERT INTO orders (user_id, status, total_amount, shipping_address) VALUES
    (1, 'delivered', 1329.98, '123 Main St, Anytown, USA'),
    (2, 'shipped', 289.97, '456 Oak Ave, Somewhere, USA'),
    (3, 'processing', 799.98, '789 Pine Rd, Elsewhere, USA'),
    (1, 'delivered', 59.99, '123 Main St, Anytown, USA'),
    (4, 'pending', 219.98, '321 Elm St, Nowhere, USA'),
    (5, 'cancelled', 1499.99, '654 Maple Dr, Anywhere, USA'),
    (6, 'delivered', 164.97, '987 Cedar Ln, Everywhere, USA'),
    (7, 'processing', 689.98, '147 Birch Way, Someplace, USA'),
    (8, 'shipped', 429.98, '258 Spruce Ct, Anyplace, USA'),
    (2, 'delivered', 94.98, '456 Oak Ave, Somewhere, USA'),
    (3, 'pending', 1329.98, '789 Pine Rd, Elsewhere, USA'),
    (9, 'delivered', 259.98, '369 Willow St, Thisplace, USA'),
    (10, 'processing', 449.97, '741 Ash Blvd, Thatplace, USA');

-- Order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    -- Order 1
    (1, 1, 1, 1299.99),
    (1, 2, 1, 29.99),
    -- Order 2
    (2, 3, 1, 249.99),
    (2, 7, 1, 39.99),
    -- Order 3
    (3, 4, 1, 599.99),
    (3, 6, 1, 199.99),
    -- Order 4
    (4, 13, 1, 59.99),
    -- Order 5
    (5, 6, 1, 199.99),
    (5, 10, 1, 19.99),
    -- Order 6
    (6, 1, 1, 1299.99),
    (6, 8, 1, 129.99),
    (6, 12, 1, 89.99),
    -- Order 7
    (7, 5, 2, 79.99),
    (7, 9, 2, 24.99),
    -- Order 8
    (8, 11, 1, 399.99),
    (8, 2, 1, 29.99),
    -- Order 9
    (9, 8, 1, 129.99),
    (9, 11, 1, 399.99),
    -- Order 10
    (10, 12, 1, 89.99),
    (10, 15, 3, 14.99),
    -- Order 11
    (11, 1, 1, 1299.99),
    (11, 2, 1, 29.99),
    -- Order 12
    (12, 3, 1, 249.99),
    (12, 14, 1, 34.99),
    -- Order 13
    (13, 6, 2, 199.99),
    (13, 9, 2, 24.99);

-- Create a view for order summaries
CREATE VIEW order_summaries AS
SELECT 
    o.id AS order_id,
    u.username,
    u.email,
    o.order_date,
    o.status,
    COUNT(oi.id) AS item_count,
    SUM(oi.quantity) AS total_items,
    o.total_amount
FROM orders o
JOIN users u ON o.user_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, u.username, u.email, o.order_date, o.status, o.total_amount;

-- Create a materialized view for product sales statistics
CREATE MATERIALIZED VIEW product_sales_stats AS
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.category,
    COUNT(DISTINCT oi.order_id) AS times_ordered,
    SUM(oi.quantity) AS total_quantity_sold,
    SUM(oi.subtotal) AS total_revenue,
    AVG(oi.unit_price) AS average_selling_price
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.name, p.category;

-- Add some comments to tables for documentation
COMMENT ON TABLE users IS 'Store user account information';
COMMENT ON TABLE products IS 'Product catalog with pricing and inventory';
COMMENT ON TABLE orders IS 'Customer orders with status tracking';
COMMENT ON TABLE order_items IS 'Individual line items for each order';
COMMENT ON COLUMN users.active IS 'Whether the user account is active';
COMMENT ON COLUMN products.stock_quantity IS 'Current inventory level';
COMMENT ON COLUMN orders.status IS 'Order status: pending, processing, shipped, delivered, or cancelled';

-- Grant permissions (useful for testing permission-based features)
-- Note: These will only work if the postgres user has sufficient privileges
-- CREATE ROLE readonly_user WITH LOGIN PASSWORD 'readonly123';
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO readonly_user;
