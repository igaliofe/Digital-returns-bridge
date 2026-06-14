package com.drb.server.service;

import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.User;
import com.drb.server.domain.WarehouseInspection;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.repository.ReturnRequestRepository;
import com.drb.server.repository.WarehouseInspectionRepository;
import com.drb.server.service.exception.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class WarehouseService {

    @Inject
    private ReturnRequestRepository returnRepo;

    @Inject
    private WarehouseInspectionRepository inspectionRepo;

    @Inject
    private ReturnRequestService returnRequestService;

    public ReturnRequest findByBarcode(String barcode) {
        return returnRepo.findByBarcodeWithRefs(barcode)
            .orElseThrow(() -> new NotFoundException("ReturnRequest", "barcode=" + barcode));
    }

    @Transactional
    public ReturnRequest markArrived(String barcode, User user) {
        ReturnRequest rr = findByBarcode(barcode);
        return returnRequestService.transitionStatus(
            rr.getId(), ReturnStatus.ARRIVED_TO_WAREHOUSE, user, "Arrived at warehouse");
    }

    @Transactional
    public ReturnRequest requestMoreInfo(Long returnId, String comment) {
        return returnRequestService.transitionStatus(
            returnId, ReturnStatus.NEEDS_MORE_INFO, null,
            comment != null ? comment : "Warehouse requested more information");
    }

    @Transactional
    public WarehouseInspection createInspection(Long returnId, WarehouseInspection inspection) {
        ReturnRequest rr = returnRequestService.findById(returnId);
        inspection.setReturnRequest(rr);
        WarehouseInspection saved = inspectionRepo.save(inspection);
        returnRequestService.transitionStatus(returnId, ReturnStatus.INSPECTED, null, "Warehouse inspection completed");
        return saved;
    }
}
