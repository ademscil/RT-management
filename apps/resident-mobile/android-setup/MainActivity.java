package id.simrt.warga;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // DEFENSE-IN-DEPTH SECURITY AUDIT: Android FLAG_SECURE
        // Prevents screenshots, screen recordings, and recent-app previews
        // of sensitive PII (KTP, KK, and 8-digit Offline Recovery Codes).
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}
