package ai.opencode.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private int lastStatusBarHeightCss = -1;
    private int lastNavBarHeightCss = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        View decorView = getWindow().getDecorView();
        decorView.setOnApplyWindowInsetsListener((v, insets) -> {
            WindowInsetsCompat compat = WindowInsetsCompat.toWindowInsetsCompat(insets, v);
            int statusBarHeight = compat.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int navBarHeight = compat.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;

            float density = getResources().getDisplayMetrics().density;
            lastStatusBarHeightCss = Math.round(statusBarHeight / density);
            lastNavBarHeightCss = Math.round(navBarHeight / density);

            injectSafeAreaInsets();
            return insets;
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        injectSafeAreaInsets();
    }

    private void injectSafeAreaInsets() {
        if (lastStatusBarHeightCss < 0) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        webView.evaluateJavascript(
            "document.documentElement.style.setProperty('--sat','" + lastStatusBarHeightCss + "px');" +
            "document.documentElement.style.setProperty('--sab','" + lastNavBarHeightCss + "px');",
            null
        );
    }
}
