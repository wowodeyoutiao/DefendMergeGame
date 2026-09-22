package com.defendmerge.playtest;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String URL = "https://" + HOST + "/assets/index.html";
    private WebView gameView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(68, 121, 110));
        getWindow().setNavigationBarColor(Color.rgb(68, 120, 105));
        gameView = new WebView(this);
        gameView.setBackgroundColor(Color.rgb(198, 222, 214));
        gameView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = gameView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        gameView.setWebViewClient(new LocalGameClient());
        setContentView(gameView);
        gameView.loadUrl(URL);
    }

    private static boolean isLocalAsset(Uri uri) {
        String path = uri.getPath();
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
            && path != null && path.startsWith("/assets/")
            && !path.contains("..") && !path.contains("\\");
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".gif")) return "image/gif";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        if (path.endsWith(".mp3")) return "audio/mpeg";
        if (path.endsWith(".ogg")) return "audio/ogg";
        if (path.endsWith(".wav")) return "audio/wav";
        return "application/octet-stream";
    }

    private final class LocalGameClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isLocalAsset(uri)) {
                String assetPath = uri.getPath().substring("/assets/".length());
                try {
                    return new WebResourceResponse(mimeType(assetPath), "UTF-8", getAssets().open(assetPath));
                } catch (IOException exception) {
                    android.util.Log.e("DefendMerge", "Missing bundled asset: " + assetPath, exception);
                }
            }
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !isLocalAsset(request.getUrl());
        }
    }

    @Override
    protected void onPause() {
        gameView.onPause();
        gameView.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (gameView != null) {
            gameView.onResume();
            gameView.resumeTimers();
        }
    }

    @Override
    public void onBackPressed() {
        new AlertDialog.Builder(this)
            .setTitle("退出试玩？")
            .setMessage("退出后，本次试玩进度会重置。")
            .setNegativeButton("继续游戏", (dialog, button) -> dialog.dismiss())
            .setPositiveButton("退出", (dialog, button) -> finish())
            .show();
    }

    @Override
    protected void onDestroy() {
        if (gameView != null) {
            gameView.stopLoading();
            gameView.destroy();
        }
        super.onDestroy();
    }
}
