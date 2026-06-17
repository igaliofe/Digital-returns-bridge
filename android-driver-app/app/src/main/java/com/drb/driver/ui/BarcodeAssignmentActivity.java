package com.drb.driver.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.appcompat.app.AppCompatActivity;
import com.drb.driver.R;
import com.drb.driver.api.ApiClient;
import com.drb.driver.model.AssignBarcodeRequest;
import com.drb.driver.model.ReturnRequestModel;
import com.drb.driver.session.SessionManager;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanIntentResult;
import com.journeyapps.barcodescanner.ScanOptions;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BarcodeAssignmentActivity extends AppCompatActivity {

    public static final String EXTRA_RETURN_ID = "return_id";
    public static final String RESULT_RETURN_JSON = "updated_return";

    private EditText etBarcode;
    private Button btnAssign, btnScan;
    private Long returnId;
    private SessionManager sessionManager;

    private final ActivityResultLauncher<ScanOptions> barcodeLauncher =
        registerForActivityResult(new ScanContract(), this::onScanResult);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_barcode_assignment);
        HeaderHelper.setupSubScreen(this, R.string.assign_barcode_title);
        sessionManager = new SessionManager(this);
        returnId = getIntent().getLongExtra(EXTRA_RETURN_ID, -1L);

        etBarcode = findViewById(R.id.etBarcode);
        btnAssign = findViewById(R.id.btnAssign);
        btnScan   = findViewById(R.id.btnScan);

        btnAssign.setOnClickListener(v -> assignBarcode());
        btnScan.setOnClickListener(v -> startScanner());
    }

    private void startScanner() {
        ScanOptions options = new ScanOptions()
            .setPrompt("Scan the barcode sticker on the item")
            .setBeepEnabled(true)
            .setOrientationLocked(false)
            .setBarcodeImageEnabled(false);
        barcodeLauncher.launch(options);
    }

    private void onScanResult(ScanIntentResult result) {
        if (result.getContents() == null) {
            Toast.makeText(this, "Scan cancelled", Toast.LENGTH_SHORT).show();
            return;
        }
        etBarcode.setText(result.getContents());
        assignBarcode();
    }

    private void assignBarcode() {
        String barcode = etBarcode.getText() != null ? etBarcode.getText().toString().trim() : "";
        if (barcode.isEmpty()) {
            Toast.makeText(this, "Barcode cannot be empty", Toast.LENGTH_SHORT).show();
            return;
        }

        btnAssign.setEnabled(false);
        btnScan.setEnabled(false);
        DriverIdResolver.resolve(this, sessionManager, new DriverIdResolver.DriverIdCallback() {
            @Override
            public void onResolved(Long driverId) {
                submitAssignBarcode(barcode, driverId);
            }

            @Override
            public void onFailure(String message) {
                btnAssign.setEnabled(true);
                btnScan.setEnabled(true);
                DriverIdResolver.toastFailure(BarcodeAssignmentActivity.this, message);
            }
        });
    }

    private void submitAssignBarcode(String barcode, Long driverId) {
        AssignBarcodeRequest request = new AssignBarcodeRequest(barcode, driverId);

        ApiClient.get(sessionManager).assignBarcode(returnId, request).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                btnAssign.setEnabled(true);
                btnScan.setEnabled(true);
                if (response.isSuccessful() && response.body() != null) {
                    Toast.makeText(BarcodeAssignmentActivity.this, "Barcode assigned successfully!", Toast.LENGTH_SHORT).show();
                    Intent result = new Intent();
                    result.putExtra(RESULT_RETURN_JSON, response.body().barcode);
                    setResult(RESULT_OK, result);
                    finish();
                } else {
                    handleError(response);
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                btnAssign.setEnabled(true);
                btnScan.setEnabled(true);
                Toast.makeText(BarcodeAssignmentActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    private void handleError(Response<?> response) {
        int code = response.code();
        String msg;
        switch (code) {
            case 400: msg = "Barcode cannot be empty"; break;
            case 404: msg = "Return or driver not found"; break;
            case 409: msg = "Barcode already used by another return"; break;
            default:  msg = "Error " + code; break;
        }
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }
}
