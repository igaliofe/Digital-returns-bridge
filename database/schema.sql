-- Digital Returns Bridge — PostgreSQL DDL
-- No BARCODES table. No rma_code field.
-- Barcodes are assigned by drivers in the field and stored directly on return_requests.

CREATE TABLE users (
    id               BIGSERIAL PRIMARY KEY,
    phone_number     VARCHAR(30)  NOT NULL UNIQUE,
    full_name        VARCHAR(120) NOT NULL,
    role             VARCHAR(30)  NOT NULL CHECK (role IN ('SERVICE_REP','DRIVER','WAREHOUSE','MANAGER')),
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
    id           BIGSERIAL PRIMARY KEY,
    full_name    VARCHAR(120) NOT NULL,
    phone        VARCHAR(30),
    email        VARCHAR(120),
    address      VARCHAR(255),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id           BIGSERIAL PRIMARY KEY,
    sku          VARCHAR(60)  NOT NULL UNIQUE,
    name         VARCHAR(120) NOT NULL,
    category     VARCHAR(80),
    description  TEXT,
    price        NUMERIC(12,2),
    image_url    VARCHAR(500),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE drivers (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users(id),
    vehicle_number VARCHAR(30),
    phone          VARCHAR(30),
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_purchases (
    id                      BIGSERIAL    PRIMARY KEY,
    customer_id             BIGINT       NOT NULL REFERENCES customers(id),
    product_id              BIGINT       NOT NULL REFERENCES products(id),
    order_number            VARCHAR(60),
    quantity                INT,
    original_delivery_date  DATE,
    under_warranty          BOOLEAN,
    handled                 BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE return_requests (
    id                          BIGSERIAL    PRIMARY KEY,
    barcode                     VARCHAR(60)  UNIQUE,           -- nullable; assigned by driver in field
    barcode_assigned_at         TIMESTAMP,                     -- nullable
    barcode_assigned_by_driver_id BIGINT     REFERENCES drivers(id),
    customer_id                 BIGINT       NOT NULL REFERENCES customers(id),
    product_id                  BIGINT       NOT NULL REFERENCES products(id),
    purchase_id                 BIGINT       REFERENCES customer_purchases(id),
    driver_id                   BIGINT       REFERENCES drivers(id),
    opened_by_user_id           BIGINT       NOT NULL REFERENCES users(id),
    order_number                VARCHAR(60),
    reason                      TEXT,
    defect_description          TEXT,
    priority                    VARCHAR(20),
    status                      VARCHAR(30)  NOT NULL DEFAULT 'OPEN'
                                    CHECK (status IN ('OPEN','WAITING_FOR_PICKUP','BARCODE_ASSIGNED',
                                                      'PICKED_UP','ARRIVED_TO_WAREHOUSE','INSPECTED',
                                                      'CLOSED','NEEDS_MORE_INFO')),
    original_delivery_date      DATE,
    quantity                    INT,
    under_warranty              BOOLEAN,
    was_used                    BOOLEAN,
    return_reason               VARCHAR(30)
                                    CHECK (return_reason IN ('NOT_AS_EXPECTED','DELIVERY_ERROR','SELLER_ERROR',
                                                             'SUPPLIER_ERROR','WAREHOUSE_ERROR','DRIVER_ERROR',
                                                             'CUSTOMER_NOT_HOME','PRODUCT_DEFECT')),
    defect_type                 VARCHAR(30)
                                    CHECK (defect_type IN ('TEAR','SCRATCH','BREAK','MISSING_PART','FADED_COLOR',
                                                           'RUST','DENT','REVERSED_SIDE','ELECTRONIC_FAULT')),
    defect_stage                VARCHAR(30)
                                    CHECK (defect_stage IN ('INITIAL_SHIPPING','AFTER_USE','MISSING_PART')),
    defect_location_text        TEXT,
    created_at                  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE return_images (
    id                   BIGSERIAL    PRIMARY KEY,
    return_request_id    BIGINT       NOT NULL REFERENCES return_requests(id),
    uploaded_by_user_id  BIGINT       NOT NULL REFERENCES users(id),
    cloudinary_public_id VARCHAR(255) NOT NULL,
    image_url            VARCHAR(500) NOT NULL,
    image_type           VARCHAR(30)  NOT NULL CHECK (image_type IN ('SERVICE_GENERAL_IMAGE','SERVICE_DEFECT_IMAGE',
                                                                      'SERVICE_REP_SIGNATURE','DRIVER_PRODUCT_IMAGE',
                                                                      'DRIVER_DISTANT_IMAGE','DRIVER_DEFECT_IMAGE',
                                                                      'DRIVER_SIGNATURE','WAREHOUSE_IMAGE')),
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE pickup_updates (
    id                    BIGSERIAL    PRIMARY KEY,
    return_request_id     BIGINT       NOT NULL REFERENCES return_requests(id),
    driver_id             BIGINT       NOT NULL REFERENCES drivers(id),
    item_condition        VARCHAR(40)  NOT NULL CHECK (item_condition IN ('LIKE_NEW_ORIGINAL_PACKAGING',
                                                                          'LIKE_NEW_NO_PACKAGING','USED',
                                                                          'USED_MINOR_DEFECT','SIGNIFICANTLY_DEFECTIVE')),
    defect_type           VARCHAR(30)  CHECK (defect_type IN ('TEAR','SCRATCH','BREAK','MISSING_PART','FADED_COLOR',
                                                              'RUST','DENT','REVERSED_SIDE','ELECTRONIC_FAULT')),
    defect_location       VARCHAR(20)  CHECK (defect_location IN ('RIGHT_SEAT','LEFT_SEAT','SEAT','LEGS','BACK','OTHER')),
    defect_location_other TEXT,
    signature_image_url   VARCHAR(500),
    item_collected        BOOLEAN      NOT NULL DEFAULT FALSE,
    driver_notes          TEXT,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE warehouse_inspections (
    id                    BIGSERIAL    PRIMARY KEY,
    return_request_id     BIGINT       NOT NULL REFERENCES return_requests(id),
    inspected_by_user_id  BIGINT       NOT NULL REFERENCES users(id),
    item_condition        VARCHAR(40)  CHECK (item_condition IN ('LIKE_NEW_ORIGINAL_PACKAGING','LIKE_NEW_NO_PACKAGING',
                                                                 'USED','USED_MINOR_DEFECT','SIGNIFICANTLY_DEFECTIVE')),
    warehouse_decision    VARCHAR(30)  CHECK (warehouse_decision IN ('STOCK_AS_NEW_114','CLASS_B','SHAPIIM_155',
                                                                     'REDESIGN_208','FROZEN_FURTHER_HANDLING',
                                                                     'REPAIR','DISPOSE')),
    call_fully_handled    BOOLEAN,
    warehouse_notes       TEXT,
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE status_history (
    id                  BIGSERIAL    PRIMARY KEY,
    return_request_id   BIGINT       NOT NULL REFERENCES return_requests(id),
    changed_by_user_id  BIGINT       REFERENCES users(id),
    old_status          VARCHAR(30)  CHECK (old_status IN ('OPEN','WAITING_FOR_PICKUP','BARCODE_ASSIGNED',
                                                            'PICKED_UP','ARRIVED_TO_WAREHOUSE','INSPECTED',
                                                            'CLOSED','NEEDS_MORE_INFO')),
    new_status          VARCHAR(30)  NOT NULL CHECK (new_status IN ('OPEN','WAITING_FOR_PICKUP','BARCODE_ASSIGNED',
                                                                     'PICKED_UP','ARRIVED_TO_WAREHOUSE','INSPECTED',
                                                                     'CLOSED','NEEDS_MORE_INFO')),
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    comment             TEXT
);

-- Indexes
CREATE INDEX idx_customer_purchases_customer_id   ON customer_purchases(customer_id);
CREATE INDEX idx_customer_purchases_product_id      ON customer_purchases(product_id);
CREATE INDEX idx_customer_purchases_handled         ON customer_purchases(handled);
CREATE INDEX idx_return_requests_purchase_id        ON return_requests(purchase_id);
CREATE INDEX idx_return_requests_status           ON return_requests(status);
CREATE INDEX idx_return_requests_driver_id        ON return_requests(driver_id);
CREATE INDEX idx_return_requests_customer_id      ON return_requests(customer_id);
CREATE INDEX idx_return_requests_barcode          ON return_requests(barcode);
CREATE INDEX idx_return_images_return_request_id  ON return_images(return_request_id);
CREATE INDEX idx_pickup_updates_return_request_id ON pickup_updates(return_request_id);
CREATE INDEX idx_warehouse_inspections_rr_id      ON warehouse_inspections(return_request_id);
CREATE INDEX idx_status_history_return_request_id ON status_history(return_request_id);
