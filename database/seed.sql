-- Digital Returns Bridge — Seed Data (heavy dataset)
--
-- NOTE ON IDs: this file is only ever run by Postgres on a FRESH volume
-- (docker-entrypoint-initdb.d, after 01_schema.sql). BIGSERIAL ids are therefore
-- deterministic: rows get ids 1,2,3,... in insert order. The bulk inserts below
-- reference those ids directly (users 1-6, drivers 1-2, customers 1-20, products 1-25).
--
-- All products use the same verified-working Cloudinary demo asset so the catalog
-- photo renders in the app instead of a grey placeholder:
--   https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg

-- Users (ids 1-6)
INSERT INTO users (phone_number, full_name, role, active) VALUES
    ('0501111111', 'Alice Cohen',    'SERVICE_REP', TRUE),   -- id 1
    ('0502222222', 'Bob Levi',       'DRIVER',      TRUE),   -- id 2
    ('0503333333', 'Carol Mizrahi',  'WAREHOUSE',   TRUE),   -- id 3
    ('0505555555', 'Eli Bar-On',     'WAREHOUSE',   TRUE),   -- id 4
    ('0504444444', 'David Katz',     'MANAGER',     TRUE),   -- id 5
    ('0506666666', 'Dana Avraham',   'DRIVER',      TRUE);   -- id 6

-- Drivers (ids 1-2): Bob Levi and Dana Avraham
INSERT INTO drivers (user_id, vehicle_number, phone, active) VALUES
    (2, 'ABC-123', '0502222222', TRUE),   -- driver id 1 (Bob)
    (6, 'XYZ-789', '0506666666', TRUE);   -- driver id 2 (Dana)

-- Customers (ids 1-20)
INSERT INTO customers (full_name, phone, email, address) VALUES
    ('Yael Shapiro',   '0521000001', 'yael@example.com',   '5 Herzl St, Tel Aviv'),
    ('Moshe Peretz',   '0521000002', 'moshe@example.com',  '12 Ben Yehuda St, Haifa'),
    ('Noa Goldberg',   '0521000003', 'noa@example.com',    '3 Dizengoff St, Tel Aviv'),
    ('Avi Friedman',   '0521000004', 'avi@example.com',    '7 Allenby St, Tel Aviv'),
    ('Tamar Levi',     '0521000005', 'tamar@example.com',  '21 Jaffa St, Jerusalem'),
    ('Itai Cohen',     '0521000006', 'itai@example.com',   '4 Rothschild Blvd, Tel Aviv'),
    ('Shira Azoulay',  '0521000007', 'shira@example.com',  '9 King George St, Jerusalem'),
    ('Yossi Mizrahi',  '0521000008', 'yossi@example.com',  '14 HaNassi St, Haifa'),
    ('Rivka Stern',    '0521000009', 'rivka@example.com',  '2 Weizmann St, Rehovot'),
    ('Daniel Katz',    '0521000010', 'danielk@example.com','30 Sokolov St, Herzliya'),
    ('Maya Barak',     '0521000011', 'maya@example.com',   '6 Bialik St, Ramat Gan'),
    ('Eitan Regev',    '0521000012', 'eitan@example.com',  '18 Arlozorov St, Tel Aviv'),
    ('Liora Ben-Ami',  '0521000013', 'liora@example.com',  '11 Gordon St, Tel Aviv'),
    ('Omer Shani',     '0521000014', 'omer@example.com',   '8 HaPalmach St, Beer Sheva'),
    ('Hila Dahan',     '0521000015', 'hila@example.com',   '25 Trumpeldor St, Tel Aviv'),
    ('Nadav Tal',      '0521000016', 'nadav@example.com',  '3 HaShalom Rd, Givatayim'),
    ('Gali Weiss',     '0521000017', 'gali@example.com',   '17 Ahad Ha''am St, Tel Aviv'),
    ('Ronen Avraham',  '0521000018', 'ronen@example.com',  '5 Haifa Rd, Akko'),
    ('Sivan Klein',    '0521000019', 'sivan@example.com',  '22 Begin Blvd, Petah Tikva'),
    ('Tomer Geva',     '0521000020', 'tomer@example.com',  '13 Yarkon St, Bat Yam');

-- Products (ids 1-25). Every image_url points at the working chair-and-coffee-table asset.
INSERT INTO products (sku, name, category, description, price, image_url) VALUES
    ('SKU-001', 'Laptop Pro 15',      'Electronics', '15-inch professional laptop',         4999.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-002', 'Wireless Keyboard',  'Accessories', 'Bluetooth mechanical keyboard',        299.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-003', 'USB-C Hub 7-port',   'Accessories', '7-port USB-C hub with PD',             149.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-004', 'Monitor 27" 4K',     'Electronics', '27-inch 4K IPS monitor',              2499.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-005', 'Office Chair',       'Furniture',   'Ergonomic mesh office chair',         1299.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-006', 'Standing Desk',      'Furniture',   'Electric height-adjustable desk',     1899.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-007', 'Coffee Table',       'Furniture',   'Oak coffee table',                     799.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-008', 'Wireless Mouse',     'Accessories', 'Ergonomic wireless mouse',             129.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-009', 'Noise-Cancel Headset','Electronics','Over-ear ANC headphones',              899.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-010', 'Webcam 4K',          'Electronics', '4K UHD streaming webcam',              449.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-011', 'Desk Lamp LED',      'Furniture',   'Dimmable LED desk lamp',               199.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-012', 'Bookshelf 5-tier',   'Furniture',   '5-tier wooden bookshelf',              649.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-013', 'Espresso Machine',   'Appliances',  'Automatic espresso machine',          2199.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-014', 'Air Fryer XL',       'Appliances',  '7-litre digital air fryer',            599.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-015', 'Robot Vacuum',       'Appliances',  'Self-emptying robot vacuum',          1799.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-016', 'Smart Speaker',      'Electronics', 'Voice-assistant smart speaker',        349.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-017', 'Tablet 11"',         'Electronics', '11-inch tablet 128GB',                2299.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-018', 'Mechanical Pencil Set','Accessories','Set of 6 drafting pencils',            79.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-019', 'Gaming Chair',       'Furniture',   'Reclining gaming chair',              1599.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-020', 'Portable SSD 1TB',   'Accessories', 'USB-C portable SSD 1TB',               499.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-021', 'Bluetooth Speaker',  'Electronics', 'Waterproof portable speaker',          399.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-022', 'Floor Lamp',         'Furniture',   'Arc floor lamp',                       549.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-023', 'Microwave Oven',     'Appliances',  '25L digital microwave',                699.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-024', 'Electric Kettle',    'Appliances',  '1.7L stainless kettle',                179.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-025', 'Monitor Arm Dual',   'Accessories', 'Dual-monitor desk mount',              329.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-026', 'Mini Projector',     'Electronics', '1080p portable projector',             899.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-027', 'Stand Mixer',        'Appliances',  '5L tilt-head stand mixer',            1099.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-028', 'Accent Armchair',    'Furniture',   'Velvet accent armchair',               999.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-029', 'Mechanical Keypad',  'Accessories', 'Programmable macro keypad',            189.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg'),
    ('SKU-030', 'Smart Thermostat',   'Electronics', 'Wi-Fi smart thermostat',               429.00, 'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg');

-- Customer purchases: 4 products per customer (deterministic window over products),
-- giving the Item Selection wizard plenty of varied data. order_number unique per (customer,product).
INSERT INTO customer_purchases (customer_id, product_id, order_number, quantity, original_delivery_date, under_warranty, handled)
SELECT c.id,
       p.id,
       'ORD-' || LPAD(c.id::text, 2, '0') || '-' || LPAD(p.id::text, 2, '0'),
       1 + (p.id % 3),
       DATE '2024-01-01' + (((c.id * 13 + p.id * 7) % 330))::int,
       (p.id % 2 = 0),
       (p.id % 5 = 0)
FROM customers c
JOIN products p ON ((((p.id - c.id) % 25) + 25) % 25) < 4;

-- Return requests (40), spread across all 8 statuses with varied enums.
-- Columns mirror the schema; barcode fields set only from BARCODE_ASSIGNED onward.
INSERT INTO return_requests
    (barcode, barcode_assigned_at, barcode_assigned_by_driver_id,
     customer_id, product_id, driver_id, opened_by_user_id,
     order_number, reason, defect_description, priority, status,
     original_delivery_date, quantity, under_warranty, was_used,
     return_reason, defect_type, defect_stage, defect_location_text)
VALUES
    -- OPEN (no driver, no barcode)
    (NULL, NULL, NULL,  1,  1, NULL, 1, 'RORD-001', 'Changed mind',        NULL,                       'LOW',    'OPEN', DATE '2024-05-01', 1, FALSE, FALSE, 'NOT_AS_EXPECTED',  NULL,              NULL,              NULL),
    (NULL, NULL, NULL,  2,  6, NULL, 1, 'RORD-002', 'Found cheaper',       NULL,                       'LOW',    'OPEN', DATE '2024-05-03', 1, FALSE, FALSE, 'NOT_AS_EXPECTED',  NULL,              NULL,              NULL),
    (NULL, NULL, NULL,  3,  7, NULL, 1, 'RORD-003', 'No longer needed',    NULL,                       'LOW',    'OPEN', DATE '2024-05-04', 2, TRUE,  FALSE, 'CUSTOMER_NOT_HOME',NULL,              NULL,              NULL),
    (NULL, NULL, NULL,  4,  8, NULL, 1, 'RORD-004', 'Ordered by mistake',  NULL,                       'MEDIUM', 'OPEN', DATE '2024-05-06', 1, FALSE, FALSE, 'DELIVERY_ERROR',   NULL,              NULL,              NULL),
    (NULL, NULL, NULL,  5,  9, NULL, 1, 'RORD-005', 'Duplicate order',     NULL,                       'LOW',    'OPEN', DATE '2024-05-07', 1, TRUE,  FALSE, 'SELLER_ERROR',     NULL,              NULL,              NULL),
    -- WAITING_FOR_PICKUP (driver assigned, no barcode yet)
    (NULL, NULL, NULL,  6, 10, 1, 1, 'RORD-006', 'Defective on arrival', 'Surface scratch on lid',   'HIGH',   'WAITING_FOR_PICKUP', DATE '2024-05-08', 1, TRUE,  FALSE, 'PRODUCT_DEFECT', 'SCRATCH',      'INITIAL_SHIPPING', 'Scratch on lid'),
    (NULL, NULL, NULL,  7, 11, 1, 1, 'RORD-007', 'Wrong color',          NULL,                       'MEDIUM', 'WAITING_FOR_PICKUP', DATE '2024-05-09', 1, FALSE, FALSE, 'NOT_AS_EXPECTED', NULL,          NULL,              NULL),
    (NULL, NULL, NULL,  8, 12, 2, 1, 'RORD-008', 'Missing parts',        'Box missing screws',       'HIGH',   'WAITING_FOR_PICKUP', DATE '2024-05-10', 1, TRUE,  FALSE, 'PRODUCT_DEFECT', 'MISSING_PART', 'MISSING_PART',    'Mounting screws absent'),
    (NULL, NULL, NULL,  9, 13, 1, 1, 'RORD-009', 'Damaged in transit',   'Dent on corner',           'HIGH',   'WAITING_FOR_PICKUP', DATE '2024-05-11', 1, FALSE, FALSE, 'DELIVERY_ERROR', 'DENT',         'INITIAL_SHIPPING','Corner dented'),
    (NULL, NULL, NULL, 10, 14, 2, 1, 'RORD-010', 'Not as described',     NULL,                       'MEDIUM', 'WAITING_FOR_PICKUP', DATE '2024-05-12', 2, FALSE, FALSE, 'SELLER_ERROR',   NULL,           NULL,              NULL),
    -- WAITING_FOR_PICKUP (extra batch, new products 26-30; need pickup + barcode scan)
    (NULL, NULL, NULL, 11, 26, 1, 1, 'RORD-041', 'Cracked lens',         'Projector lens cracked',   'HIGH',   'WAITING_FOR_PICKUP', DATE '2024-06-12', 1, TRUE,  FALSE, 'PRODUCT_DEFECT', 'BREAK',        'INITIAL_SHIPPING', 'Front lens'),
    (NULL, NULL, NULL, 12, 27, 2, 1, 'RORD-042', 'Motor overheats',      'Mixer motor smells burnt', 'HIGH',   'WAITING_FOR_PICKUP', DATE '2024-06-13', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'ELECTRONIC_FAULT','AFTER_USE',     'Motor housing'),
    (NULL, NULL, NULL, 13, 28, 1, 1, 'RORD-043', 'Torn upholstery',      'Armrest fabric torn',      'MEDIUM', 'WAITING_FOR_PICKUP', DATE '2024-06-14', 1, FALSE, FALSE, 'PRODUCT_DEFECT', 'TEAR',         'INITIAL_SHIPPING', 'Right armrest'),
    (NULL, NULL, NULL, 14, 29, 2, 1, 'RORD-044', 'Dead keys',            'Three macro keys dead',    'MEDIUM', 'WAITING_FOR_PICKUP', DATE '2024-06-15', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'ELECTRONIC_FAULT','AFTER_USE',     'Top-row keys'),
    (NULL, NULL, NULL, 15, 30, 1, 1, 'RORD-045', 'Wont connect',         'No Wi-Fi pairing',         'LOW',    'WAITING_FOR_PICKUP', DATE '2024-06-16', 1, TRUE,  FALSE, 'PRODUCT_DEFECT', 'ELECTRONIC_FAULT','INITIAL_SHIPPING','Wi-Fi module'),
    -- BARCODE_ASSIGNED
    ('RET-10001', NOW() - INTERVAL '2 days', 1, 11, 15, 1, 1, 'RORD-011', 'Faulty unit',      'Wont power on',        'HIGH',   'BARCODE_ASSIGNED', DATE '2024-05-13', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'ELECTRONIC_FAULT', 'AFTER_USE',       'No power'),
    ('RET-10002', NOW() - INTERVAL '2 days', 1, 12, 16, 1, 1, 'RORD-012', 'Torn fabric',      'Tear on seam',         'MEDIUM', 'BARCODE_ASSIGNED', DATE '2024-05-14', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'TEAR',             'AFTER_USE',       'Seam torn'),
    ('RET-10003', NOW() - INTERVAL '2 days', 2, 13, 17, 2, 1, 'RORD-013', 'Rust spots',       'Rust on legs',         'LOW',    'BARCODE_ASSIGNED', DATE '2024-05-15', 1, FALSE, TRUE,  'PRODUCT_DEFECT', 'RUST',             'AFTER_USE',       'Rust on legs'),
    ('RET-10004', NOW() - INTERVAL '2 days', 1, 14, 18, 1, 1, 'RORD-014', 'Wrong item shipped',NULL,                  'MEDIUM', 'BARCODE_ASSIGNED', DATE '2024-05-16', 1, FALSE, FALSE, 'WAREHOUSE_ERROR',NULL,               NULL,              NULL),
    ('RET-10005', NOW() - INTERVAL '2 days', 2, 15, 19, 2, 1, 'RORD-015', 'Color faded',      'Faded after wash',     'LOW',    'BARCODE_ASSIGNED', DATE '2024-05-17', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'FADED_COLOR',      'AFTER_USE',       'Faded fabric'),
    -- PICKED_UP
    ('RET-10006', NOW() - INTERVAL '3 days', 1, 16, 20, 1, 1, 'RORD-016', 'Broken hinge',     'Hinge snapped',        'HIGH',   'PICKED_UP', DATE '2024-05-18', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'BREAK',            'AFTER_USE',       'Hinge'),
    ('RET-10007', NOW() - INTERVAL '3 days', 1, 17, 21, 1, 1, 'RORD-017', 'Defective motor',  'Motor noise',          'HIGH',   'PICKED_UP', DATE '2024-05-19', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'ELECTRONIC_FAULT', 'AFTER_USE',       'Motor housing'),
    ('RET-10008', NOW() - INTERVAL '3 days', 2, 18, 22, 2, 1, 'RORD-018', 'Reversed panel',   'Panel backwards',      'LOW',    'PICKED_UP', DATE '2024-05-20', 1, FALSE, FALSE, 'PRODUCT_DEFECT', 'REVERSED_SIDE',    'INITIAL_SHIPPING','Front panel'),
    ('RET-10009', NOW() - INTERVAL '3 days', 1, 19, 23, 1, 1, 'RORD-019', 'Supplier defect',  'Scratches from supplier','MEDIUM','PICKED_UP', DATE '2024-05-21', 1, TRUE,  FALSE, 'SUPPLIER_ERROR', 'SCRATCH',          'INITIAL_SHIPPING','Side panel'),
    ('RET-10010', NOW() - INTERVAL '3 days', 2, 20, 24, 2, 1, 'RORD-020', 'Driver mishandled','Dropped on delivery',  'MEDIUM', 'PICKED_UP', DATE '2024-05-22', 1, FALSE, FALSE, 'DRIVER_ERROR',   'DENT',             'INITIAL_SHIPPING','Body dented'),
    -- ARRIVED_TO_WAREHOUSE
    ('RET-10011', NOW() - INTERVAL '4 days', 1,  1, 25, 1, 1, 'RORD-021', 'Dead pixels',      'Screen dead pixels',   'HIGH',   'ARRIVED_TO_WAREHOUSE', DATE '2024-05-23', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'ELECTRONIC_FAULT', 'AFTER_USE',       'Lower-right quadrant'),
    ('RET-10012', NOW() - INTERVAL '4 days', 1,  2,  1, 1, 1, 'RORD-022', 'Cracked screen',   'Cracked on arrival',   'HIGH',   'ARRIVED_TO_WAREHOUSE', DATE '2024-05-24', 1, TRUE,  FALSE, 'PRODUCT_DEFECT', 'BREAK',            'INITIAL_SHIPPING','Screen glass'),
    ('RET-10013', NOW() - INTERVAL '4 days', 2,  3,  2, 2, 1, 'RORD-023', 'Keys missing',     'Two keycaps missing',  'MEDIUM', 'ARRIVED_TO_WAREHOUSE', DATE '2024-05-25', 1, FALSE, TRUE,  'PRODUCT_DEFECT', 'MISSING_PART',     'MISSING_PART',    'Keycaps'),
    ('RET-10014', NOW() - INTERVAL '4 days', 1,  4,  3, 1, 1, 'RORD-024', 'Ports broken',     'USB ports cracked',    'HIGH',   'ARRIVED_TO_WAREHOUSE', DATE '2024-05-26', 2, TRUE,  TRUE,  'PRODUCT_DEFECT', 'BREAK',            'AFTER_USE',       'USB-C ports'),
    ('RET-10015', NOW() - INTERVAL '4 days', 2,  5,  4, 2, 1, 'RORD-025', 'Backlight bleed',  'Backlight uneven',     'MEDIUM', 'ARRIVED_TO_WAREHOUSE', DATE '2024-05-27', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'ELECTRONIC_FAULT', 'AFTER_USE',       'Edge backlight'),
    ('RET-10016', NOW() - INTERVAL '4 days', 1,  6,  5, 1, 1, 'RORD-026', 'Wobbly chair',     'Leg loose',            'LOW',    'ARRIVED_TO_WAREHOUSE', DATE '2024-05-28', 1, FALSE, TRUE,  'PRODUCT_DEFECT', 'BREAK',            'AFTER_USE',       'Front-left leg'),
    -- INSPECTED
    ('RET-10017', NOW() - INTERVAL '5 days', 1,  7,  6, 1, 1, 'RORD-027', 'Torn cushion',     'Cushion seam torn',    'MEDIUM', 'INSPECTED', DATE '2024-05-29', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'TEAR',             'AFTER_USE',       'Seat cushion'),
    ('RET-10018', NOW() - INTERVAL '5 days', 2,  8,  7, 2, 1, 'RORD-028', 'Faulty cable',     'Cable shorts',         'HIGH',   'INSPECTED', DATE '2024-05-30', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'ELECTRONIC_FAULT', 'AFTER_USE',       'Power cable'),
    ('RET-10019', NOW() - INTERVAL '5 days', 1,  9,  8, 1, 1, 'RORD-029', 'Scratched surface','Deep scratch',         'LOW',    'INSPECTED', DATE '2024-05-31', 1, FALSE, FALSE, 'PRODUCT_DEFECT', 'SCRATCH',          'INITIAL_SHIPPING','Top surface'),
    ('RET-10020', NOW() - INTERVAL '5 days', 1, 10,  9, 1, 1, 'RORD-030', 'Dented frame',     'Frame dented',         'MEDIUM', 'INSPECTED', DATE '2024-06-01', 1, TRUE,  FALSE, 'PRODUCT_DEFECT', 'DENT',             'INITIAL_SHIPPING','Frame edge'),
    ('RET-10021', NOW() - INTERVAL '5 days', 2, 11, 10, 2, 1, 'RORD-031', 'Missing remote',   'Remote not in box',    'LOW',    'INSPECTED', DATE '2024-06-02', 1, TRUE,  FALSE, 'PRODUCT_DEFECT', 'MISSING_PART',     'MISSING_PART',    'Remote control'),
    -- CLOSED
    ('RET-10022', NOW() - INTERVAL '7 days', 1, 12, 11, 1, 1, 'RORD-032', 'Resolved - refunded',NULL,                'MEDIUM', 'CLOSED', DATE '2024-06-03', 1, FALSE, FALSE, 'NOT_AS_EXPECTED',NULL,               NULL,              NULL),
    ('RET-10023', NOW() - INTERVAL '7 days', 1, 13, 12, 1, 1, 'RORD-033', 'Repaired and returned','Fixed hinge',     'HIGH',   'CLOSED', DATE '2024-06-04', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'BREAK',            'AFTER_USE',       'Hinge'),
    ('RET-10024', NOW() - INTERVAL '7 days', 2, 14, 13, 2, 1, 'RORD-034', 'Restocked',        NULL,                   'LOW',    'CLOSED', DATE '2024-06-05', 1, FALSE, FALSE, 'NOT_AS_EXPECTED',NULL,               NULL,              NULL),
    ('RET-10025', NOW() - INTERVAL '7 days', 1, 15, 14, 1, 1, 'RORD-035', 'Disposed',         'Heavy rust',           'HIGH',   'CLOSED', DATE '2024-06-06', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'RUST',             'AFTER_USE',       'Base plate'),
    ('RET-10026', NOW() - INTERVAL '7 days', 2, 16, 15, 2, 1, 'RORD-036', 'Class B sale',     'Minor scratch',        'MEDIUM', 'CLOSED', DATE '2024-06-07', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'SCRATCH',          'AFTER_USE',       'Side'),
    -- NEEDS_MORE_INFO
    ('RET-10027', NOW() - INTERVAL '6 days', 1, 17, 16, 1, 1, 'RORD-037', 'Unclear defect',   'Intermittent fault',   'MEDIUM', 'NEEDS_MORE_INFO', DATE '2024-06-08', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'ELECTRONIC_FAULT', 'AFTER_USE',       'Need more info'),
    ('RET-10028', NOW() - INTERVAL '6 days', 2, 18, 17, 2, 1, 'RORD-038', 'Photo unclear',    'Need clearer photos',  'LOW',    'NEEDS_MORE_INFO', DATE '2024-06-09', 1, FALSE, TRUE,  'PRODUCT_DEFECT', 'SCRATCH',          'AFTER_USE',       'Unclear area'),
    ('RET-10029', NOW() - INTERVAL '6 days', 1, 19, 18, 1, 1, 'RORD-039', 'Missing docs',     NULL,                   'MEDIUM', 'NEEDS_MORE_INFO', DATE '2024-06-10', 1, FALSE, FALSE, 'WAREHOUSE_ERROR',NULL,               NULL,              NULL),
    ('RET-10030', NOW() - INTERVAL '6 days', 2, 20, 19, 2, 1, 'RORD-040', 'Verify warranty',  'Confirm warranty',     'HIGH',   'NEEDS_MORE_INFO', DATE '2024-06-11', 1, TRUE,  TRUE,  'PRODUCT_DEFECT', 'BREAK',            'AFTER_USE',       'Warranty check');

-- Status history: synthesize the transition chain leading up to each return's current status.
-- (Built per-status via INSERT..SELECT so it scales with the data above.)
-- OPEN -> WAITING_FOR_PICKUP (everything past OPEN)
INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
SELECT id, 1, 'OPEN', 'WAITING_FOR_PICKUP', 'Driver assigned'
FROM return_requests
WHERE status IN ('WAITING_FOR_PICKUP','BARCODE_ASSIGNED','PICKED_UP','ARRIVED_TO_WAREHOUSE','INSPECTED','CLOSED','NEEDS_MORE_INFO');

-- WAITING_FOR_PICKUP -> BARCODE_ASSIGNED
INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
SELECT id, 2, 'WAITING_FOR_PICKUP', 'BARCODE_ASSIGNED', 'Barcode ' || barcode || ' scanned'
FROM return_requests
WHERE status IN ('BARCODE_ASSIGNED','PICKED_UP','ARRIVED_TO_WAREHOUSE','INSPECTED','CLOSED','NEEDS_MORE_INFO');

-- BARCODE_ASSIGNED -> PICKED_UP
INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
SELECT id, 2, 'BARCODE_ASSIGNED', 'PICKED_UP', 'Item collected'
FROM return_requests
WHERE status IN ('PICKED_UP','ARRIVED_TO_WAREHOUSE','INSPECTED','CLOSED','NEEDS_MORE_INFO');

-- PICKED_UP -> ARRIVED_TO_WAREHOUSE
INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
SELECT id, 3, 'PICKED_UP', 'ARRIVED_TO_WAREHOUSE', 'Received at warehouse'
FROM return_requests
WHERE status IN ('ARRIVED_TO_WAREHOUSE','INSPECTED','CLOSED','NEEDS_MORE_INFO');

-- ARRIVED_TO_WAREHOUSE -> INSPECTED
INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
SELECT id, 3, 'ARRIVED_TO_WAREHOUSE', 'INSPECTED', 'Inspection completed'
FROM return_requests
WHERE status IN ('INSPECTED','CLOSED');

-- INSPECTED -> CLOSED
INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
SELECT id, 3, 'INSPECTED', 'CLOSED', 'Return closed'
FROM return_requests
WHERE status = 'CLOSED';

-- ARRIVED_TO_WAREHOUSE -> NEEDS_MORE_INFO
INSERT INTO status_history (return_request_id, changed_by_user_id, old_status, new_status, comment)
SELECT id, 3, 'ARRIVED_TO_WAREHOUSE', 'NEEDS_MORE_INFO', 'More information requested'
FROM return_requests
WHERE status = 'NEEDS_MORE_INFO';

-- Pickup updates: one per return that has been picked up (PICKED_UP and beyond).
INSERT INTO pickup_updates (return_request_id, driver_id, item_condition, defect_type,
                            defect_location, defect_location_other, signature_image_url,
                            item_collected, driver_notes)
SELECT rr.id,
       rr.driver_id,
       CASE (rr.id % 5)
           WHEN 0 THEN 'SIGNIFICANTLY_DEFECTIVE'
           WHEN 1 THEN 'USED_MINOR_DEFECT'
           WHEN 2 THEN 'USED'
           WHEN 3 THEN 'LIKE_NEW_NO_PACKAGING'
           ELSE        'LIKE_NEW_ORIGINAL_PACKAGING'
       END,
       rr.defect_type,
       CASE (rr.id % 6)
           WHEN 0 THEN 'RIGHT_SEAT'
           WHEN 1 THEN 'LEFT_SEAT'
           WHEN 2 THEN 'SEAT'
           WHEN 3 THEN 'LEGS'
           WHEN 4 THEN 'BACK'
           ELSE        'OTHER'
       END,
       CASE WHEN (rr.id % 6) = 5 THEN 'See driver notes' ELSE NULL END,
       'https://res.cloudinary.com/demo/image/upload/samples/chair-and-coffee-table.jpg',
       TRUE,
       'Collected from customer; condition logged at pickup.'
FROM return_requests rr
WHERE rr.status IN ('PICKED_UP','ARRIVED_TO_WAREHOUSE','INSPECTED','CLOSED','NEEDS_MORE_INFO');

-- Warehouse inspections: one per return that reached inspection (INSPECTED, CLOSED, NEEDS_MORE_INFO).
INSERT INTO warehouse_inspections (return_request_id, inspected_by_user_id, item_condition,
                                   warehouse_decision, call_fully_handled, warehouse_notes)
SELECT rr.id,
       CASE WHEN (rr.id % 2) = 0 THEN 3 ELSE 4 END,   -- Carol (3) / Eli (4)
       CASE (rr.id % 5)
           WHEN 0 THEN 'SIGNIFICANTLY_DEFECTIVE'
           WHEN 1 THEN 'USED_MINOR_DEFECT'
           WHEN 2 THEN 'USED'
           WHEN 3 THEN 'LIKE_NEW_NO_PACKAGING'
           ELSE        'LIKE_NEW_ORIGINAL_PACKAGING'
       END,
       CASE
           WHEN rr.status = 'NEEDS_MORE_INFO' THEN 'FROZEN_FURTHER_HANDLING'
           ELSE CASE (rr.id % 6)
               WHEN 0 THEN 'STOCK_AS_NEW_114'
               WHEN 1 THEN 'CLASS_B'
               WHEN 2 THEN 'SHAPIIM_155'
               WHEN 3 THEN 'REDESIGN_208'
               WHEN 4 THEN 'REPAIR'
               ELSE        'DISPOSE'
           END
       END,
       (rr.status = 'CLOSED'),
       CASE rr.status
           WHEN 'CLOSED'          THEN 'Inspection complete; return closed.'
           WHEN 'NEEDS_MORE_INFO' THEN 'Frozen pending more information from service rep.'
           ELSE 'Inspection complete; awaiting final decision.'
       END
FROM return_requests rr
WHERE rr.status IN ('INSPECTED','CLOSED','NEEDS_MORE_INFO');
