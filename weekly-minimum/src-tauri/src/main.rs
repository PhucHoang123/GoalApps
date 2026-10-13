#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::io::Write;
use tauri::Manager;
fn path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    #[cfg(debug_assertions)]
    let dir = std::env::var_os("WEEKLY_MINIMUM_TEST_DATA_DIR").map(std::path::PathBuf::from).unwrap_or(dir);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("weekly-minimum.json"))
}
#[tauri::command]
fn load_data(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let p = path(&app)?;
    if !p.exists() {
        return Ok(None);
    }
    let s = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    if serde_json::from_str::<serde_json::Value>(&s).is_ok() {
        return Ok(Some(s));
    }
    let backup = std::fs::read_to_string(p.with_extension("backup.json"))
        .map_err(|_| "Data is damaged. Restore a JSON backup before continuing.".to_string())?;
    serde_json::from_str::<serde_json::Value>(&backup).map_err(|e| e.to_string())?;
    Ok(Some(backup))
}
#[tauri::command]
fn save_data(app: tauri::AppHandle, data: String) -> Result<(), String> {
    save_at(&path(&app)?, &data)
}
fn save_at(p: &std::path::Path, data: &str) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&data).map_err(|e| e.to_string())?;
    if p.exists() {
        let previous = std::fs::read_to_string(p).map_err(|e| e.to_string())?;
        if serde_json::from_str::<serde_json::Value>(&previous).is_ok() {
            atomicwrites::AtomicFile::new(
                p.with_extension("backup.json"),
                atomicwrites::AllowOverwrite,
            )
            .write(|f| {
                f.write_all(previous.as_bytes())?;
                f.sync_all()
            })
            .map_err(|e| e.to_string())?;
        }
    }
    atomicwrites::AtomicFile::new(&p, atomicwrites::AllowOverwrite)
        .write(|f| {
            f.write_all(data.as_bytes())?;
            f.sync_all()
        })
        .map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn saves_round_trip_and_preserves_backup() {
        let dir = std::env::current_dir().unwrap().join("target").join(format!("weekly-minimum-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("data.json");
        save_at(&p, r#"{"progress":0.5}"#).unwrap();
        save_at(&p, r#"{"progress":28}"#).unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), r#"{"progress":28}"#);
        assert_eq!(
            std::fs::read_to_string(p.with_extension("backup.json")).unwrap(),
            r#"{"progress":0.5}"#
        );
        assert!(save_at(&p, "broken").is_err());
        assert_eq!(std::fs::read_to_string(&p).unwrap(), r#"{"progress":28}"#);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_data, save_data])
        .run(tauri::generate_context!())
        .expect("Unable to start Weekly Minimum");
}
