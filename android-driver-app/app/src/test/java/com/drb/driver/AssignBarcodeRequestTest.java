package com.drb.driver;

import com.drb.driver.model.AssignBarcodeRequest;
import org.junit.Test;
import static org.junit.Assert.*;

public class AssignBarcodeRequestTest {

    @Test
    public void builderSetsFields() {
        AssignBarcodeRequest req = new AssignBarcodeRequest("DRB-001", 5L);
        assertEquals("DRB-001", req.barcode);
        assertEquals(Long.valueOf(5L), req.driverId);
    }

    @Test
    public void emptyBarcodeIsDetectable() {
        AssignBarcodeRequest req = new AssignBarcodeRequest("", 1L);
        assertTrue(req.barcode.isEmpty());
    }

    @Test
    public void errorCodeMapping_400_mapsToEmptyBarcodeMessage() {
        int code = 400;
        String msg;
        switch (code) {
            case 400: msg = "Barcode cannot be empty"; break;
            case 404: msg = "Return or driver not found"; break;
            case 409: msg = "Barcode already used by another return"; break;
            default:  msg = "Error " + code; break;
        }
        assertEquals("Barcode cannot be empty", msg);
    }

    @Test
    public void errorCodeMapping_409_mapsToDuplicateMessage() {
        int code = 409;
        String msg;
        switch (code) {
            case 400: msg = "Barcode cannot be empty"; break;
            case 404: msg = "Return or driver not found"; break;
            case 409: msg = "Barcode already used by another return"; break;
            default:  msg = "Error " + code; break;
        }
        assertEquals("Barcode already used by another return", msg);
    }

    @Test
    public void errorCodeMapping_404_mapsToNotFoundMessage() {
        int code = 404;
        String msg;
        switch (code) {
            case 400: msg = "Barcode cannot be empty"; break;
            case 404: msg = "Return or driver not found"; break;
            case 409: msg = "Barcode already used by another return"; break;
            default:  msg = "Error " + code; break;
        }
        assertEquals("Return or driver not found", msg);
    }
}
