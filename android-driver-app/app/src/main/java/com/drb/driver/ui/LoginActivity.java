package com.drb.driver.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.drb.driver.R;
import com.drb.driver.api.ApiClient;
import com.drb.driver.model.LoginRequest;
import com.drb.driver.model.LoginResponse;
import com.drb.driver.session.SessionManager;
import com.google.android.material.textfield.TextInputEditText;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {

    private TextInputEditText etPhone;
    private Button btnLogin;
    private ProgressBar progressBar;
    private SessionManager sessionManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);
        sessionManager = new SessionManager(this);

        if (sessionManager.isLoggedIn()) {
            startActivity(new Intent(this, PickupListActivity.class));
            finish();
            return;
        }

        etPhone = findViewById(R.id.etPhone);
        btnLogin = findViewById(R.id.btnLogin);
        progressBar = findViewById(R.id.progressBar);

        btnLogin.setOnClickListener(v -> performLogin());
    }

    private void performLogin() {
        String phone = etPhone.getText() != null ? etPhone.getText().toString().trim() : "";
        if (phone.isEmpty()) {
            Toast.makeText(this, "Please enter phone number", Toast.LENGTH_SHORT).show();
            return;
        }
        btnLogin.setEnabled(false);
        progressBar.setVisibility(View.VISIBLE);

        ApiClient.get(sessionManager).login(new LoginRequest(phone)).enqueue(new Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);
                if (response.isSuccessful() && response.body() != null) {
                    LoginResponse body = response.body();
                    sessionManager.saveSession(body.token, body.userId, body.fullName, body.role);
                    startActivity(new Intent(LoginActivity.this, PickupListActivity.class));
                    finish();
                } else {
                    Toast.makeText(LoginActivity.this, "Login failed. Check phone number.", Toast.LENGTH_LONG).show();
                }
            }

            @Override
            public void onFailure(Call<LoginResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnLogin.setEnabled(true);
                Toast.makeText(LoginActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
}
