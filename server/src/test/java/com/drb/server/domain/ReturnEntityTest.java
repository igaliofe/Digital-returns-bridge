package com.drb.server.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

class ReturnEntityTest {

    @Test
    void returnRequestHasEntityAndTableName() {
        assertThat(ReturnRequest.class.isAnnotationPresent(Entity.class)).isTrue();
        Table table = ReturnRequest.class.getAnnotation(Table.class);
        assertThat(table).isNotNull();
        assertThat(table.name()).isEqualTo("return_requests");
    }

    @Test
    void barcodeFieldIsUniqueAndNullable() throws NoSuchFieldException {
        Field barcodeField = ReturnRequest.class.getDeclaredField("barcode");
        Column column = barcodeField.getAnnotation(Column.class);
        assertThat(column).isNotNull();
        assertThat(column.unique()).isTrue();
        assertThat(column.nullable()).isTrue();
    }

    @Test
    void barcodeAssignedByDriverHasManyToOne() throws NoSuchFieldException {
        Field field = ReturnRequest.class.getDeclaredField("barcodeAssignedByDriver");
        assertThat(field.isAnnotationPresent(ManyToOne.class)).isTrue();
    }

    @Test
    void returnRequestHasNoRmaCodeField() {
        boolean hasRmaCode = false;
        for (Field f : ReturnRequest.class.getDeclaredFields()) {
            if (f.getName().equals("rmaCode")) {
                hasRmaCode = true;
                break;
            }
        }
        assertThat(hasRmaCode).isFalse();
    }

    @Test
    void returnImageHasEntityAndManyToOneReturnRequest() throws NoSuchFieldException {
        assertThat(ReturnImage.class.isAnnotationPresent(Entity.class)).isTrue();
        Field field = ReturnImage.class.getDeclaredField("returnRequest");
        assertThat(field.isAnnotationPresent(ManyToOne.class)).isTrue();
    }
}
