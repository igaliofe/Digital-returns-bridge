package com.drb.server.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

class EntityAnnotationTest {

    @Test
    void userHasEntityAnnotation() {
        assertThat(User.class.isAnnotationPresent(Entity.class)).isTrue();
    }

    @Test
    void userTableNameIsUsers() {
        assertThat(User.class.getAnnotation(Table.class).name()).isEqualTo("users");
    }

    @Test
    void customerHasEntityWithTableCustomers() {
        assertThat(Customer.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Customer.class.getAnnotation(Table.class).name()).isEqualTo("customers");
    }

    @Test
    void productHasEntityWithTableProducts() {
        assertThat(Product.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Product.class.getAnnotation(Table.class).name()).isEqualTo("products");
    }

    @Test
    void driverHasEntityWithTableDrivers() {
        assertThat(Driver.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(Driver.class.getAnnotation(Table.class).name()).isEqualTo("drivers");
    }

    @Test
    void returnRequestHasEntityWithTableReturnRequests() {
        assertThat(ReturnRequest.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(ReturnRequest.class.getAnnotation(Table.class).name()).isEqualTo("return_requests");
    }

    @Test
    void returnRequestHasNoRmaCodeField() {
        for (Field field : ReturnRequest.class.getDeclaredFields()) {
            assertThat(field.getName()).isNotEqualTo("rmaCode");
        }
    }

    @Test
    void returnRequestBarcodeFieldHasUniqueColumn() throws NoSuchFieldException {
        Field barcodeField = ReturnRequest.class.getDeclaredField("barcode");
        assertThat(barcodeField.isAnnotationPresent(Column.class)).isTrue();
        assertThat(barcodeField.getAnnotation(Column.class).unique()).isTrue();
    }

    @Test
    void returnImageHasEntityWithTableReturnImages() {
        assertThat(ReturnImage.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(ReturnImage.class.getAnnotation(Table.class).name()).isEqualTo("return_images");
    }

    @Test
    void pickupUpdateHasEntityWithTablePickupUpdates() {
        assertThat(PickupUpdate.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(PickupUpdate.class.getAnnotation(Table.class).name()).isEqualTo("pickup_updates");
    }

    @Test
    void warehouseInspectionHasEntityWithTableWarehouseInspections() {
        assertThat(WarehouseInspection.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(WarehouseInspection.class.getAnnotation(Table.class).name()).isEqualTo("warehouse_inspections");
    }

    @Test
    void statusHistoryHasEntityWithTableStatusHistory() {
        assertThat(StatusHistory.class.isAnnotationPresent(Entity.class)).isTrue();
        assertThat(StatusHistory.class.getAnnotation(Table.class).name()).isEqualTo("status_history");
    }
}
