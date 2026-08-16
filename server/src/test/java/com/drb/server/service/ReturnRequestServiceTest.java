package com.drb.server.service;

import com.drb.server.domain.Driver;
import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.StatusHistory;
import com.drb.server.domain.User;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.domain.enums.Role;
import com.drb.server.repository.DriverRepository;
import com.drb.server.repository.ReturnRequestRepository;
import com.drb.server.repository.StatusHistoryRepository;
import com.drb.server.service.exception.IllegalStatusTransitionException;
import com.drb.server.service.exception.NotFoundException;
import com.drb.server.service.exception.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReturnRequestServiceTest {

    @Mock private ReturnRequestRepository returnRepo;
    @Mock private DriverRepository driverRepo;
    @Mock private StatusHistoryRepository statusHistoryRepo;
    @InjectMocks private ReturnRequestService service;

    private Driver driver;
    private User driverUser;

    @BeforeEach
    void setUp() {
        driverUser = new User();
        driverUser.setId(10L);
        driverUser.setPhoneNumber("0501111111");
        driverUser.setRole(Role.DRIVER);

        driver = new Driver();
        driver.setId(2L);
        driver.setUser(driverUser);
    }

    private ReturnRequest returnWithStatus(Long id, ReturnStatus status) {
        ReturnRequest rr = new ReturnRequest();
        rr.setId(id);
        rr.setStatus(status);
        return rr;
    }

    @Test
    void createReturnRequestSetsStatusOpenAndNullBarcode() {
        ReturnRequest input = new ReturnRequest();
        input.setOrderNumber("ORD-001");
        input.setBarcode("should-be-cleared");
        when(returnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ReturnRequest result = service.createReturnRequest(input);

        assertThat(result.getStatus()).isEqualTo(ReturnStatus.OPEN);
        assertThat(result.getBarcode()).isNull();
        assertThat(result.getBarcodeAssignedAt()).isNull();
        assertThat(result.getBarcodeAssignedByDriver()).isNull();
    }

    @Test
    void assignBarcodeHappyPath() throws Exception {
        ReturnRequest rr = returnWithStatus(1L, ReturnStatus.WAITING_FOR_PICKUP);
        when(returnRepo.findByIdForUpdate(1L)).thenReturn(Optional.of(rr));
        when(driverRepo.findById(2L)).thenReturn(Optional.of(driver));
        when(returnRepo.findByBarcode("BC001")).thenReturn(Optional.empty());
        when(returnRepo.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(statusHistoryRepo.save(any(StatusHistory.class))).thenAnswer(inv -> inv.getArgument(0));

        ReturnRequest result = service.assignBarcode(1L, "BC001", 2L);

        assertThat(result.getBarcode()).isEqualTo("BC001");
        assertThat(result.getStatus()).isEqualTo(ReturnStatus.BARCODE_ASSIGNED);
        assertThat(result.getBarcodeAssignedByDriver()).isEqualTo(driver);
        assertThat(result.getBarcodeAssignedAt()).isNotNull();
    }

    @Test
    void assignBarcodeBlankBarcodeThrowsValidationExceptionWithBarcodeBankCode() {
        ReturnRequest rr = returnWithStatus(1L, ReturnStatus.WAITING_FOR_PICKUP);
        when(returnRepo.findByIdForUpdate(1L)).thenReturn(Optional.of(rr));

        assertThatThrownBy(() -> service.assignBarcode(1L, "   ", 2L))
            .isInstanceOf(ValidationException.class)
            .satisfies(e -> assertThat(((ValidationException) e).getCode()).isEqualTo("BARCODE_BLANK"));
    }

    @Test
    void assignBarcodeDuplicateBarcodeThrowsValidationExceptionWithBarcodeAlreadyAssigned() {
        ReturnRequest rr = returnWithStatus(1L, ReturnStatus.WAITING_FOR_PICKUP);
        ReturnRequest other = returnWithStatus(99L, ReturnStatus.WAITING_FOR_PICKUP);
        when(returnRepo.findByIdForUpdate(1L)).thenReturn(Optional.of(rr));
        when(driverRepo.findById(2L)).thenReturn(Optional.of(driver));
        when(returnRepo.findByBarcode("DUP")).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.assignBarcode(1L, "DUP", 2L))
            .isInstanceOf(ValidationException.class)
            .satisfies(e -> assertThat(((ValidationException) e).getCode()).isEqualTo("BARCODE_ALREADY_ASSIGNED"));
    }

    @Test
    void assignBarcodeMissingDriverThrowsNotFoundException() {
        ReturnRequest rr = returnWithStatus(1L, ReturnStatus.WAITING_FOR_PICKUP);
        when(returnRepo.findByIdForUpdate(1L)).thenReturn(Optional.of(rr));
        when(driverRepo.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assignBarcode(1L, "BC001", 99L))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void assignBarcodeMissingReturnThrowsNotFoundException() {
        when(returnRepo.findByIdForUpdate(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assignBarcode(999L, "BC001", 2L))
            .isInstanceOf(NotFoundException.class);
    }

    static Stream<Arguments> legalTransitions() {
        return Stream.of(
            Arguments.of(ReturnStatus.OPEN,                 ReturnStatus.WAITING_FOR_PICKUP),
            Arguments.of(ReturnStatus.OPEN,                 ReturnStatus.NEEDS_MORE_INFO),
            Arguments.of(ReturnStatus.WAITING_FOR_PICKUP,   ReturnStatus.BARCODE_ASSIGNED),
            Arguments.of(ReturnStatus.BARCODE_ASSIGNED,     ReturnStatus.PICKED_UP),
            Arguments.of(ReturnStatus.PICKED_UP,            ReturnStatus.ARRIVED_TO_WAREHOUSE),
            Arguments.of(ReturnStatus.ARRIVED_TO_WAREHOUSE, ReturnStatus.INSPECTED),
            Arguments.of(ReturnStatus.INSPECTED,            ReturnStatus.CLOSED)
        );
    }

    @ParameterizedTest
    @MethodSource("legalTransitions")
    void legalStatusTransitionSucceeds(ReturnStatus from, ReturnStatus to) {
        ReturnRequest rr = returnWithStatus(1L, from);
        when(returnRepo.findByIdForUpdate(1L)).thenReturn(Optional.of(rr));
        when(returnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(statusHistoryRepo.save(any(StatusHistory.class))).thenAnswer(inv -> inv.getArgument(0));

        ReturnRequest result = service.transitionStatus(1L, to, null, "test");

        assertThat(result.getStatus()).isEqualTo(to);
    }

    static Stream<Arguments> illegalTransitions() {
        return Stream.of(
            Arguments.of(ReturnStatus.OPEN,                 ReturnStatus.CLOSED),
            Arguments.of(ReturnStatus.OPEN,                 ReturnStatus.PICKED_UP),
            Arguments.of(ReturnStatus.OPEN,                 ReturnStatus.ARRIVED_TO_WAREHOUSE),
            Arguments.of(ReturnStatus.WAITING_FOR_PICKUP,   ReturnStatus.OPEN),
            Arguments.of(ReturnStatus.WAITING_FOR_PICKUP,   ReturnStatus.CLOSED),
            Arguments.of(ReturnStatus.CLOSED,               ReturnStatus.OPEN),
            Arguments.of(ReturnStatus.CLOSED,               ReturnStatus.WAITING_FOR_PICKUP)
        );
    }

    @ParameterizedTest
    @MethodSource("illegalTransitions")
    void illegalStatusTransitionThrowsException(ReturnStatus from, ReturnStatus to) {
        ReturnRequest rr = returnWithStatus(1L, from);
        when(returnRepo.findByIdForUpdate(1L)).thenReturn(Optional.of(rr));

        assertThatThrownBy(() -> service.transitionStatus(1L, to, null, "test"))
            .isInstanceOf(IllegalStatusTransitionException.class)
            .satisfies(e -> {
                IllegalStatusTransitionException ex = (IllegalStatusTransitionException) e;
                assertThat(ex.getFrom()).isEqualTo(from);
                assertThat(ex.getTo()).isEqualTo(to);
            });
    }

    @Test
    void confirmPickupRejectedWhenStatusIsNotBarcodeAssigned() {
        // BARCODE_ASSIGNED is required before PICKED_UP;
        // attempting OPEN -> PICKED_UP must be rejected
        ReturnRequest rr = returnWithStatus(1L, ReturnStatus.OPEN);
        when(returnRepo.findByIdForUpdate(1L)).thenReturn(Optional.of(rr));

        assertThatThrownBy(() -> service.transitionStatus(1L, ReturnStatus.PICKED_UP, null, "test"))
            .isInstanceOf(IllegalStatusTransitionException.class);
    }
}
