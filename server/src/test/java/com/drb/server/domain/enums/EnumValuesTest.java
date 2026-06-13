package com.drb.server.domain.enums;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EnumValuesTest {

    @Test
    void roleValues() {
        assertThat(Role.values())
                .containsExactly(Role.SERVICE_REP, Role.DRIVER, Role.WAREHOUSE, Role.MANAGER);
    }

    @Test
    void returnStatusValues() {
        assertThat(ReturnStatus.values())
                .containsExactly(
                        ReturnStatus.OPEN,
                        ReturnStatus.WAITING_FOR_PICKUP,
                        ReturnStatus.BARCODE_ASSIGNED,
                        ReturnStatus.PICKED_UP,
                        ReturnStatus.ARRIVED_TO_WAREHOUSE,
                        ReturnStatus.INSPECTED,
                        ReturnStatus.CLOSED,
                        ReturnStatus.NEEDS_MORE_INFO
                );
    }

    @Test
    void itemConditionValues() {
        assertThat(ItemCondition.values())
                .containsExactly(
                        ItemCondition.LIKE_NEW_ORIGINAL_PACKAGING,
                        ItemCondition.LIKE_NEW_NO_PACKAGING,
                        ItemCondition.USED,
                        ItemCondition.USED_MINOR_DEFECT,
                        ItemCondition.SIGNIFICANTLY_DEFECTIVE
                );
    }

    @Test
    void defectTypeValues() {
        assertThat(DefectType.values())
                .containsExactly(
                        DefectType.TEAR,
                        DefectType.SCRATCH,
                        DefectType.BREAK,
                        DefectType.MISSING_PART,
                        DefectType.FADED_COLOR,
                        DefectType.RUST,
                        DefectType.DENT,
                        DefectType.REVERSED_SIDE,
                        DefectType.ELECTRONIC_FAULT
                );
    }

    @Test
    void defectLocationValues() {
        assertThat(DefectLocation.values())
                .containsExactly(
                        DefectLocation.RIGHT_SEAT,
                        DefectLocation.LEFT_SEAT,
                        DefectLocation.SEAT,
                        DefectLocation.LEGS,
                        DefectLocation.BACK,
                        DefectLocation.OTHER
                );
    }

    @Test
    void returnReasonValues() {
        assertThat(ReturnReason.values())
                .containsExactly(
                        ReturnReason.NOT_AS_EXPECTED,
                        ReturnReason.DELIVERY_ERROR,
                        ReturnReason.SELLER_ERROR,
                        ReturnReason.SUPPLIER_ERROR,
                        ReturnReason.WAREHOUSE_ERROR,
                        ReturnReason.DRIVER_ERROR,
                        ReturnReason.CUSTOMER_NOT_HOME,
                        ReturnReason.PRODUCT_DEFECT
                );
    }

    @Test
    void defectStageValues() {
        assertThat(DefectStage.values())
                .containsExactly(
                        DefectStage.INITIAL_SHIPPING,
                        DefectStage.AFTER_USE,
                        DefectStage.MISSING_PART
                );
    }

    @Test
    void warehouseDecisionValues() {
        assertThat(WarehouseDecision.values())
                .containsExactly(
                        WarehouseDecision.STOCK_AS_NEW_114,
                        WarehouseDecision.CLASS_B,
                        WarehouseDecision.SHAPIIM_155,
                        WarehouseDecision.REDESIGN_208,
                        WarehouseDecision.FROZEN_FURTHER_HANDLING,
                        WarehouseDecision.REPAIR,
                        WarehouseDecision.DISPOSE
                );
    }

    @Test
    void imageTypeValues() {
        assertThat(ImageType.values())
                .containsExactly(
                        ImageType.SERVICE_GENERAL_IMAGE,
                        ImageType.SERVICE_DEFECT_IMAGE,
                        ImageType.SERVICE_REP_SIGNATURE,
                        ImageType.DRIVER_PRODUCT_IMAGE,
                        ImageType.DRIVER_DISTANT_IMAGE,
                        ImageType.DRIVER_DEFECT_IMAGE,
                        ImageType.DRIVER_SIGNATURE,
                        ImageType.WAREHOUSE_IMAGE
                );
    }
}
