-- Digital Returns Bridge — Seed Data
--
-- NOTE: initdb runs migrations alphabetically (V001 -> V002 -> V003), so this
-- file executes BEFORE V003 adds the checklist columns. It therefore seeds the
-- V001 column set only (e.g. pickup_updates.package_condition with the old
-- values). V003 then remaps those values to the new enum taxonomy and back-fills
-- products.image_url + the new return_requests / pickup_updates fields, leaving
-- the database in the same state as the from-scratch schema.sql + seed.sql path.

-- Users
INSERT INTO users (phone_number, full_name, role, active) VALUES
    ('0501111111', 'Alice Cohen',    'SERVICE_REP', TRUE),
    ('0502222222', 'Bob Levi',       'DRIVER',      TRUE),
    ('0503333333', 'Carol Mizrahi',  'WAREHOUSE',   TRUE),
    ('0504444444', 'David Katz',     'MANAGER',     TRUE);

-- Drivers (links Bob Levi as a driver)
INSERT INTO drivers (user_id, vehicle_number, phone, active)
    VALUES ((SELECT id FROM users WHERE phone_number = '0502222222'), 'ABC-123', '0502222222', TRUE);

-- Customers
INSERT INTO customers (full_name, phone, email, address) VALUES
    ('Yael Shapiro',  '0521000001', 'yael@example.com',  '5 Herzl St, Tel Aviv'),
    ('Moshe Peretz',  '0521000002', 'moshe@example.com', '12 Ben Yehuda St, Haifa'),
    ('Noa Goldberg',  '0521000003', 'noa@example.com',   '3 Dizengoff St, Tel Aviv');

-- Products
INSERT INTO products (sku, name, category, description, price) VALUES
    ('SKU-001', 'Laptop Pro 15',     'Electronics', '15-inch professional laptop',   4999.00),
    ('SKU-002', 'Wireless Keyboard', 'Accessories', 'Bluetooth mechanical keyboard',  299.00),
    ('SKU-003', 'USB-C Hub 7-port',  'Accessories', '7-port USB-C hub with PD',       149.00),
    ('SKU-004', 'Monitor 27" 4K',    'Electronics', '27-inch 4K IPS monitor',        2499.00),
    ('SKU-005', 'Office Chair',      'Furniture',   'Ergonomic mesh office chair',   1299.00);

-- Return requests (various statuses; barcodes assigned only where relevant)
INSERT INTO return_requests
    (customer_id, product_id, driver_id, opened_by_user_id,
     barcode, barcode_assigned_at, barcode_assigned_by_driver_id,
     order_number, reason, defect_description, priority, status)
VALUES
    (
        (SELECT id FROM customers WHERE phone = '0521000001'),
        (SELECT id FROM products  WHERE sku  = 'SKU-001'),
        (SELECT id FROM drivers   WHERE phone = '0502222222'),
        (SELECT id FROM users     WHERE phone_number = '0501111111'),
        NULL, NULL, NULL,
        'ORD-2024-001', 'Defective product', 'Screen has dead pixels', 'HIGH', 'WAITING_FOR_PICKUP'
    ),
    (
        (SELECT id FROM customers WHERE phone = '0521000002'),
        (SELECT id FROM products  WHERE sku  = 'SKU-002'),
        (SELECT id FROM drivers   WHERE phone = '0502222222'),
        (SELECT id FROM users     WHERE phone_number = '0501111111'),
        'BC-10001', NOW() - INTERVAL '2 hours',
        (SELECT id FROM drivers WHERE phone = '0502222222'),
        'ORD-2024-002', 'Wrong item', 'Received wrong keyboard layout', 'MEDIUM', 'BARCODE_ASSIGNED'
    ),
    (
        (SELECT id FROM customers WHERE phone = '0521000003'),
        (SELECT id FROM products  WHERE sku  = 'SKU-003'),
        (SELECT id FROM drivers   WHERE phone = '0502222222'),
        (SELECT id FROM users     WHERE phone_number = '0501111111'),
        'BC-10002', NOW() - INTERVAL '1 day',
        (SELECT id FROM drivers WHERE phone = '0502222222'),
        'ORD-2024-003', 'Damaged packaging', 'Hub ports not working', 'HIGH', 'ARRIVED_TO_WAREHOUSE'
    ),
    (
        (SELECT id FROM customers WHERE phone = '0521000001'),
        (SELECT id FROM products  WHERE sku  = 'SKU-004'),
        NULL,
        (SELECT id FROM users WHERE phone_number = '0501111111'),
        NULL, NULL, NULL,
        'ORD-2024-004', 'Changed mind', NULL, 'LOW', 'OPEN'
    );

-- Status history for the ARRIVED_TO_WAREHOUSE return
INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
    SELECT rr.id,
           (SELECT id FROM users WHERE phone_number = '0501111111'),
           'OPEN', 'WAITING_FOR_PICKUP', 'Driver assigned'
    FROM return_requests rr WHERE rr.order_number = 'ORD-2024-003';

INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
    SELECT rr.id,
           (SELECT id FROM users WHERE phone_number = '0502222222'),
           'WAITING_FOR_PICKUP', 'BARCODE_ASSIGNED', 'Barcode BC-10002 scanned'
    FROM return_requests rr WHERE rr.order_number = 'ORD-2024-003';

INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
    SELECT rr.id,
           (SELECT id FROM users WHERE phone_number = '0502222222'),
           'BARCODE_ASSIGNED', 'PICKED_UP', 'Item collected'
    FROM return_requests rr WHERE rr.order_number = 'ORD-2024-003';

INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
    SELECT rr.id,
           (SELECT id FROM users WHERE phone_number = '0503333333'),
           'PICKED_UP', 'ARRIVED_TO_WAREHOUSE', 'Received at warehouse'
    FROM return_requests rr WHERE rr.order_number = 'ORD-2024-003';

-- Pickup update for the ARRIVED_TO_WAREHOUSE return
INSERT INTO pickup_updates (return_request_id, driver_id, package_condition, item_collected, driver_notes)
    SELECT rr.id,
           (SELECT id FROM drivers WHERE phone = '0502222222'),
           'DAMAGED', TRUE, 'Hub was loosely packed, ports visibly cracked'
    FROM return_requests rr WHERE rr.order_number = 'ORD-2024-003';
