package com.drb.server.service;

import com.drb.server.domain.PickupUpdate;
import com.drb.server.domain.User;
import com.drb.server.domain.enums.DefectLocation;
import com.drb.server.domain.enums.DefectType;
import com.drb.server.domain.enums.ItemCondition;
import com.drb.server.repository.PickupUpdateRepository;
import com.drb.server.rest.dto.PickupConfirmationRequest;
import com.drb.server.service.exception.NotFoundException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

@ApplicationScoped
public class PickupUpdateService {

    @Inject
    private PickupUpdateRepository pickupUpdateRepo;

    public PickupUpdate findById(Long id) {
        return pickupUpdateRepo.findById(id)
            .orElseThrow(() -> new NotFoundException("PickupUpdate", id));
    }

    @Transactional
    public PickupUpdate update(Long id, PickupConfirmationRequest req, User user) {
        PickupUpdate existing = findById(id);
        if (req.itemCondition != null && !req.itemCondition.isBlank()) {
            existing.setItemCondition(ItemCondition.valueOf(req.itemCondition));
        }
        if (req.defectType != null && !req.defectType.isBlank()) {
            existing.setDefectType(DefectType.valueOf(req.defectType));
        }
        if (req.defectLocation != null && !req.defectLocation.isBlank()) {
            existing.setDefectLocation(DefectLocation.valueOf(req.defectLocation));
        }
        if (req.defectLocationOther != null) {
            existing.setDefectLocationOther(req.defectLocationOther);
        }
        if (req.driverNotes != null) {
            existing.setDriverNotes(req.driverNotes);
        }
        existing.setItemCollected(req.itemCollected);
        return pickupUpdateRepo.update(existing);
    }
}
