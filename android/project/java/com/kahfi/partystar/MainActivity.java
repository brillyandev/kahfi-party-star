package com.kahfi.partystar;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * Pembungkus Android untuk Kahfi Party Star.
 *
 * Aset web disajikan oleh server HTTP kecil di 127.0.0.1. Alamat loopback dianggap
 * secure context oleh WebView, jadi mikrofon, penyimpanan login, dan panggilan API
 * tetap bekerja tanpa perlu trik intercept request.
 */
public class MainActivity extends Activity {

    private WebView web;
    private AssetServer server;
    private TextView logView;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        logView = new TextView(this);
        logView.setTextColor(0xFFFF5555);
        logView.setTextSize(11);
        logView.setPadding(24, 120, 24, 24);
        logView.setVisibility(TextView.GONE);

        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                // Tampilkan hanya error supaya masalah di HP bisa dilaporkan.
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    showLog(m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                }
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("OK", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) { result.confirm(); }
                        })
                        .setOnCancelListener(new DialogInterface.OnCancelListener() {
                            public void onCancel(DialogInterface d) { result.cancel(); }
                        })
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("OK", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) { result.confirm(); }
                        })
                        .setNegativeButton("Batal", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) { result.cancel(); }
                        })
                        .setOnCancelListener(new DialogInterface.OnCancelListener() {
                            public void onCancel(DialogInterface d) { result.cancel(); }
                        })
                        .show();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue,
                                      final JsPromptResult result) {
                final android.widget.EditText input = new android.widget.EditText(MainActivity.this);
                input.setText(defaultValue == null ? "" : defaultValue);
                input.setHint("https://server-kamu.com");
                new AlertDialog.Builder(MainActivity.this)
                        .setTitle(message)
                        .setView(input)
                        .setPositiveButton("Simpan", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) { result.confirm(input.getText().toString()); }
                        })
                        .setNegativeButton("Batal", new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface d, int w) { result.cancel(); }
                        })
                        .setOnCancelListener(new DialogInterface.OnCancelListener() {
                            public void onCancel(DialogInterface d) { result.cancel(); }
                        })
                        .show();
                return true;
            }
        });

        root.addView(web, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(logView, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(root);

        if (Build.VERSION.SDK_INT >= 23
                && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 1001);
        }

        try {
            server = new AssetServer();
            new Thread(server).start();
            web.loadUrl("http://127.0.0.1:" + server.getPort() + "/index.html");
        } catch (IOException e) {
            showLog("Gagal menyiapkan aset: " + e.getMessage());
        }
    }

    private void showLog(final String text) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                logView.setVisibility(TextView.VISIBLE);
                logView.setText(text.length() > 400 ? text.substring(0, 400) : text);
            }
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (server != null) server.stop();
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Server statis minimal untuk folder assets/www. */
    private class AssetServer implements Runnable {
        private final ServerSocket socket;

        AssetServer() throws IOException {
            socket = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        }

        int getPort() {
            return socket.getLocalPort();
        }

        void stop() {
            try {
                socket.close();
            } catch (IOException ignored) {
                // diabaikan saat aplikasi ditutup
            }
        }

        @Override
        public void run() {
            while (!socket.isClosed()) {
                try {
                    final Socket client = socket.accept();
                    new Thread(new Runnable() {
                        @Override
                        public void run() {
                            handle(client);
                        }
                    }).start();
                } catch (IOException e) {
                    return;
                }
            }
        }

        private void handle(Socket client) {
            try {
                BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream()));
                String line = reader.readLine();
                if (line == null) {
                    client.close();
                    return;
                }
                String path = line.split(" ")[1];
                int q = path.indexOf('?');
                if (q >= 0) path = path.substring(0, q);
                if (path.equals("/") || path.isEmpty()) path = "/index.html";

                String header;
                while ((header = reader.readLine()) != null && !header.isEmpty()) {
                    // buang header permintaan
                }

                OutputStream out = client.getOutputStream();
                InputStream in;
                try {
                    in = getAssets().open("www" + path);
                } catch (IOException notFound) {
                    String body = "404 " + path;
                    out.write(("HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: "
                            + body.length() + "\r\nConnection: close\r\n\r\n" + body).getBytes("UTF-8"));
                    out.flush();
                    client.close();
                    return;
                }

                // Baca penuh dulu supaya Content-Length pasti benar. Kalau salah,
                // berkas JS terpotong dan aplikasi hanya menampilkan layar putih.
                java.io.ByteArrayOutputStream bufOut = new java.io.ByteArrayOutputStream();
                byte[] chunk = new byte[8192];
                int read;
                while ((read = in.read(chunk)) > 0) bufOut.write(chunk, 0, read);
                byte[] body = bufOut.toByteArray();
                out.write(("HTTP/1.1 200 OK\r\nContent-Type: " + mime(path)
                        + "\r\nContent-Length: " + body.length
                        + "\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n").getBytes("UTF-8"));
                out.write(body);
                out.flush();
                in.close();
                client.close();
            } catch (IOException ignored) {
                // koneksi diputus klien, aman diabaikan
            }
        }

        private String mime(String path) {
            if (path.endsWith(".js")) return "application/javascript";
            if (path.endsWith(".css")) return "text/css";
            if (path.endsWith(".html")) return "text/html";
            if (path.endsWith(".json")) return "application/json";
            if (path.endsWith(".webmanifest")) return "application/manifest+json";
            if (path.endsWith(".png")) return "image/png";
            if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
            if (path.endsWith(".svg")) return "image/svg+xml";
            if (path.endsWith(".webp")) return "image/webp";
            if (path.endsWith(".woff2")) return "font/woff2";
            return "application/octet-stream";
        }
    }
}
