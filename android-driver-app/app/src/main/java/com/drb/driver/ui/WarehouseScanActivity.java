package com.drb.driver.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.appcompat.app.AppCompatActivity;
import com.drb.driver.R;
import com.drb.driver.api.ApiClient;
import com.drb.driver.model.ReturnRequestModel;
import com.drb.driver.session.SessionManager;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanIntentResult;
import com.journeyapps.barcodescanner.ScanOptions;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class WarehouseScanActivity extends AppCompatActivity {

    private EditText etBarcode;
    private Button btnScan, btnLookup;
    private ProgressBar progressBar;
    private SessionManager sessionManager;

    private final ActivityResultLauncher<ScanOptions> barcodeLauncher =
        registerForActivityResult(new ScanContract(), this::onScanResult);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_warehouse_scan);
        HeaderHelper.setupSubScreen(this, R.string.wh_scan_title);
        sessionManager = new SessionManager(this);

        etBarcode = findViewById(R.id.etBarcode);
        btnScan = findViewById(R.id.btnScan);
        btnLookup = findViewById(R.id.btnLookup);
        progressBar = findViewById(R.id.progressBar);

        btnScan.setOnClickListener(v -> startScanner());
        btnLookup.setOnClickListener(v -> lookup());
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
        lookup();
    }

    private void lookup() {
        String barcode = etBarcode.getText() != null ? etBarcode.getText().toString().trim() : "";
        if (barcode.isEmpty()) {
            Toast.makeText(this, "Barcode cannot be empty", Toast.LENGTH_SHORT).show();
            return;
        }

        btnScan.setEnabled(false);
        btnLookup.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);
        ApiClient.get(sessionManager).warehouseReturnByBarcode(barcode).enqueue(new Callback<ReturnRequestModel>() {
            @Override
            public void onResponse(Call<ReturnRequestModel> call, Response<ReturnRequestModel> response) {
                progressBar.setVisibility(View.GONE);
                btnScan.setEnabled(true);
                btnLookup.setEnabled(true);
                if (response.isSuccessful() && response.body() != null) {
                    ReturnRequestModel r = response.body();
                    Intent intent = new Intent(WarehouseScanActivity.this, WarehouseReturnDetailsActivity.class);
                    intent.putExtra(WarehouseReturnDetailsActivity.EXTRA_BARCODE, r.barcode != null ? r.barcode : barcode);
                    intent.putExtra(WarehouseReturnDetailsActivity.EXTRA_RETURN_ID, r.id != null ? r.id : -1L);
                    startActivity(intent);
                    finish();
                } else if (response.code() == 404) {
                    Toast.makeText(WarehouseScanActivity.this, "No return found for this barcode", Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(WarehouseScanActivity.this, "Lookup failed (" + response.code() + ")", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<ReturnRequestModel> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnScan.setEnabled(true);
                btnLookup.setEnabled(true);
                Toast.makeText(WarehouseScanActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
}
