package com.drb.server.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

class SimpleEntityTest {

    @Test
    void userHasEntityAndTableName() {
        assertThat(User.class.isAnnotationPresent(Entity.class)).isTrue();
        Table table = User.class.getAnnotation(Table.class);
        assertThat(table).isNotNull();
        assertThat(table.name()).isEqualTo("users");
    }

    @Test
    void customerHasEntityAndTableName() {
        assertThat(Customer.class.isAnnotationPresent(Entity.class)).isTrue();
        Table table = Customer.class.getAnnotation(Table.class);
        assertThat(table).isNotNull();
        assertThat(table.name()).isEqualTo("customers");
    }

    @Test
    void productHasEntityAndSkuField() throws NoSuchFieldException {
        assertThat(Product.class.isAnnotationPresent(Entity.class)).isTrue();
        Field skuField = Product.class.getDeclaredField("sku");
        assertThat(skuField).isNotNull();
    }

    @Test
    void driverHasEntityAndManyToOneUser() throws NoSuchFieldException {
        assertThat(Driver.class.isAnnotationPresent(Entity.class)).isTrue();
        Field userField = Driver.class.getDeclaredField("user");
        assertThat(userField.isAnnotationPresent(ManyToOne.class)).isTrue();
    }
}
