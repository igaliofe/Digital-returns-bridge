package com.drb.server.rest;

import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.rest.dto.AssignBarcodeRequest;
import com.drb.server.rest.dto.ReturnRequestDto;
import com.drb.server.service.ImageService;
import com.drb.server.service.ReturnRequestService;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReturnResourceTest {

    @Mock
    private ReturnRequestService returnRequestService;

    @Mock
    private ImageService imageService;

    @InjectMocks
    private ReturnResource returnResource;

    private ReturnRequest buildReturnRequest(Long id, String barcode) {
        ReturnRequest rr = new ReturnRequest();
        rr.setId(id);
        rr.setBarcode(barcode);
        rr.setStatus(ReturnStatus.BARCODE_ASSIGNED);
        return rr;
    }

    @Test
    void assignBarcode_happyPath_returns200WithDto() {
        ReturnRequest rr = buildReturnRequest(1L, "BC-001");
        when(returnRequestService.assignBarcode(1L, "BC-001", 2L)).thenReturn(rr);

        AssignBarcodeRequest req = new AssignBarcodeRequest();
        req.barcode = "BC-001";
        req.driverId = 2L;

        ContainerRequestContext ctx = mock(ContainerRequestContext.class);
        Response response = returnResource.assignBarcode(1L, req, ctx);

        assertThat(response.getStatus()).isEqualTo(200);
        ReturnRequestDto dto = (ReturnRequestDto) response.getEntity();
        assertThat(dto.barcode).isEqualTo("BC-001");
        assertThat(dto.id).isEqualTo(1L);
    }

    @Test
    void assignBarcode_blankBarcode_returns400() {
        when(returnRequestService.assignBarcode(1L, "", 2L))
            .thenThrow(new ValidationException("BARCODE_BLANK", "Barcode cannot be blank"));

        AssignBarcodeRequest req = new AssignBarcodeRequest();
        req.barcode = "";
        req.driverId = 2L;

        ContainerRequestContext ctx = mock(ContainerRequestContext.class);
        Response response = returnResource.assignBarcode(1L, req, ctx);

        assertThat(response.getStatus()).isEqualTo(400);
    }

    @Test
    void assignBarcode_alreadyAssigned_returns409() {
        when(returnRequestService.assignBarcode(1L, "BC-USED", 2L))
            .thenThrow(new ValidationException("BARCODE_ALREADY_ASSIGNED", "Barcode is already assigned"));

        AssignBarcodeRequest req = new AssignBarcodeRequest();
        req.barcode = "BC-USED";
        req.driverId = 2L;

        ContainerRequestContext ctx = mock(ContainerRequestContext.class);
        Response response = returnResource.assignBarcode(1L, req, ctx);

        assertThat(response.getStatus()).isEqualTo(409);
    }

    @Test
    void getByBarcode_found_returns200WithDto() {
        ReturnRequest rr = buildReturnRequest(5L, "FOUND-001");
        when(returnRequestService.findByBarcode("FOUND-001")).thenReturn(rr);

        Response response = returnResource.getByBarcode("FOUND-001");

        assertThat(response.getStatus()).isEqualTo(200);
        ReturnRequestDto dto = (ReturnRequestDto) response.getEntity();
        assertThat(dto.barcode).isEqualTo("FOUND-001");
        assertThat(dto.id).isEqualTo(5L);
    }

    @Test
    void getByBarcode_notFound_returns404() {
        when(returnRequestService.findByBarcode("UNKNOWN"))
            .thenThrow(new NotFoundException("Return request not found for barcode: UNKNOWN"));

        Response response = returnResource.getByBarcode("UNKNOWN");

        assertThat(response.getStatus()).isEqualTo(404);
    }
}
