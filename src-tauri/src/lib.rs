use serde::Serialize;
use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
enum PathKind {
    File,
    Folder,
    Missing,
    Unreadable,
    Other,
}

fn queue_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("queue.json"))
}

fn write_atomically(path: &Path, contents: &str) -> std::io::Result<()> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, contents)?;
    fs::rename(&tmp, path)
}

fn read_if_exists(path: &Path) -> std::io::Result<Option<String>> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
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

#[derive(Debug, PartialEq, Serialize)]
#[serde(tag = "status", rename_all = "kebab-case")]
enum MoveOutcome {
    Moved { to: String },
    AlreadyThere,
    Exists { to: String },
    Failed { reason: String },
}

fn move_into_folder(source: &str, dest_folder: &str) -> MoveOutcome {
    let source_path = Path::new(source);

    let file_name = match source_path.file_name() {
        Some(name) => name,
        None => {
            return MoveOutcome::Failed {
                reason: "That path has no file name.".into(),
            }
        }
    };

    if fs::symlink_metadata(source_path).is_err() {
        return MoveOutcome::Failed {
            reason: "The item no longer exists at its original location.".into(),
        };
    }

    let dest_dir = Path::new(dest_folder);
    let dest_path = dest_dir.join(file_name);

    if dest_path == source_path {
        return MoveOutcome::AlreadyThere;
    }

    if dest_dir.starts_with(source_path) {
        return MoveOutcome::Failed {
            reason: "A folder can't be moved into itself.".into(),
        };
    }

    if let Err(e) = fs::create_dir_all(dest_dir) {
        return MoveOutcome::Failed {
            reason: format!("Couldn't create the destination folder: {e}"),
        };
    }

    if fs::symlink_metadata(&dest_path).is_ok() {
        return MoveOutcome::Exists {
            to: dest_path.to_string_lossy().into_owned(),
        };
    }

    match fs::rename(source_path, &dest_path) {
        Ok(()) => MoveOutcome::Moved {
            to: dest_path.to_string_lossy().into_owned(),
        },
        Err(e) => MoveOutcome::Failed {
            reason: format!("Couldn't move the item: {e}"),
        },
    }
}

#[tauri::command]
fn inspect_path(path: String) -> PathKind {
    inspect(&path)
}

#[tauri::command]
fn move_item(source: String, dest_folder: String) -> MoveOutcome {
    move_into_folder(&source, &dest_folder)
}

#[tauri::command]
fn save_queue(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let path = queue_file(&app)?;
    write_atomically(&path, &json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_queue(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = queue_file(&app)?;
    read_if_exists(&path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            inspect_path,
            move_item,
            save_queue,
            load_queue
        ])
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

    // ---- inspect ----

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

    // ---- move_into_folder ----

    #[test]
    fn moves_a_file_and_creates_the_folder() {
        let dir = temp_folder("move");
        let source = dir.join("a.txt");
        fs::write(&source, "hello").unwrap();
        let dest_folder = dir.join("School Documents");

        let outcome =
            move_into_folder(source.to_str().unwrap(), dest_folder.to_str().unwrap());

        let expected = dest_folder.join("a.txt");
        assert_eq!(
            outcome,
            MoveOutcome::Moved {
                to: expected.to_string_lossy().into_owned()
            }
        );
        assert!(!source.exists());
        assert_eq!(fs::read_to_string(&expected).unwrap(), "hello");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn never_overwrites_an_existing_file() {
        let dir = temp_folder("exists");
        let source = dir.join("a.txt");
        fs::write(&source, "new").unwrap();
        let dest_folder = dir.join("Docs");
        fs::create_dir_all(&dest_folder).unwrap();
        let existing = dest_folder.join("a.txt");
        fs::write(&existing, "old").unwrap();

        let outcome =
            move_into_folder(source.to_str().unwrap(), dest_folder.to_str().unwrap());

        assert!(matches!(outcome, MoveOutcome::Exists { .. }));
        assert_eq!(fs::read_to_string(&existing).unwrap(), "old");
        assert_eq!(fs::read_to_string(&source).unwrap(), "new");
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn reports_a_missing_source() {
        let dir = temp_folder("nosource");
        let source = dir.join("ghost.txt");
        let dest_folder = dir.join("Docs");

        let outcome =
            move_into_folder(source.to_str().unwrap(), dest_folder.to_str().unwrap());

        assert!(matches!(outcome, MoveOutcome::Failed { .. }));
        assert!(!dest_folder.exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn reports_a_file_already_in_place() {
        let dir = temp_folder("already");
        let dest_folder = dir.join("Docs");
        fs::create_dir_all(&dest_folder).unwrap();
        let source = dest_folder.join("a.txt");
        fs::write(&source, "hi").unwrap();

        let outcome =
            move_into_folder(source.to_str().unwrap(), dest_folder.to_str().unwrap());

        assert_eq!(outcome, MoveOutcome::AlreadyThere);
        assert!(source.exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn refuses_to_move_a_folder_into_itself() {
        let dir = temp_folder("itself");
        let folder = dir.join("Stuff");
        fs::create_dir_all(&folder).unwrap();
        let dest_folder = folder.join("Sub");

        let outcome =
            move_into_folder(folder.to_str().unwrap(), dest_folder.to_str().unwrap());

        assert!(matches!(outcome, MoveOutcome::Failed { .. }));
        assert!(folder.exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn moves_a_whole_folder_with_its_contents() {
        let dir = temp_folder("wholefolder");
        let folder = dir.join("Project");
        fs::create_dir_all(&folder).unwrap();
        fs::write(folder.join("notes.txt"), "keep me").unwrap();
        let dest_folder = dir.join("Other");

        let outcome =
            move_into_folder(folder.to_str().unwrap(), dest_folder.to_str().unwrap());

        assert!(matches!(outcome, MoveOutcome::Moved { .. }));
        assert!(!folder.exists());
        assert_eq!(
            fs::read_to_string(dest_folder.join("Project").join("notes.txt")).unwrap(),
            "keep me"
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    // ---- queue storage ----

    #[test]
    fn saves_and_loads_text() {
        let dir = temp_folder("queue-roundtrip");
        let file = dir.join("queue.json");
        write_atomically(&file, "[1,2,3]").unwrap();
        assert_eq!(read_if_exists(&file).unwrap(), Some("[1,2,3]".to_string()));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn loading_a_missing_file_gives_none() {
        let dir = temp_folder("queue-none");
        let file = dir.join("queue.json");
        assert_eq!(read_if_exists(&file).unwrap(), None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn saving_again_replaces_the_contents_and_leaves_no_temp_file() {
        let dir = temp_folder("queue-replace");
        let file = dir.join("queue.json");
        write_atomically(&file, "old").unwrap();
        write_atomically(&file, "new").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "new");
        assert!(!dir.join("queue.json.tmp").exists());
        fs::remove_dir_all(&dir).unwrap();
    }
}