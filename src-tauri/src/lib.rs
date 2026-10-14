use serde::Serialize;
use std::fs;
use std::io::ErrorKind;

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
enum PathKind {
    File,
    Folder,
    Missing,
    Unreadable,
    Other,
}

fn inspect(path: &str) -> PathKind {
    match fs::metadata(path) {
        Ok(meta) if meta.is_dir() => PathKind::Folder,
        Ok(meta) if meta.is_file() => PathKind::File,
        Ok(_) => PathKind::Other,
        Err(e) if e.kind() == ErrorKind::NotFound => PathKind::Missing,
        Err(_) => PathKind::Unreadable,
    }
}

#[tauri::command]
fn inspect_path(path: String) -> PathKind {
    inspect(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![inspect_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_folder(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("black-hole-{}-{}", name, std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn detects_a_file() {
        let dir = temp_folder("file");
        let file = dir.join("a.txt");
        fs::write(&file, "hi").unwrap();
        assert_eq!(inspect(file.to_str().unwrap()), PathKind::File);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn detects_a_folder_even_with_a_dot_in_its_name() {
        let dir = temp_folder("folder");
        let folder = dir.join("Project.zip");
        fs::create_dir_all(&folder).unwrap();
        assert_eq!(inspect(folder.to_str().unwrap()), PathKind::Folder);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn detects_a_missing_path() {
        let dir = temp_folder("missing");
        let nothing = dir.join("does-not-exist.txt");
        assert_eq!(inspect(nothing.to_str().unwrap()), PathKind::Missing);
        fs::remove_dir_all(&dir).unwrap();
    }
}
