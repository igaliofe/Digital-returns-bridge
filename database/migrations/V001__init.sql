-- Digital Returns Bridge — PostgreSQL DDL
-- No BARCODES table. No rma_code field.
-- Barcodes are assigned by drivers in the field and stored directly on return_requests.

CREATE TABLE users (
    id               BIGSERIAL PRIMARY KEY,
    phone_number     VARCHAR(30)  NOT NULL UNIQUE,
    full_name        VARCHAR(120) NOT NULL,
    role             VARCHAR(30)  NOT NULL CHECK (role IN ('SERVICE_REP','DRIVER','WAREHOUSE','MANAGER')),
    active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
    id           BIGSERIAL PRIMARY KEY,
    full_name    VARCHAR(120) NOT NULL,
    phone        VARCHAR(30),
    email        VARCHAR(120),
    address      VARCHAR(255),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id           BIGSERIAL PRIMARY KEY,
    sku          VARCHAR(60)  NOT NULL UNIQUE,
    name         VARCHAR(120) NOT NULL,
    category     VARCHAR(80),
    description  TEXT,
    price        NUMERIC(12,2),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE drivers (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users(id),
    vehicle_number VARCHAR(30),
    phone          VARCHAR(30),
    active         BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE return_requests (
    id                          BIGSERIAL    PRIMARY KEY,
    barcode                     VARCHAR(60)  UNIQUE,           -- nullable; assigned by driver in field
    barcode_assigned_at         TIMESTAMP,                     -- nullable
    barcode_assigned_by_driver_id BIGINT     REFERENCES drivers(id),
    customer_id                 BIGINT       NOT NULL REFERENCES customers(id),
    product_id                  BIGINT       NOT NULL REFERENCES products(id),
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
    created_at                  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE return_images (
    id                   BIGSERIAL    PRIMARY KEY,
    return_request_id    BIGINT       NOT NULL REFERENCES return_requests(id),
    uploaded_by_user_id  BIGINT       NOT NULL REFERENCES users(id),
    cloudinary_public_id VARCHAR(255) NOT NULL,
    image_url            VARCHAR(500) NOT NULL,
    image_type           VARCHAR(30)  NOT NULL CHECK (image_type IN ('SERVICE_IMAGE','DRIVER_PRODUCT_IMAGE',
                                                                      'DRIVER_DEFECT_IMAGE','WAREHOUSE_IMAGE')),
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE pickup_updates (
    id                 BIGSERIAL    PRIMARY KEY,
    return_request_id  BIGINT       NOT NULL REFERENCES return_requests(id),
    driver_id          BIGINT       NOT NULL REFERENCES drivers(id),
    package_condition  VARCHAR(20)  NOT NULL CHECK (package_condition IN ('GOOD','DAMAGED','MISSING','UNKNOWN')),
    item_collected     BOOLEAN      NOT NULL DEFAULT FALSE,
    driver_notes       TEXT,
    created_at         TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE warehouse_inspections (
    id                    BIGSERIAL    PRIMARY KEY,
    return_request_id     BIGINT       NOT NULL REFERENCES return_requests(id),
    inspected_by_user_id  BIGINT       NOT NULL REFERENCES users(id),
    warehouse_decision    VARCHAR(30)  CHECK (warehouse_decision IN ('RETURN_TO_STOCK','SEND_TO_REPAIR',
                                                                      'DISPOSE','NEEDS_MANAGER_REVIEW')),
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
    changed_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    comment             TEXT
);

-- Indexes
CREATE INDEX idx_return_requests_status           ON return_requests(status);
CREATE INDEX idx_return_requests_driver_id        ON return_requests(driver_id);
CREATE INDEX idx_return_requests_customer_id      ON return_requests(customer_id);
CREATE INDEX idx_return_requests_barcode          ON return_requests(barcode);
CREATE INDEX idx_return_images_return_request_id  ON return_images(return_request_id);
CREATE INDEX idx_pickup_updates_return_request_id ON pickup_updates(return_request_id);
CREATE INDEX idx_warehouse_inspections_rr_id      ON warehouse_inspections(return_request_id);
CREATE INDEX idx_status_history_return_request_id ON status_history(return_request_id);
