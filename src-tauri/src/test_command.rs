use tauri::command;

#[command]
pub fn test_droid() -> String {
    "Test successful!".to_string()
}
