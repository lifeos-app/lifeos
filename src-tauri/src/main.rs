// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Fix WebKitGTK GPU crashes on NVIDIA Tegra/Jetson.
    // Must be set before any GTK/WebKit library initialization.
    // WEBKIT_DISABLE_DMABUF_RENDERER: prevents DMA-BUF buffer sharing crash
    // LIBGL_ALWAYS_SOFTWARE: forces Mesa llvmpipe, bypasses buggy NVIDIA GL driver
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1"); }
        }
        if std::env::var("LIBGL_ALWAYS_SOFTWARE").is_err() {
            unsafe { std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1"); }
        }
    }

    app_lib::run();
}
