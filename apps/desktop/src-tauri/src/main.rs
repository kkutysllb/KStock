mod sidecar;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![sidecar::sidecar_status])
    .run(tauri::generate_context!())
    .expect("failed to run tauri application");
}
