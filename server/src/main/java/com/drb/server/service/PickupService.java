package com.drb.server.service;

import com.drb.server.domain.Driver;
import com.drb.server.domain.PickupUpdate;
import com.drb.server.domain.ReturnRequest;
import com.drb.server.domain.enums.ReturnStatus;
import com.drb.server.repository.DriverRepository;
import com.drb.server.repository.PickupUpdateRepository;
import com.drb.server.service.exception.IllegalStatusTransitionException;
import com.drb.server.service.exception.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.logging.Logger;

@ApplicationScoped
public class PickupService {

    private static final Logger LOG = Logger.getLogger(PickupService.class.getName());

    @Inject private ReturnRequestService returnService;
    @Inject private PickupUpdateRepository pickupUpdateRepo;
    @Inject private DriverRepository driverRepo;

    @Transactional
    public PickupUpdate addPickupUpdate(Long returnId, PickupUpdate update) {
        ReturnRequest rr = returnService.getById(returnId);
        update.setReturnRequest(rr);
        return pickupUpdateRepo.save(update);
    }

    public List<PickupUpdate> findByReturnRequestId(Long returnId) {
        return pickupUpdateRepo.findByReturnRequestId(returnId);
    }

    @Transactional
    public PickupUpdate updatePickupUpdate(Long pickupUpdateId, PickupUpdate updates) {
        PickupUpdate existing = pickupUpdateRepo.findById(pickupUpdateId)
            .orElseThrow(() -> new NotFoundException("PickupUpdate", pickupUpdateId));
        if (updates.getItemCondition() != null) existing.setItemCondition(updates.getItemCondition());
        if (updates.getDefectType() != null) existing.setDefectType(updates.getDefectType());
        if (updates.getDefectLocation() != null) existing.setDefectLocation(updates.getDefectLocation());
        if (updates.getDefectLocationOther() != null) existing.setDefectLocationOther(updates.getDefectLocationOther());
        if (updates.getDriverNotes() != null) existing.setDriverNotes(updates.getDriverNotes());
        existing.setItemCollected(updates.isItemCollected());
        return pickupUpdateRepo.update(existing);
    }

    @Transactional
    public ReturnRequest confirmPickup(Long returnId, Long driverId, PickupUpdate confirmationData) {
        LOG.info("Confirming pickup for return " + returnId);
        ReturnRequest rr = returnService.getById(returnId);

        if (rr.getStatus() != ReturnStatus.BARCODE_ASSIGNED) {
            throw new IllegalStatusTransitionException(rr.getStatus(), ReturnStatus.PICKED_UP);
        }

        Driver driver = driverRepo.findById(driverId)
            .orElseThrow(() -> new NotFoundException("Driver", driverId));

        confirmationData.setReturnRequest(rr);
        confirmationData.setDriver(driver);
        pickupUpdateRepo.save(confirmationData);

        return returnService.transitionStatus(returnId, ReturnStatus.PICKED_UP, null,
            "Pickup confirmed by driver " + driverId);
    }
}
