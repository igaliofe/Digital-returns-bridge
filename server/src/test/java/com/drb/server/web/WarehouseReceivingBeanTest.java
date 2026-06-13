package com.drb.server.web;

import com.drb.server.domain.ReturnRequest;
import com.drb.server.repository.PickupUpdateRepository;
import com.drb.server.repository.ReturnImageRepository;
import com.drb.server.service.WarehouseService;
import com.drb.server.service.exception.NotFoundException;
import jakarta.faces.application.FacesMessage;
import jakarta.faces.context.FacesContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WarehouseReceivingBeanTest {

    @Mock
    private WarehouseService warehouseService;

    @Mock
    private PickupUpdateRepository pickupUpdateRepository;

    @Mock
    private ReturnImageRepository returnImageRepository;

    @InjectMocks
    private WarehouseReceivingBean bean;

    @Test
    void searchByBarcode_found_setsFoundReturn() {
        ReturnRequest rr = new ReturnRequest();
        rr.setBarcode("BAR001");

        when(warehouseService.findByBarcode("BAR001")).thenReturn(rr);

        bean.setBarcodeInput("BAR001");
        bean.searchByBarcode();

        assertThat(bean.getFoundReturn()).isSameAs(rr);
        assertThat(bean.getBarcodeNotFoundError()).isNull();
    }

    @Test
    void searchByBarcode_unknownBarcode_setsBarcodeNotFoundError() {
        when(warehouseService.findByBarcode("UNKNOWN")).thenThrow(new NotFoundException("not found"));

        FacesContext fc = mock(FacesContext.class);
        bean.facesContextSupplier = () -> fc;

        bean.setBarcodeInput("UNKNOWN");
        bean.searchByBarcode();

        assertThat(bean.getFoundReturn()).isNull();
        assertThat(bean.getBarcodeNotFoundError()).contains("UNKNOWN");
        verify(fc).addMessage(eq(null), any(FacesMessage.class));
    }
}
