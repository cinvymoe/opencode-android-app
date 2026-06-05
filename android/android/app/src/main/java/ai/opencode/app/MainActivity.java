package ai.opencode.app;

import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        View rootView = findViewById(android.R.id.content);
        rootView.setOnApplyWindowInsetsListener((v, insets) -> {
            int top = insets.getInsets(WindowInsets.Type.statusBars()).top;
            int bottom = insets.getInsets(WindowInsets.Type.navigationBars()).bottom;
            int left = insets.getInsets(WindowInsets.Type.systemBars()).left;
            int right = insets.getInsets(WindowInsets.Type.systemBars()).right;
            v.setPadding(left, top, right, bottom);
            return insets;
        });
    }
}
