-- Digital Returns Bridge — V003 checklist fields
-- Remaps existing enums to the operational-checklist taxonomy and adds the
-- structured fields the service-rep / driver / warehouse checklists require.
-- Runs after V001__init.sql and V002__seed.sql (initdb applies files in
-- alphabetical order, so the V003__ prefix guarantees ordering).

-- ---------------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------------

-- products: catalog image
ALTER TABLE products ADD COLUMN image_url VARCHAR(500);

-- return_requests: service-rep checklist fields
ALTER TABLE return_requests ADD COLUMN original_delivery_date DATE;
ALTER TABLE return_requests ADD COLUMN quantity               INT;
ALTER TABLE return_requests ADD COLUMN under_warranty         BOOLEAN;
ALTER TABLE return_requests ADD COLUMN was_used               BOOLEAN;
ALTER TABLE return_requests ADD COLUMN return_reason          VARCHAR(30);
ALTER TABLE return_requests ADD COLUMN defect_type            VARCHAR(30);
ALTER TABLE return_requests ADD COLUMN defect_stage           VARCHAR(30);
ALTER TABLE return_requests ADD COLUMN defect_location_text   TEXT;

-- pickup_updates: rename package_condition -> item_condition (and widen it for
-- the longer ItemCondition values), plus the driver defect-assessment fields
ALTER TABLE pickup_updates RENAME COLUMN package_condition TO item_condition;
ALTER TABLE pickup_updates ALTER COLUMN item_condition TYPE VARCHAR(40);
ALTER TABLE pickup_updates ADD COLUMN defect_type           VARCHAR(30);
ALTER TABLE pickup_updates ADD COLUMN defect_location       VARCHAR(20);
ALTER TABLE pickup_updates ADD COLUMN defect_location_other TEXT;
ALTER TABLE pickup_updates ADD COLUMN signature_image_url   VARCHAR(500);

-- warehouse_inspections: warehouse-classification checklist fields
ALTER TABLE warehouse_inspections ADD COLUMN item_condition     VARCHAR(40);
ALTER TABLE warehouse_inspections ADD COLUMN call_fully_handled BOOLEAN;

-- ---------------------------------------------------------------------------
-- 2. Drop the old CHECK constraints (auto-named by V001 inline definitions).
--    These must be dropped BEFORE remapping the data, because the old value
--    sets would otherwise reject the new enum strings. The constraint on the
--    renamed column keeps its original name (pickup_updates_package_condition_check).
-- ---------------------------------------------------------------------------

ALTER TABLE return_images         DROP CONSTRAINT return_images_image_type_check;
ALTER TABLE pickup_updates        DROP CONSTRAINT pickup_updates_package_condition_check;
ALTER TABLE warehouse_inspections DROP CONSTRAINT warehouse_inspections_warehouse_decision_check;

-- ---------------------------------------------------------------------------
-- 3. Migrate existing data off the old enum values before re-adding CHECKs
-- ---------------------------------------------------------------------------

-- pickup_updates.item_condition: old package_condition -> ItemCondition
UPDATE pickup_updates SET item_condition = 'USED'                    WHERE item_condition = 'GOOD';
UPDATE pickup_updates SET item_condition = 'SIGNIFICANTLY_DEFECTIVE' WHERE item_condition = 'DAMAGED';
UPDATE pickup_updates SET item_condition = 'USED_MINOR_DEFECT'       WHERE item_condition = 'MISSING';
UPDATE pickup_updates SET item_condition = 'USED'                    WHERE item_condition = 'UNKNOWN';

-- return_images.image_type: old values -> new ImageType
UPDATE return_images SET image_type = 'SERVICE_GENERAL_IMAGE' WHERE image_type = 'SERVICE_IMAGE';

-- warehouse_inspections.warehouse_decision: old values -> new WarehouseDecision
UPDATE warehouse_inspections SET warehouse_decision = 'STOCK_AS_NEW_114'        WHERE warehouse_decision = 'RETURN_TO_STOCK';
UPDATE warehouse_inspections SET warehouse_decision = 'REPAIR'                  WHERE warehouse_decision = 'SEND_TO_REPAIR';
UPDATE warehouse_inspections SET warehouse_decision = 'FROZEN_FURTHER_HANDLING' WHERE warehouse_decision = 'NEEDS_MANAGER_REVIEW';
-- ('DISPOSE' is unchanged between the old and new value sets)

-- ---------------------------------------------------------------------------
-- 4. Re-add / add CHECK constraints with the new contract value sets
-- ---------------------------------------------------------------------------

-- ImageType
ALTER TABLE return_images
    ADD CONSTRAINT return_images_image_type_check
    CHECK (image_type IN ('SERVICE_GENERAL_IMAGE','SERVICE_DEFECT_IMAGE','SERVICE_REP_SIGNATURE',
                          'DRIVER_PRODUCT_IMAGE','DRIVER_DISTANT_IMAGE','DRIVER_DEFECT_IMAGE',
                          'DRIVER_SIGNATURE','WAREHOUSE_IMAGE'));

-- ItemCondition (pickup_updates, renamed column)
ALTER TABLE pickup_updates
    ADD CONSTRAINT pickup_updates_item_condition_check
    CHECK (item_condition IN ('LIKE_NEW_ORIGINAL_PACKAGING','LIKE_NEW_NO_PACKAGING','USED',
                              'USED_MINOR_DEFECT','SIGNIFICANTLY_DEFECTIVE'));

-- WarehouseDecision (remapped value set)
ALTER TABLE warehouse_inspections
    ADD CONSTRAINT warehouse_inspections_warehouse_decision_check
    CHECK (warehouse_decision IN ('STOCK_AS_NEW_114','CLASS_B','SHAPIIM_155','REDESIGN_208',
                                  'FROZEN_FURTHER_HANDLING','REPAIR','DISPOSE'));

-- ReturnReason (return_requests)
ALTER TABLE return_requests
    ADD CONSTRAINT return_requests_return_reason_check
    CHECK (return_reason IN ('NOT_AS_EXPECTED','DELIVERY_ERROR','SELLER_ERROR','SUPPLIER_ERROR',
                             'WAREHOUSE_ERROR','DRIVER_ERROR','CUSTOMER_NOT_HOME','PRODUCT_DEFECT'));

-- DefectType (return_requests)
ALTER TABLE return_requests
    ADD CONSTRAINT return_requests_defect_type_check
    CHECK (defect_type IN ('TEAR','SCRATCH','BREAK','MISSING_PART','FADED_COLOR','RUST','DENT',
                           'REVERSED_SIDE','ELECTRONIC_FAULT'));

-- DefectStage (return_requests)
ALTER TABLE return_requests
    ADD CONSTRAINT return_requests_defect_stage_check
    CHECK (defect_stage IN ('INITIAL_SHIPPING','AFTER_USE','MISSING_PART'));

-- DefectType (pickup_updates)
ALTER TABLE pickup_updates
    ADD CONSTRAINT pickup_updates_defect_type_check
    CHECK (defect_type IN ('TEAR','SCRATCH','BREAK','MISSING_PART','FADED_COLOR','RUST','DENT',
                           'REVERSED_SIDE','ELECTRONIC_FAULT'));

-- DefectLocation (pickup_updates)
ALTER TABLE pickup_updates
    ADD CONSTRAINT pickup_updates_defect_location_check
    CHECK (defect_location IN ('RIGHT_SEAT','LEFT_SEAT','SEAT','LEGS','BACK','OTHER'));

-- ItemCondition (warehouse_inspections)
ALTER TABLE warehouse_inspections
    ADD CONSTRAINT warehouse_inspections_item_condition_check
    CHECK (item_condition IN ('LIKE_NEW_ORIGINAL_PACKAGING','LIKE_NEW_NO_PACKAGING','USED',
                              'USED_MINOR_DEFECT','SIGNIFICANTLY_DEFECTIVE'));

-- ---------------------------------------------------------------------------
-- 5. Enrich the V002-seeded demo rows so the initdb chain (V001 -> V002 -> V003)
--    ends in the same state as the from-scratch path (schema.sql + seed.sql).
--    These statements are no-ops on a database that was not seeded by V002.
-- ---------------------------------------------------------------------------

-- products: catalog imagery
UPDATE products SET image_url = 'https://res.cloudinary.com/demo/image/upload/sample-laptop.jpg'   WHERE sku = 'SKU-001';
UPDATE products SET image_url = 'https://res.cloudinary.com/demo/image/upload/sample-keyboard.jpg' WHERE sku = 'SKU-002';
UPDATE products SET image_url = 'https://res.cloudinary.com/demo/image/upload/sample-usbhub.jpg'   WHERE sku = 'SKU-003';
UPDATE products SET image_url = 'https://res.cloudinary.com/demo/image/upload/sample-monitor.jpg'  WHERE sku = 'SKU-004';
UPDATE products SET image_url = 'https://res.cloudinary.com/demo/image/upload/sample-chair.jpg'    WHERE sku = 'SKU-005';

-- return_requests: service-rep checklist demo data
UPDATE return_requests
   SET original_delivery_date = DATE '2024-05-01', quantity = 1, under_warranty = TRUE, was_used = TRUE,
       return_reason = 'PRODUCT_DEFECT', defect_type = 'ELECTRONIC_FAULT', defect_stage = 'AFTER_USE',
       defect_location_text = 'Screen panel, lower-right quadrant'
 WHERE order_number = 'ORD-2024-001';

UPDATE return_requests
   SET original_delivery_date = DATE '2024-05-10', quantity = 1, under_warranty = FALSE, was_used = FALSE,
       return_reason = 'NOT_AS_EXPECTED'
 WHERE order_number = 'ORD-2024-002';

UPDATE return_requests
   SET original_delivery_date = DATE '2024-05-15', quantity = 2, under_warranty = TRUE, was_used = TRUE,
       return_reason = 'PRODUCT_DEFECT', defect_type = 'BREAK', defect_stage = 'INITIAL_SHIPPING',
       defect_location_text = 'USB-C ports cracked'
 WHERE order_number = 'ORD-2024-003';

UPDATE return_requests
   SET original_delivery_date = DATE '2024-05-20', quantity = 1, under_warranty = FALSE, was_used = FALSE,
       return_reason = 'NOT_AS_EXPECTED'
 WHERE order_number = 'ORD-2024-004';

-- pickup_updates: driver defect assessment + signature for the warehouse-arrived demo return
UPDATE pickup_updates pu
   SET defect_type = 'BREAK', defect_location = 'OTHER', defect_location_other = 'USB-C port housing',
       signature_image_url = 'https://res.cloudinary.com/demo/image/upload/sample-driver-signature.png'
  FROM return_requests rr
 WHERE pu.return_request_id = rr.id AND rr.order_number = 'ORD-2024-003';
