package ai.opencode.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        View decorView = getWindow().getDecorView();
        decorView.setOnApplyWindowInsetsListener((v, insets) -> {
            WindowInsetsCompat compat = WindowInsetsCompat.toWindowInsetsCompat(insets, v);
            int statusBarHeight = compat.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int navBarHeight = compat.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(
                    "document.documentElement.style.setProperty('--sat','" + statusBarHeight + "px');" +
                    "document.documentElement.style.setProperty('--sab','" + navBarHeight + "px');",
                    null
                ));
            }

            return insets;
        });
    }
}
