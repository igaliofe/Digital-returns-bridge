package com.drb.server.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

class OperationalEntityTest {

    @Test
    void pickupUpdateHasEntityAndFkManyToOne() throws NoSuchFieldException {
        assertThat(PickupUpdate.class.isAnnotationPresent(Entity.class)).isTrue();
        Field rrField = PickupUpdate.class.getDeclaredField("returnRequest");
        assertThat(rrField.isAnnotationPresent(ManyToOne.class)).isTrue();
        Field driverField = PickupUpdate.class.getDeclaredField("driver");
        assertThat(driverField.isAnnotationPresent(ManyToOne.class)).isTrue();
    }

    @Test
    void warehouseInspectionHasEntityAndFkManyToOne() throws NoSuchFieldException {
        assertThat(WarehouseInspection.class.isAnnotationPresent(Entity.class)).isTrue();
        Field rrField = WarehouseInspection.class.getDeclaredField("returnRequest");
        assertThat(rrField.isAnnotationPresent(ManyToOne.class)).isTrue();
        Field userField = WarehouseInspection.class.getDeclaredField("inspectedByUser");
        assertThat(userField.isAnnotationPresent(ManyToOne.class)).isTrue();
    }

    @Test
    void statusHistoryHasEntityAndFkManyToOne() throws NoSuchFieldException {
        assertThat(StatusHistory.class.isAnnotationPresent(Entity.class)).isTrue();
        Field rrField = StatusHistory.class.getDeclaredField("returnRequest");
        assertThat(rrField.isAnnotationPresent(ManyToOne.class)).isTrue();
        Field userField = StatusHistory.class.getDeclaredField("changedByUser");
        assertThat(userField.isAnnotationPresent(ManyToOne.class)).isTrue();
    }
}
