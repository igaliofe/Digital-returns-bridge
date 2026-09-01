package com.drb.server.service;

import com.drb.server.domain.Customer;
import com.drb.server.domain.CustomerPurchase;
import com.drb.server.domain.Product;
import com.drb.server.repository.CustomerPurchaseRepository;
import com.drb.server.repository.CustomerRepository;
import com.drb.server.repository.ProductRepository;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CustomerPurchaseServiceTest {

    @Mock private CustomerPurchaseRepository purchaseRepo;
    @Mock private CustomerRepository customerRepo;
    @Mock private ProductRepository productRepo;
    @InjectMocks private CustomerPurchaseService service;

    private Customer customer;
    private Product product;

    @BeforeEach
    void setUp() {
        customer = new Customer();
        customer.setId(7L);
        customer.setFullName("Dana Levi");

        product = new Product();
        product.setId(42L);
        product.setName("Sofa 3-seat");
    }

    /** The whole point of the feature: a customer with no history gets a returnable purchase. */
    @Test
    void create_linksCustomerToProduct() {
        when(customerRepo.findById(7L)).thenReturn(customer);
        when(productRepo.findById(42L)).thenReturn(product);
        when(purchaseRepo.save(any(CustomerPurchase.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomerPurchase details = new CustomerPurchase();
        details.setOrderNumber("ORD-10482");
        details.setQuantity(3);
        details.setOriginalDeliveryDate(LocalDate.of(2026, 8, 12));
        details.setUnderWarranty(true);

        CustomerPurchase saved = service.create(7L, 42L, details);

        assertThat(saved.getCustomer()).isSameAs(customer);
        assertThat(saved.getProduct()).isSameAs(product);
        assertThat(saved.getOrderNumber()).isEqualTo("ORD-10482");
        assertThat(saved.getQuantity()).isEqualTo(3);
        assertThat(saved.getOriginalDeliveryDate()).isEqualTo(LocalDate.of(2026, 8, 12));
        assertThat(saved.getUnderWarranty()).isTrue();
        verify(purchaseRepo).save(any(CustomerPurchase.class));
    }

    /** A brand-new purchase must be selectable in wizard step 2, which reads this flag. */
    @Test
    void create_alwaysStartsUnhandled() {
        when(customerRepo.findById(7L)).thenReturn(customer);
        when(productRepo.findById(42L)).thenReturn(product);
        when(purchaseRepo.save(any(CustomerPurchase.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomerPurchase details = new CustomerPurchase();
        details.setHandled(true);

        assertThat(service.create(7L, 42L, details).isHandled()).isFalse();
    }

    @Test
    void create_appliesDefaultsForOmittedFields() {
        when(customerRepo.findById(7L)).thenReturn(customer);
        when(productRepo.findById(42L)).thenReturn(product);
        when(purchaseRepo.save(any(CustomerPurchase.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomerPurchase saved = service.create(7L, 42L, new CustomerPurchase());

        assertThat(saved.getQuantity()).isEqualTo(1);
        assertThat(saved.getUnderWarranty()).isFalse();
        assertThat(saved.getOrderNumber()).isNull();
        assertThat(saved.getOriginalDeliveryDate()).isNull();
    }

    /** A blank text field must not become a blank order number the wizard later copies onto a return. */
    @Test
    void create_blankOrderNumberBecomesNull() {
        when(customerRepo.findById(7L)).thenReturn(customer);
        when(productRepo.findById(42L)).thenReturn(product);
        when(purchaseRepo.save(any(CustomerPurchase.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomerPurchase details = new CustomerPurchase();
        details.setOrderNumber("   ");

        assertThat(service.create(7L, 42L, details).getOrderNumber()).isNull();
    }

    @Test
    void create_trimsOrderNumber() {
        when(customerRepo.findById(7L)).thenReturn(customer);
        when(productRepo.findById(42L)).thenReturn(product);
        when(purchaseRepo.save(any(CustomerPurchase.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomerPurchase details = new CustomerPurchase();
        details.setOrderNumber("  ORD-1  ");

        assertThat(service.create(7L, 42L, details).getOrderNumber()).isEqualTo("ORD-1");
    }

    @Test
    void create_nullCustomerId_rejected() {
        assertThatThrownBy(() -> service.create(null, 42L, new CustomerPurchase()))
            .isInstanceOf(ValidationException.class)
            .hasFieldOrPropertyWithValue("code", "CUSTOMER_REQUIRED");
        verifyNoInteractions(purchaseRepo);
    }

    @Test
    void create_nullProductId_rejected() {
        assertThatThrownBy(() -> service.create(7L, null, new CustomerPurchase()))
            .isInstanceOf(ValidationException.class)
            .hasFieldOrPropertyWithValue("code", "PRODUCT_REQUIRED");
        verifyNoInteractions(purchaseRepo);
    }

    @Test
    void create_unknownCustomer_rejected() {
        when(customerRepo.findById(99L)).thenReturn(null);

        assertThatThrownBy(() -> service.create(99L, 42L, new CustomerPurchase()))
            .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(purchaseRepo);
    }

    @Test
    void create_unknownProduct_rejected() {
        when(customerRepo.findById(7L)).thenReturn(customer);
        when(productRepo.findById(99L)).thenReturn(null);

        assertThatThrownBy(() -> service.create(7L, 99L, new CustomerPurchase()))
            .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(purchaseRepo);
    }

    @Test
    void create_zeroQuantity_rejected() {
        when(customerRepo.findById(7L)).thenReturn(customer);
        when(productRepo.findById(42L)).thenReturn(product);

        CustomerPurchase details = new CustomerPurchase();
        details.setQuantity(0);

        assertThatThrownBy(() -> service.create(7L, 42L, details))
            .isInstanceOf(ValidationException.class)
            .hasFieldOrPropertyWithValue("code", "QUANTITY_INVALID");
        verifyNoInteractions(purchaseRepo);
    }

    /** You cannot have taken delivery of something that has not been delivered yet. */
    @Test
    void create_futureDeliveryDate_rejected() {
        when(customerRepo.findById(7L)).thenReturn(customer);
        when(productRepo.findById(42L)).thenReturn(product);

        CustomerPurchase details = new CustomerPurchase();
        details.setOriginalDeliveryDate(LocalDate.now().plusDays(1));

        assertThatThrownBy(() -> service.create(7L, 42L, details))
            .isInstanceOf(ValidationException.class)
            .hasFieldOrPropertyWithValue("code", "DELIVERY_DATE_FUTURE");
        verifyNoInteractions(purchaseRepo);
    }

    @Test
    void create_todayDeliveryDate_accepted() {
        when(customerRepo.findById(7L)).thenReturn(customer);
        when(productRepo.findById(42L)).thenReturn(product);
        when(purchaseRepo.save(any(CustomerPurchase.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomerPurchase details = new CustomerPurchase();
        details.setOriginalDeliveryDate(LocalDate.now());

        assertThat(service.create(7L, 42L, details).getOriginalDeliveryDate())
            .isEqualTo(LocalDate.now());
    }

    @Test
    void findByCustomerId_delegatesToRepository() {
        CustomerPurchase purchase = new CustomerPurchase();
        when(purchaseRepo.findByCustomerId(7L)).thenReturn(List.of(purchase));

        assertThat(service.findByCustomerId(7L)).containsExactly(purchase);
    }

    @Test
    void findAll_delegatesToRepository() {
        CustomerPurchase purchase = new CustomerPurchase();
        when(purchaseRepo.findAll()).thenReturn(List.of(purchase));

        assertThat(service.findAll()).containsExactly(purchase);
    }
}
